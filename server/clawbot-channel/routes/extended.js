// ============================================
// 扩展 API 路由
// 聊天、学习、配对、地点、积分、快照、通知
// ============================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// ============================================
// 通用响应函数
// ============================================

function success(res, data, message = '成功') {
  res.json({ success: true, message, data });
}

function error(res, message, status = 400) {
  res.status(status).json({ success: false, error: message });
}

function notFound(res, message = '资源不存在') {
  error(res, message, 404);
}

function unauthorized(res, message = '未授权') {
  error(res, message, 401);
}

function serverError(res, err) {
  console.error('[API Error]', err);
  error(res, '服务器错误', 500);
}

async function upsertRoomPreference(userId, roomId, isMuted, isArchived) {
  await dbRun(
    `INSERT INTO chat_room_user_preferences (
      user_id, room_id, is_muted, is_archived, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, room_id) DO UPDATE SET
      is_muted = excluded.is_muted,
      is_archived = excluded.is_archived,
      updated_at = CURRENT_TIMESTAMP`,
    [userId, roomId, isMuted ? 1 : 0, isArchived ? 1 : 0]
  );
}

function formatSQLiteDate(value) {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function mapLocalMessageRow(row, currentUserId) {
  return {
    id: row.id,
    room_id: row.room_id,
    sender_id: row.sender_id,
    sender: row.sender_id === currentUserId ? 'user' : 'friend',
    content: row.content || '',
    message_type: row.content_type || 'text',
    media_url: row.media_url || null,
    media_mime_type: row.media_mime_type || null,
    media_duration: row.media_duration ?? null,
    is_read: true,
    created_at: formatSQLiteDate(row.created_at)
  };
}

// ============================================
// 聊天模块 /chat
// ============================================

// 获取用户的聊天房间列表
router.get('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const roomRows = await dbAll(
      `SELECT r.id, r.name, r.type, r.created_at, r.updated_at
       FROM chat_rooms_local r
       INNER JOIN chat_room_participants_local p ON p.room_id = r.id
       WHERE p.user_id = ?
       ORDER BY r.updated_at DESC`,
      [req.userId]
    );

    const roomIds = (roomRows || []).map((row) => row.id);
    if (roomIds.length === 0) {
      return success(res, []);
    }

    const placeholders = roomIds.map(() => '?').join(',');

    const messageRows = await dbAll(
      `SELECT id, room_id, sender_id, content, content_type, media_url, media_mime_type, media_duration, created_at
       FROM chat_messages_local
       WHERE room_id IN (${placeholders})
       ORDER BY created_at DESC`,
      roomIds
    );

    const messagesMap = {};
    for (const row of (messageRows || [])) {
      if (!messagesMap[row.room_id]) {
        messagesMap[row.room_id] = mapLocalMessageRow(row, req.userId);
      }
    }

    const preferenceRows = await dbAll(
      `SELECT room_id, is_muted, is_archived
       FROM chat_room_user_preferences
       WHERE user_id = ? AND room_id IN (${placeholders})`,
      [req.userId, ...roomIds]
    );

    const preferenceMap = (preferenceRows || []).reduce((acc, row) => {
      acc[row.room_id] = {
        is_muted: Boolean(row.is_muted),
        is_archived: Boolean(row.is_archived)
      };
      return acc;
    }, {});

    const result = roomRows
      .map((row) => {
        const preference = preferenceMap[row.id] || { is_muted: false, is_archived: false };
        return {
          id: row.id,
          name: row.name,
          type: row.type || 'group',
          participants: [],
          last_message: messagesMap[row.id] || null,
          unread_count: 0,
          is_muted: preference.is_muted,
          is_archived: preference.is_archived,
          created_at: formatSQLiteDate(row.created_at),
          updated_at: formatSQLiteDate(row.updated_at)
        };
      })
      .filter((room) => !room.is_archived);

    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建聊天房间
router.post('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const { name, type = 'direct', participantIds = [] } = req.body;
    const normalizedName = (name || '').trim();
    if (!normalizedName) {
      return error(res, 'name 不能为空', 400);
    }

    const roomId = uuidv4();
    const now = new Date().toISOString();
    const normalizedType = ['ai', 'group', 'private'].includes(type) ? type : 'group';

    await dbRun(
      `INSERT INTO chat_rooms_local (id, name, type, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, normalizedName, normalizedType, req.userId, now, now]
    );

    await dbRun(
      `INSERT INTO chat_room_participants_local (room_id, user_id, role, joined_at)
       VALUES (?, ?, 'owner', ?)`,
      [roomId, req.userId, now]
    );

    const uniqueParticipants = Array.from(new Set((participantIds || []).filter(Boolean)))
      .filter((userId) => userId !== req.userId);

    for (const userId of uniqueParticipants) {
      await dbRun(
        `INSERT OR IGNORE INTO chat_room_participants_local (room_id, user_id, role, joined_at)
         VALUES (?, ?, 'member', ?)`,
        [roomId, userId, now]
      );
    }

    const response = {
      id: roomId,
      name: normalizedName,
      type: normalizedType,
      participants: [],
      last_message: null,
      unread_count: 0,
      created_at: now,
      updated_at: now
    };

    success(res, response, '创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取聊天房间消息
router.get('/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    const participant = await dbGet(
      `SELECT room_id FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    const normalizedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const params = [roomId];
    let sql = `
      SELECT id, room_id, sender_id, content, content_type, media_url, media_mime_type, media_duration, created_at
      FROM chat_messages_local
      WHERE room_id = ?
    `;
    if (before) {
      sql += ' AND created_at < ?';
      params.push(before);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(normalizedLimit);

    const rows = await dbAll(sql, params);
    const messages = (rows || []).map((row) => mapLocalMessageRow(row, req.userId));
    success(res, messages);
  } catch (err) {
    serverError(res, err);
  }
});

// 发送消息
router.post('/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, content_type = 'text', media_url, reply_to_id } = req.body;

    const participant = await dbGet(
      `SELECT room_id FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    const messageId = uuidv4();
    const now = new Date().toISOString();
    const normalizedContent = typeof content === 'string' ? content : '';

    await dbRun(
      `INSERT INTO chat_messages_local (
        id, room_id, sender_id, content, content_type, media_url, reply_to_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [messageId, roomId, req.userId, normalizedContent, content_type, media_url || null, reply_to_id || null, now]
    );

    await dbRun(
      `UPDATE chat_rooms_local
       SET updated_at = ?
       WHERE id = ?`,
      [now, roomId]
    );

    const message = mapLocalMessageRow({
      id: messageId,
      room_id: roomId,
      sender_id: req.userId,
      content: normalizedContent,
      content_type,
      media_url: media_url || null,
      media_mime_type: null,
      media_duration: null,
      created_at: now
    }, req.userId);

    success(res, message, '发送成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 标记消息为已读
router.post('/chat/rooms/:roomId/messages/read', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;

    await dbRun(
      `UPDATE chat_room_participants_local
       SET last_read_at = ?
       WHERE room_id = ? AND user_id = ?`,
      [new Date().toISOString(), roomId, req.userId]
    );

    success(res, null, '已标记已读');
  } catch (err) {
    serverError(res, err);
  }
});

// 归档聊天房间（仅对当前用户隐藏）
router.post('/chat/rooms/:roomId/archive', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const participant = await dbGet(
      `SELECT room_id FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    await upsertRoomPreference(req.userId, roomId, false, true);
    success(res, null, '已归档');
  } catch (err) {
    serverError(res, err);
  }
});

// 静音聊天房间
router.post('/chat/rooms/:roomId/mute', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const participant = await dbGet(
      `SELECT room_id FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    await upsertRoomPreference(req.userId, roomId, true, false);
    success(res, null, '已静音');
  } catch (err) {
    serverError(res, err);
  }
});

// 取消静音聊天房间
router.post('/chat/rooms/:roomId/unmute', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const participant = await dbGet(
      `SELECT room_id FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    await upsertRoomPreference(req.userId, roomId, false, false);
    success(res, null, '已取消静音');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除聊天房间（当前用户退出房间；若房间无人则清理）
router.delete('/chat/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const participant = await dbGet(
      `SELECT room_id FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    await dbRun(
      `DELETE FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );

    await dbRun(
      'DELETE FROM chat_room_user_preferences WHERE user_id = ? AND room_id = ?',
      [req.userId, roomId]
    );

    const row = await dbGet(
      `SELECT COUNT(1) AS count FROM chat_room_participants_local
       WHERE room_id = ?`,
      [roomId]
    );
    const participantCount = Number(row?.count || 0);

    if (participantCount === 0) {
      await dbRun('DELETE FROM chat_messages_local WHERE room_id = ?', [roomId]);
      await dbRun('DELETE FROM chat_rooms_local WHERE id = ?', [roomId]);
      await dbRun('DELETE FROM chat_room_user_preferences WHERE room_id = ?', [roomId]);
    }

    success(res, null, '已删除');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 学习模块 /study
// ============================================

// 获取学习记录列表
router.get('/study/sessions', authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const { data: sessions, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', req.userId)
      .order('start_time', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    success(res, sessions || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建学习记录
router.post('/study/sessions', authMiddleware, async (req, res) => {
  try {
    const { start_time, subject, topic, notes } = req.body;

    const { data: session, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: req.userId,
        start_time: start_time || new Date().toISOString(),
        subject,
        topic,
        notes,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    success(res, session, '创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 更新学习记录
router.put('/study/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { end_time, duration, status, points_earned, notes } = req.body;

    const { data: session, error } = await supabase
      .from('study_sessions')
      .update({
        end_time,
        duration,
        status,
        points_earned,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!session) return notFound(res, '学习记录不存在');

    // 如果完成学习，增加积分
    if (status === 'completed' && points_earned > 0) {
      await addPoints(req.userId, points_earned, 'earn', '学习完成');
    }

    success(res, session, '更新成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除学习记录
router.delete('/study/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('study_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    success(res, null, '删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取学习统计
router.get('/study/stats', authMiddleware, async (req, res) => {
  try {
    // 获取今日统计
    const today = new Date().toISOString().split('T')[0];

    const { data: todayStats } = await supabase
      .from('study_sessions')
      .select('duration, points_earned')
      .eq('user_id', req.userId)
      .gte('start_time', today);

    const todayTime = todayStats?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const todayPoints = todayStats?.reduce((sum, s) => sum + (s.points_earned || 0), 0) || 0;

    // 获取本周统计
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString();

    const { data: weekStats } = await supabase
      .from('study_sessions')
      .select('duration, points_earned')
      .eq('user_id', req.userId)
      .gte('start_time', weekStartStr)
      .eq('status', 'completed');

    const weekTime = weekStats?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const weekPoints = weekStats?.reduce((sum, s) => sum + (s.points_earned || 0), 0) || 0;
    const weekSessions = weekStats?.length || 0;

    // 获取本月统计
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString();

    const { data: monthStats } = await supabase
      .from('study_sessions')
      .select('duration, points_earned')
      .eq('user_id', req.userId)
      .gte('start_time', monthStartStr)
      .eq('status', 'completed');

    const monthTime = monthStats?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const monthPoints = monthStats?.reduce((sum, s) => sum + (s.points_earned || 0), 0) || 0;

    // 获取总统计
    const { data: totalStats } = await supabase
      .from('study_sessions')
      .select('duration, points_earned')
      .eq('user_id', req.userId)
      .eq('status', 'completed');

    const totalTime = totalStats?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
    const totalPoints = totalStats?.reduce((sum, s) => sum + (s.points_earned || 0), 0) || 0;

    success(res, {
      today: { study_time: todayTime, points: todayPoints },
      week: { study_time: weekTime, points: weekPoints, sessions: weekSessions },
      month: { study_time: monthTime, points: monthPoints },
      total: { study_time: totalTime, points: totalPoints }
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 获取每周学习数据
router.get('/study/stats/weekly', authMiddleware, async (req, res) => {
  try {
    const { weeks = 4 } = req.query;

    const result = [];
    for (let i = 0; i < parseInt(weeks); i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('duration')
        .eq('user_id', req.userId)
        .gte('start_time', weekStart.toISOString())
        .lt('start_time', weekEnd.toISOString())
        .eq('status', 'completed');

      const totalTime = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;

      result.push({
        week_start: weekStart.toISOString().split('T')[0],
        study_time: totalTime,
        days: Array.from({ length: 7 }, (_, j) => {
          const dayStart = new Date(weekStart);
          dayStart.setDate(dayStart.getDate() + j);
          const dayStr = dayStart.toISOString().split('T')[0];
          const daySession = sessions?.find(s => s.start_time?.startsWith(dayStr));
          return daySession ? daySession.duration : 0;
        })
      });
    }

    success(res, result.reverse());
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 配对模块 /pairing
// ============================================

// 创建配对请求
router.post('/pairing/request', authMiddleware, async (req, res) => {
  try {
    const { device_name, device_type = 'bot' } = req.body;

    // 生成配对码
    const token = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: pairing, error } = await supabase
      .from('pairing_requests')
      .insert({
        user_id: req.userId,
        device_name,
        device_type,
        token,
        status: 'pending',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5分钟过期
      })
      .select()
      .single();

    if (error) throw error;

    success(res, { id: pairing.id, token: pairing.token, expires_at: pairing.expires_at }, '配对请求已创建');
  } catch (err) {
    serverError(res, err);
  }
});

// 确认配对
router.post('/pairing/confirm', authMiddleware, async (req, res) => {
  try {
    const { pairing_id, device_id } = req.body;

    // 更新配对请求状态
    const { error: updateError } = await supabase
      .from('pairing_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', pairing_id)
      .eq('user_id', req.userId);

    if (updateError) throw updateError;

    // 创建设备记录
    const { data: device, error: deviceError } = await supabase
      .from('paired_devices')
      .insert({
        user_id: req.userId,
        device_id,
        device_type: 'bot',
        paired_at: new Date().toISOString()
      })
      .select()
      .single();

    if (deviceError) throw deviceError;

    success(res, device, '配对成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取配对设备列表
router.get('/pairing/devices', authMiddleware, async (req, res) => {
  try {
    const { data: devices, error } = await supabase
      .from('paired_devices')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_active', true)
      .order('paired_at', { ascending: false });

    if (error) throw error;

    success(res, devices || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 解除配对
router.delete('/pairing/devices/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('paired_devices')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    success(res, null, '解除配对成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 地点模块 /places
// ============================================

// 获取附近地点
router.get('/places/nearby', optionalAuthMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, lat, lng, radius = 5000 } = req.query;
    const finalLatitude = latitude ?? lat;
    const finalLongitude = longitude ?? lng;

    if (!finalLatitude || !finalLongitude) {
      return error(res, '需要提供经纬度');
    }

    // 简单计算 - PostgreSQL 中应该使用 PostGIS
    // 这里使用简单的矩形过滤
    const latValue = parseFloat(finalLatitude);
    const lngValue = parseFloat(finalLongitude);
    const rad = parseFloat(radius) / 111000; // 转换为度数

    const { data: places, error } = await supabase
      .from('places')
      .select('*')
      .gte('latitude', latValue - rad)
      .lte('latitude', latValue + rad)
      .gte('longitude', lngValue - rad)
      .lte('longitude', lngValue + rad)
      .limit(20);

    if (error) throw error;

    // 计算实际距离
    const result = (places || []).map(place => ({
      ...place,
      distance: Math.sqrt(
        Math.pow((place.latitude - latValue) * 111000, 2) +
        Math.pow((place.longitude - lngValue) * 111000 * Math.cos(latValue * Math.PI / 180), 2)
      )
    })).sort((a, b) => a.distance - b.distance);

    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// 搜索地点
router.get('/places/search', optionalAuthMiddleware, async (req, res) => {
  try {
    const { q, category } = req.query;

    let query = supabase
      .from('places')
      .select('*')
      .limit(20);

    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: places, error } = await query;

    if (error) throw error;

    success(res, places || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 获取地点收藏
router.get('/places/favorites', authMiddleware, async (req, res) => {
  try {
    const { data: favorites, error } = await supabase
      .from('place_favorites')
      .select(`
        id,
        notes,
        created_at,
        place:places(*)
      `)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    success(res, favorites || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 添加地点收藏
router.post('/places/favorites', authMiddleware, async (req, res) => {
  try {
    const { place_id, notes } = req.body;

    const { data: favorite, error } = await supabase
      .from('place_favorites')
      .insert({
        user_id: req.userId,
        place_id,
        notes
      })
      .select()
      .single();

    if (error) throw error;

    success(res, favorite, '收藏成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除地点收藏
router.delete('/places/favorites/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('place_favorites')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    success(res, null, '取消收藏成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 位置模块 /locations
// ============================================

// 获取用户位置列表
router.get('/locations', authMiddleware, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data: locations, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('user_id', req.userId)
      .eq('is_visible', true)
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    success(res, locations || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 分享位置
router.post('/locations/share', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, altitude, speed, heading, expires_in = 3600 } = req.body;

    const { data: location, error } = await supabase
      .from('user_locations')
      .insert({
        user_id: req.userId,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        timestamp: new Date().toISOString(),
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    success(res, location, '位置分享成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 积分模块 /points
// ============================================

// 辅助函数: 增加积分
async function addPoints(userId, amount, type, reason) {
  // 更新用户积分
  const { data: existingPoints } = await supabase
    .from('user_points')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingPoints) {
    await supabase
      .from('user_points')
      .update({
        total_points: existingPoints.total_points + amount,
        lifetime_points: existingPoints.lifetime_points + amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_points')
      .insert({
        user_id: userId,
        total_points: amount,
        lifetime_points: amount
      });
  }

  // 记录积分变动
  await supabase
    .from('points_transactions')
    .insert({
      user_id: userId,
      amount,
      type,
      reason
    });
}

// 获取用户积分
router.get('/points', authMiddleware, async (req, res) => {
  try {
    const { data: points, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    success(res, points || { total_points: 0, lifetime_points: 0, level: 1 });
  } catch (err) {
    serverError(res, err);
  }
});

// 获取积分历史
router.get('/points/history', authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const { data: transactions, error } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    success(res, transactions || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 增加积分
router.post('/points/add', authMiddleware, async (req, res) => {
  try {
    const { amount, points: pointsInput, reason, description } = req.body;
    const finalAmount = Number(amount ?? pointsInput ?? 0);
    const finalReason = reason || description || '积分增加';

    if (!finalAmount || finalAmount <= 0) {
      return error(res, '积分必须大于0');
    }

    await addPoints(req.userId, finalAmount, 'bonus', finalReason);

    // 获取最新积分
    const { data: points } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', req.userId)
      .single();

    success(res, {
      total_points: points?.total_points || 0,
      level: 1,
      today_earned: 0,
      week_earned: 0,
      total_transactions: 0
    }, '积分添加成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 扣除积分
router.post('/points/deduct', authMiddleware, async (req, res) => {
  try {
    const { amount, points: pointsInput, reason, description } = req.body;
    const finalAmount = Number(amount ?? pointsInput ?? 0);
    const finalReason = reason || description || '积分扣除';

    if (!finalAmount || finalAmount <= 0) {
      return error(res, '积分必须大于0');
    }

    // 检查积分是否足够
    const { data: currentPoints } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', req.userId)
      .single();

    if (!currentPoints || currentPoints.total_points < finalAmount) {
      return error(res, '积分不足');
    }

    // 扣除积分
    await addPoints(req.userId, -finalAmount, 'deduct', finalReason);

    // 获取最新积分
    const { data: points } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', req.userId)
      .single();

    success(res, {
      total_points: points?.total_points || 0,
      level: 1,
      today_earned: 0,
      week_earned: 0,
      total_transactions: 0
    }, '积分扣除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 快照模块 /snapshots
// ============================================

// 获取快照列表
router.get('/snapshots', authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const { data: snapshots, error } = await supabase
      .from('snapshots')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    success(res, snapshots || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建快照
router.post('/snapshots', authMiddleware, async (req, res) => {
  try {
    const { image_url, analysis_text, analysis_type, tags, score, feedback } = req.body;

    const { data: snapshot, error } = await supabase
      .from('snapshots')
      .insert({
        user_id: req.userId,
        image_url,
        analysis_text,
        analysis_type,
        tags,
        score,
        feedback
      })
      .select()
      .single();

    if (error) throw error;

    success(res, snapshot, '快照创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取单个快照
router.get('/snapshots/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: snapshot, error } = await supabase
      .from('snapshots')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;
    if (!snapshot) return notFound(res, '快照不存在');

    success(res, snapshot);
  } catch (err) {
    serverError(res, err);
  }
});

// 删除快照
router.delete('/snapshots/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('snapshots')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    success(res, null, '删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 通知模块 /notifications
// ============================================

// 获取通知列表
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const { limit = 20, offset = 0, unread_only } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // 统计未读数量
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('is_read', false);

    success(res, {
      notifications: notifications || [],
      unread_count: count || 0
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 标记通知为已读
async function handleMarkNotificationRead(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;

    success(res, null, '标记已读成功');
  } catch (err) {
    serverError(res, err);
  }
}

router.put('/notifications/:id/read', authMiddleware, handleMarkNotificationRead);
router.post('/notifications/:id/read', authMiddleware, handleMarkNotificationRead);

// 标记所有通知为已读
router.post('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', req.userId)
      .eq('is_read', false);

    if (error) throw error;

    success(res, null, '全部标记已读成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 保存设备令牌
router.post('/notifications/device-token', authMiddleware, async (req, res) => {
  try {
    const { token, platform, app_version, device_model } = req.body;

    // 先删除旧令牌
    await supabase
      .from('device_tokens')
      .delete()
      .eq('token', token);

    // 插入新令牌
    const { error } = await supabase
      .from('device_tokens')
      .insert({
        user_id: req.userId,
        token,
        platform,
        app_version,
        device_model
      });

    if (error) throw error;

    success(res, null, '设备令牌保存成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取通知设置
router.get('/notifications/settings', authMiddleware, async (req, res) => {
  try {
    // 这里可以扩展为从用户设置中读取
    // 暂时返回默认设置
    const settings = {
      push_enabled: true,
      study_reminder: true,
      friend_request: true,
      system_notification: true
    };

    success(res, settings);
  } catch (err) {
    serverError(res, err);
  }
});

// 更新通知设置
router.put('/notifications/settings', authMiddleware, async (req, res) => {
  try {
    const { push_enabled, study_reminder, friend_request, system_notification } = req.body;

    // 这里可以扩展为保存到用户设置
    // 暂时只返回成功
    const settings = {
      push_enabled,
      study_reminder,
      friend_request,
      system_notification
    };

    success(res, settings, '设置保存成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 获取单个聊天房间
// ============================================

router.get('/chat/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;

    const participant = await dbGet(
      `SELECT room_id, role, joined_at
       FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );
    if (!participant) {
      return unauthorized(res, '你不在此房间中');
    }

    const room = await dbGet(
      `SELECT id, name, type, created_at, updated_at
       FROM chat_rooms_local
       WHERE id = ?`,
      [roomId]
    );
    if (!room) return notFound(res, '房间不存在');

    const lastMessageRow = await dbGet(
      `SELECT id, room_id, sender_id, content, content_type, media_url, media_mime_type, media_duration, created_at
       FROM chat_messages_local
       WHERE room_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [roomId]
    );

    const response = {
      id: room.id,
      name: room.name,
      type: room.type || 'group',
      participants: [],
      last_message: lastMessageRow ? mapLocalMessageRow(lastMessageRow, req.userId) : null,
      unread_count: 0,
      created_at: formatSQLiteDate(room.created_at),
      updated_at: formatSQLiteDate(room.updated_at)
    };

    success(res, response);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 切换地点收藏
// ============================================

router.post('/places/:placeId/favorite', authMiddleware, async (req, res) => {
  try {
    const { placeId } = req.params;

    // 检查是否已经收藏
    const { data: existing } = await supabase
      .from('place_favorites')
      .select('*')
      .eq('user_id', req.userId)
      .eq('place_id', placeId)
      .single();

    if (existing) {
      // 取消收藏
      await supabase
        .from('place_favorites')
        .delete()
        .eq('id', existing.id);

      success(res, { is_favorited: false }, '取消收藏成功');
    } else {
      // 添加收藏
      const { data: favorite, error } = await supabase
        .from('place_favorites')
        .insert({
          user_id: req.userId,
          place_id: placeId
        })
        .select()
        .single();

      if (error) throw error;

      success(res, { is_favorited: true, favorite }, '收藏成功');
    }
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 配对状态查询
// ============================================

router.get('/pairing/status/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: pairing, error } = await supabase
      .from('pairing_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;
    if (!pairing) return notFound(res, '配对请求不存在');

    success(res, pairing);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 获取单个位置
// ============================================

router.get('/locations/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: location, error } = await supabase
      .from('user_locations')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (error) throw error;
    if (!location) return notFound(res, '位置不存在');

    success(res, location);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 通知偏好设置
// ============================================

router.get('/notifications/preferences', authMiddleware, async (req, res) => {
  try {
    // 从用户配置中读取通知偏好
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', req.userId)
      .single();

    const preferences = profile?.notification_preferences || {
      push_enabled: true,
      study_reminder: true,
      friend_request: true,
      system_notification: true,
      study_room_invite: true,
      mall_promotion: false
    };

    success(res, preferences);
  } catch (err) {
    serverError(res, err);
  }
});

router.put('/notifications/preferences', authMiddleware, async (req, res) => {
  try {
    const { push_enabled, study_reminder, friend_request, system_notification, study_room_invite, mall_promotion } = req.body;

    const preferences = {
      push_enabled,
      study_reminder,
      friend_request,
      system_notification,
      study_room_invite,
      mall_promotion
    };

    // 保存到用户配置
    await supabase
      .from('profiles')
      .update({ notification_preferences: preferences })
      .eq('id', req.userId);

    success(res, preferences, '偏好设置已更新');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 学习房间
// ============================================

// 创建学习房间
router.post('/study/room/create', authMiddleware, async (req, res) => {
  try {
    const { name, max_participants = 5, subject } = req.body;

    // 生成房间码
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: room, error } = await supabase
      .from('study_rooms')
      .insert({
        code: roomCode,
        name: name || `学习房间 ${roomCode}`,
        host_id: req.userId,
        max_participants,
        subject,
        status: 'waiting'
      })
      .select()
      .single();

    if (error) throw error;

    // 添加创建者为参与者
    await supabase
      .from('study_room_participants')
      .insert({
        room_id: room.id,
        user_id: req.userId,
        role: 'host'
      });

    success(res, room, '房间创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 加入学习房间
router.post('/study/room/join', authMiddleware, async (req, res) => {
  try {
    const { room_code } = req.body;

    if (!room_code) {
      return error(res, '请提供房间码');
    }

    // 查找房间
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('*')
      .eq('code', room_code.toUpperCase())
      .single();

    if (roomError || !room) {
      return notFound(res, '房间不存在');
    }

    if (room.status === 'ended') {
      return error(res, '房间已结束');
    }

    // 检查是否已满
    const { count } = await supabase
      .from('study_room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (count >= room.max_participants) {
      return error(res, '房间已满');
    }

    // 检查是否已在房间中
    const { data: existing } = await supabase
      .from('study_room_participants')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', req.userId)
      .single();

    if (existing) {
      return error(res, '你已在房间中');
    }

    // 加入房间
    await supabase
      .from('study_room_participants')
      .insert({
        room_id: room.id,
        user_id: req.userId,
        role: 'participant'
      });

    success(res, room, '加入成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 离开学习房间
router.post('/study/room/leave', authMiddleware, async (req, res) => {
  try {
    const { room_id } = req.body;

    // 移除参与者
    const { error } = await supabase
      .from('study_room_participants')
      .delete()
      .eq('room_id', room_id)
      .eq('user_id', req.userId);

    if (error) throw error;

    // 检查房间是否还有参与者
    const { count } = await supabase
      .from('study_room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room_id);

    // 如果没有参与者，结束房间
    if (count === 0) {
      await supabase
        .from('study_rooms')
        .update({ status: 'ended' })
        .eq('id', room_id);
    }

    success(res, null, '离开成功');
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;
