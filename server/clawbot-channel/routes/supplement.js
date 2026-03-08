// ============================================
// 补充 API 路由
// 未读计数、AI对话、学习目标
// ============================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const gatewayService = require('../services/gatewayService');

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

function serverError(res, err) {
  console.error('[API Error]', err);
  error(res, '服务器错误', 500);
}

function isSchemaMismatchError(err) {
  if (!err || typeof err !== 'object') return false;
  return ['PGRST204', 'PGRST205', '42703'].includes(err.code);
}

function formatSQLiteDate(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

// ============================================
// 未读计数模块 /unread
// ============================================

// 获取所有未读计数
router.get('/unread/counts', authMiddleware, async (req, res) => {
  try {
    const { data: counts, error } = await supabase
      .from('unread_counts')
      .select('*')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // 统计总未读
    const totalUnread = (counts || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);

    success(res, {
      counts: counts || [],
      total: totalUnread,
      chat: totalUnread,
      notifications: 0,
      friend_requests: 0
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 获取与某好友的未读计数
router.get('/unread/counts/:friendId', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;

    const { data: count, error } = await supabase
      .from('unread_counts')
      .select('*')
      .eq('user_id', req.userId)
      .eq('friend_id', friendId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    success(res, count?.unread_count || 0);
  } catch (err) {
    serverError(res, err);
  }
});

// 更新未读计数
async function handleUnreadCountUpdate(req, res) {
  try {
    const { friendId } = req.params;
    const { unread_count, count: countInput, last_message, last_message_at } = req.body || {};
    const finalCount = Number(unread_count ?? countInput ?? 0);

    let { data: countRow, error } = await supabase
      .from('unread_counts')
      .upsert({
        user_id: req.userId,
        friend_id: friendId,
        unread_count: finalCount,
        last_message,
        last_message_time: last_message_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,friend_id' })
      .select()
      .single();

    if (error && isSchemaMismatchError(error) && /(last_message_time|last_message_at)/.test(error.message || '')) {
      ({ data: countRow, error } = await supabase
        .from('unread_counts')
        .upsert({
          user_id: req.userId,
          friend_id: friendId,
          unread_count: finalCount,
          last_message,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,friend_id' })
        .select()
        .single());
    }

    if (error) throw error;

    success(res, countRow);
  } catch (err) {
    serverError(res, err);
  }
}

router.put('/unread/counts/:friendId', authMiddleware, handleUnreadCountUpdate);
router.post('/unread/counts/:friendId', authMiddleware, handleUnreadCountUpdate);

// 标记全部已读
router.post('/unread/read-all', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('unread_counts')
      .update({
        unread_count: 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.userId);

    if (error) throw error;

    success(res, null, '全部已读');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// AI 对话模块 /clawbot
// ============================================

// 获取对话列表
router.get('/clawbot/conversations', authMiddleware, async (req, res) => {
  try {
    let { data: conversations, error } = await supabase
      .from('clawbot_conversations')
      .select('*')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error && isSchemaMismatchError(error)) {
      conversations = await dbAll(
        `SELECT id, title, created_at, updated_at
         FROM clawbot_conversations_local
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT 20`,
        [req.userId]
      );
      error = null;
    }

    if (error) throw error;

    const mapped = [];
    for (const conversation of (conversations || [])) {
      const message = await dbGet(
        `SELECT content, created_at
         FROM clawbot_messages_local
         WHERE conversation_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [conversation.id]
      );

      mapped.push({
        id: conversation.id,
        name: conversation.name || conversation.title || '新对话',
        avatar_url: conversation.avatar_url || null,
        last_message: conversation.last_message || message?.content || null,
        last_message_at: conversation.last_message_at || message?.created_at || conversation.updated_at || conversation.created_at,
        unread_count: Number(conversation.unread_count || 0),
        created_at: conversation.created_at || new Date().toISOString(),
        updated_at: conversation.updated_at || conversation.created_at || new Date().toISOString()
      });
    }

    success(res, mapped);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建对话
router.post('/clawbot/conversations', authMiddleware, async (req, res) => {
  try {
    const { title, name } = req.body || {};
    const conversationTitle = title || name || '新对话';

    let { data: conversation, error } = await supabase
      .from('clawbot_conversations')
      .insert({
        user_id: req.userId,
        title: conversationTitle
      })
      .select()
      .single();

    if (error && isSchemaMismatchError(error)) {
      const id = uuidv4();
      await dbRun(
        `INSERT INTO clawbot_conversations_local (id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, req.userId, conversationTitle]
      );
      conversation = await dbGet(
        `SELECT id, title, created_at, updated_at
         FROM clawbot_conversations_local
         WHERE id = ?`,
        [id]
      );
      error = null;
    }

    if (error) throw error;

    success(res, {
      id: conversation.id,
      name: conversation.name || conversation.title || conversationTitle,
      avatar_url: null,
      last_message: null,
      last_message_at: null,
      unread_count: 0,
      created_at: conversation.created_at || new Date().toISOString(),
      updated_at: conversation.updated_at || conversation.created_at || new Date().toISOString()
    }, '创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取对话消息
router.get('/clawbot/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;

    // 验证对话属于用户
    let { data: conversation, error: conversationError } = await supabase
      .from('clawbot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.userId)
      .single();

    if (conversationError && isSchemaMismatchError(conversationError)) {
      conversation = await dbGet(
        `SELECT id
         FROM clawbot_conversations_local
         WHERE id = ? AND user_id = ?`,
        [conversationId, req.userId]
      );
      conversationError = null;
    }
    if (conversationError && conversationError.code !== 'PGRST116') throw conversationError;

    if (!conversation) {
      return notFound(res, '对话不存在');
    }

    let { data: messages, error } = await supabase
      .from('clawbot_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    let total = 0;
    if (error && isSchemaMismatchError(error)) {
      messages = await dbAll(
        `SELECT id, role, content, created_at
         FROM clawbot_messages_local
         WHERE conversation_id = ?
         ORDER BY created_at ASC
         LIMIT ? OFFSET ?`,
        [conversationId, limit, offset]
      );
      const countRow = await dbGet(
        `SELECT COUNT(*) AS total
         FROM clawbot_messages_local
         WHERE conversation_id = ?`,
        [conversationId]
      );
      total = Number(countRow?.total || 0);
      error = null;
    } else {
      total = (messages || []).length;
    }

    if (error) throw error;

    const mapped = (messages || []).map((message) => ({
      id: message.id,
      content: message.content || '',
      content_type: 'text',
      media_url: null,
      media_mime_type: null,
      timestamp: message.created_at || new Date().toISOString(),
      sender: message.role === 'assistant' || message.role === 'bot' ? 'bot' : 'user'
    }));

    success(res, {
      data: mapped,
      total,
      page,
      limit
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 发送消息到 AI 对话
router.post('/clawbot/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, role = 'user' } = req.body;

    // 验证对话属于用户
    let { data: conversation, error: conversationError } = await supabase
      .from('clawbot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.userId)
      .single();

    if (conversationError && isSchemaMismatchError(conversationError)) {
      conversation = await dbGet(
        `SELECT id
         FROM clawbot_conversations_local
         WHERE id = ? AND user_id = ?`,
        [conversationId, req.userId]
      );
      conversationError = null;
    }
    if (conversationError && conversationError.code !== 'PGRST116') throw conversationError;

    if (!conversation) {
      return notFound(res, '对话不存在');
    }

    // 保存用户消息
    let { data: userMessage, error: userError } = await supabase
      .from('clawbot_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content
      })
      .select()
      .single();

    if (userError && isSchemaMismatchError(userError)) {
      const userMessageId = uuidv4();
      await dbRun(
        `INSERT INTO clawbot_messages_local (id, conversation_id, role, content, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userMessageId, conversationId, role, content]
      );
      userMessage = await dbGet(
        `SELECT id, role, content, created_at
         FROM clawbot_messages_local
         WHERE id = ?`,
        [userMessageId]
      );
      userError = null;
    }

    if (userError) throw userError;

    // 更新对话时间
    let { error: touchError } = await supabase
      .from('clawbot_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    if (touchError && isSchemaMismatchError(touchError)) {
      await dbRun(
        `UPDATE clawbot_conversations_local
         SET updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [conversationId]
      );
      touchError = null;
    }
    if (touchError) throw touchError;

    // 通过 Gateway 发送消息到 OpenClaw AI
    let assistantContent = '';
    try {
      const gatewayResult = await gatewayService.sendChatMessage(content);
      // 从 Gateway 响应中提取 AI 回复
      // Gateway 可能返回不同格式的响应
      if (gatewayResult && gatewayResult.response) {
        assistantContent = gatewayResult.response;
      } else if (gatewayResult && gatewayResult.message) {
        assistantContent = gatewayResult.message;
      } else if (gatewayResult && gatewayResult.content) {
        assistantContent = gatewayResult.content;
      } else if (typeof gatewayResult === 'string') {
        assistantContent = gatewayResult;
      } else {
        // 如果没有返回响应，生成默认回复
        assistantContent = '消息已发送到 OpenClaw，正在等待响应...';
      }
      console.log(`[AI对话] Gateway 响应: ${assistantContent.slice(0, 100)}...`);
    } catch (gatewayError) {
      console.error('[AI对话] Gateway 调用失败:', gatewayError.message);
      assistantContent = `抱歉，AI 服务暂时不可用: ${gatewayError.message}`;
    }

    const assistantResponse = {
      role: 'assistant',
      content: assistantContent
    };

    let { data: assistantMessage, error: assistantError } = await supabase
      .from('clawbot_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse.content
      })
      .select()
      .single();

    if (assistantError && isSchemaMismatchError(assistantError)) {
      const assistantMessageId = uuidv4();
      await dbRun(
        `INSERT INTO clawbot_messages_local (id, conversation_id, role, content, created_at)
         VALUES (?, ?, 'assistant', ?, CURRENT_TIMESTAMP)`,
        [assistantMessageId, conversationId, assistantResponse.content]
      );
      assistantMessage = await dbGet(
        `SELECT id, role, content, created_at
         FROM clawbot_messages_local
         WHERE id = ?`,
        [assistantMessageId]
      );
      assistantError = null;
    }

    if (assistantError) throw assistantError;

    success(res, {
      id: assistantMessage.id,
      content: assistantMessage.content || '',
      content_type: 'text',
      media_url: null,
      media_mime_type: null,
      timestamp: assistantMessage.created_at || new Date().toISOString(),
      sender: 'bot'
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 删除对话
router.delete('/clawbot/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    let { error } = await supabase
      .from('clawbot_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error && isSchemaMismatchError(error)) {
      await dbRun(
        `DELETE FROM clawbot_messages_local WHERE conversation_id = ?`,
        [id]
      );
      await dbRun(
        `DELETE FROM clawbot_conversations_local WHERE id = ? AND user_id = ?`,
        [id, req.userId]
      );
      error = null;
    }

    if (error) throw error;

    success(res, null, '删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 兼容历史接口：按房间获取聊天历史
router.get('/clawbot/history', authMiddleware, async (req, res) => {
  try {
    const roomId = req.query.room_id || req.query.roomId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    if (!roomId) {
      return error(res, '缺少 room_id', 400);
    }

    const participant = await dbGet(
      `SELECT room_id
       FROM chat_room_participants_local
       WHERE room_id = ? AND user_id = ?`,
      [roomId, req.userId]
    );

    if (!participant) {
      return notFound(res, '你不在该房间中');
    }

    const rows = await dbAll(
      `SELECT id, room_id, sender_id, content, content_type, media_url, media_mime_type, media_duration, created_at
       FROM chat_messages_local
       WHERE room_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );

    const normalized = (rows || []).map((row) => ({
      id: row.id,
      room_id: row.room_id,
      sender_id: row.sender_id,
      sender: row.sender_id === req.userId ? 'user' : 'bot',
      content: row.content || '',
      message_type: row.content_type || 'text',
      media_url: row.media_url || null,
      media_mime_type: row.media_mime_type || null,
      media_duration: row.media_duration || null,
      is_read: true,
      created_at: formatSQLiteDate(row.created_at)
    }));

    success(res, normalized.reverse());
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 学习目标模块 /study/goals
// ============================================

// 获取学习目标列表
router.get('/study/goals', authMiddleware, async (req, res) => {
  try {
    let { data: goals, error } = await supabase
      .from('study_goals')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error && isSchemaMismatchError(error)) {
      goals = await dbAll(
        `SELECT id, user_id, title, description, target_minutes, current_minutes, start_date, end_date, is_completed, created_at, updated_at
         FROM study_goals_local
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.userId]
      );
      error = null;
    }

    if (error) throw error;

    success(res, (goals || []).map((goal) => ({
      ...goal,
      is_completed: Boolean(goal.is_completed),
      created_at: goal.created_at || new Date().toISOString(),
      updated_at: goal.updated_at || goal.created_at || new Date().toISOString()
    })));
  } catch (err) {
    serverError(res, err);
  }
});

// 创建学习目标
router.post('/study/goals', authMiddleware, async (req, res) => {
  try {
    const { title, description, target_minutes, start_date, end_date } = req.body || {};

    let { data: goal, error } = await supabase
      .from('study_goals')
      .insert({
        user_id: req.userId,
        title,
        description,
        target_minutes,
        start_date,
        end_date,
        current_minutes: 0
      })
      .select()
      .single();

    if (error && isSchemaMismatchError(error)) {
      const id = uuidv4();
      const now = new Date().toISOString();
      await dbRun(
        `INSERT INTO study_goals_local (
          id, user_id, title, description, target_minutes, current_minutes, start_date, end_date, is_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)`,
        [id, req.userId, title, description || null, Number(target_minutes || 0), start_date, end_date, now, now]
      );
      goal = await dbGet(
        `SELECT id, user_id, title, description, target_minutes, current_minutes, start_date, end_date, is_completed, created_at, updated_at
         FROM study_goals_local
         WHERE id = ?`,
        [id]
      );
      error = null;
    }

    if (error) throw error;

    success(res, {
      ...goal,
      is_completed: Boolean(goal.is_completed)
    }, '创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 更新学习目标进度
router.put('/study/goals/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      target_minutes,
      current_minutes,
      start_date,
      end_date,
      is_completed
    } = req.body || {};

    const updates = {
      updated_at: new Date().toISOString()
    };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (target_minutes !== undefined) updates.target_minutes = target_minutes;
    if (current_minutes !== undefined) updates.current_minutes = current_minutes;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (is_completed !== undefined) updates.is_completed = is_completed;

    let { data: goal, error } = await supabase
      .from('study_goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error && isSchemaMismatchError(error)) {
      const keys = Object.keys(updates);
      if (keys.length > 0) {
        const setSql = keys.map((key) => `${key} = ?`).join(', ');
        await dbRun(
          `UPDATE study_goals_local
           SET ${setSql}
           WHERE id = ? AND user_id = ?`,
          [...keys.map((key) => updates[key]), id, req.userId]
        );
      }
      goal = await dbGet(
        `SELECT id, user_id, title, description, target_minutes, current_minutes, start_date, end_date, is_completed, created_at, updated_at
         FROM study_goals_local
         WHERE id = ? AND user_id = ?`,
        [id, req.userId]
      );
      error = null;
    }

    if (error) throw error;
    if (!goal) return notFound(res, '目标不存在');

    success(res, {
      ...goal,
      is_completed: Boolean(goal.is_completed)
    }, '更新成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除学习目标
router.delete('/study/goals/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    let { error } = await supabase
      .from('study_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error && isSchemaMismatchError(error)) {
      await dbRun(
        `DELETE FROM study_goals_local WHERE id = ? AND user_id = ?`,
        [id, req.userId]
      );
      error = null;
    }

    if (error) throw error;

    success(res, null, '删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 导出
// ============================================

module.exports = router;
