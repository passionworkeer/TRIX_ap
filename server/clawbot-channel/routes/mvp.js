// ============================================
// MVP API 路由
// 用户、好友、日程、待办、成就、商城、衣柜、学习历史
// ============================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

// ============================================
// 通用响应格式
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

// ============================================
// 用户模块 /user
// ============================================

// 获取用户资料
router.get('/user/profile', authMiddleware, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error) throw error;
    if (!profile) return notFound(res, '用户资料不存在');

    success(res, profile);
  } catch (err) {
    serverError(res, err);
  }
});

// 更新用户资料
router.put('/user/profile', authMiddleware, async (req, res) => {
  try {
    const { username, full_name, bio, school, grade, avatar_url } = req.body;

    const updates = {};
    if (username) updates.username = username;
    if (full_name !== undefined) updates.full_name = full_name;
    if (bio !== undefined) updates.bio = bio;
    if (school !== undefined) updates.school = school;
    if (grade !== undefined) updates.grade = grade;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    updates.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;
    success(res, profile);
  } catch (err) {
    serverError(res, err);
  }
});

// 更新用户头像
router.post('/user/avatar', authMiddleware, async (req, res) => {
  try {
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return error(res, '请提供头像URL');
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    success(res, profile, '头像更新成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取用户统计
router.get('/user/stats', authMiddleware, async (req, res) => {
  try {
    // 获取用户资料
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (profileError) throw profileError;

    // 获取积分
    const { data: points } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    // 获取学习次数
    const { count: sessionCount } = await supabase
      .from('study_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    // 获取好友数
    const { count: friendCount } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    // 获取成就数
    const { count: achievementCount } = await supabase
      .from('user_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    const stats = {
      totalStudyTime: profile?.total_study_time || 0,
      sessionCount: sessionCount || 0,
      daysActive: profile?.days_active || 0,
      currentStreak: profile?.current_streak || 0,
      points: points?.total_points || profile?.points || 0,
      level: points?.level || 1,
      friendCount: friendCount || 0,
      achievementCount: achievementCount || 0
    };

    success(res, stats);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 好友模块 /friends
// ============================================

// 获取好友列表
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    success(res, data || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 添加好友
router.post('/friends', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return error(res, '缺少 friendId');

    // 获取好友资料
    const { data: friendProfile, error: friendError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio')
      .eq('id', friendId)
      .single();

    if (friendError || !friendProfile) {
      return notFound(res, '用户不存在');
    }

    // 检查是否已经是好友
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', req.userId)
      .eq('friend_id', friendId)
      .single();

    if (existing) {
      return error(res, '已经是好友了');
    }

    // 获取当前用户资料
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('username, full_name, avatar_url, bio')
      .eq('id', req.userId)
      .single();

    // 创建双向好友关系
    const now = new Date().toISOString();
    const friendsData = [
      { user_id: req.userId, friend_id: friendId, name: friendProfile.full_name || friendProfile.username, avatar_url: friendProfile.avatar_url, bio: friendProfile.bio, status: 'offline', study_time: 0, is_studying: false, updated_at: now },
      { user_id: friendId, friend_id: req.userId, name: myProfile?.full_name || myProfile?.username, avatar_url: myProfile?.avatar_url, bio: myProfile?.bio, status: 'offline', study_time: 0, is_studying: false, updated_at: now }
    ];

    const { error: insertError } = await supabase
      .from('friends')
      .upsert(friendsData, { onConflict: 'user_id,friend_id' });

    if (insertError) throw insertError;
    success(res, null, '添加成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除好友
router.delete('/friends/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取好友的 friend_id
    const { data: friend, error: friendError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (friendError || !friend) return notFound(res, '好友不存在');

    // 删除双向关系
    await supabase.from('friends').delete().eq('user_id', req.userId).eq('friend_id', friend.friend_id);
    await supabase.from('friends').delete().eq('user_id', friend.friend_id).eq('friend_id', req.userId);

    success(res, null, '删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取好友请求
router.get('/friends/requests', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        *,
        from_user:from_user_id(id, username, full_name, avatar_url)
      `)
      .eq('to_user_id', req.userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 格式化返回
    const requests = (data || []).map(r => ({
      id: r.id,
      fromUserId: r.from_user_id,
      fromUsername: r.from_user?.username || '',
      fromAvatarUrl: r.from_user?.avatar_url || null,
      toUserId: r.to_user_id,
      status: r.status,
      createdAt: r.created_at
    }));

    success(res, requests);
  } catch (err) {
    serverError(res, err);
  }
});

// 接受好友请求
router.post('/friends/requests/:id/accept', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取请求
    const { data: request, error: requestError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('id', id)
      .eq('to_user_id', req.userId)
      .single();

    if (requestError || !request) return notFound(res, '好友请求不存在');

    // 获取当前用户资料
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    // 获取请求者资料
    const { data: fromProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', request.from_user_id)
      .single();

    const now = new Date().toISOString();

    // 创建双向好友关系
    const friendsData = [
      { user_id: req.userId, friend_id: request.from_user_id, name: fromProfile?.full_name || fromProfile?.username, avatar_url: fromProfile?.avatar_url, bio: fromProfile?.bio, status: 'offline', study_time: 0, is_studying: false, updated_at: now },
      { user_id: request.from_user_id, friend_id: req.userId, name: myProfile?.full_name || myProfile?.username, avatar_url: myProfile?.avatar_url, bio: myProfile?.bio, status: 'offline', study_time: 0, is_studying: false, updated_at: now }
    ];

    await supabase.from('friends').upsert(friendsData, { onConflict: 'user_id,friend_id' });

    // 更新请求状态
    await supabase.from('friend_requests').update({ status: 'accepted', updated_at: now }).eq('id', id);

    success(res, null, '已接受好友请求');
  } catch (err) {
    serverError(res, err);
  }
});

// 拒绝好友请求
router.post('/friends/requests/:id/decline', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('to_user_id', req.userId);

    if (error) throw error;
    success(res, null, '已拒绝好友请求');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 日程模块 /schedules
// ============================================

// 获取日程列表
router.get('/schedules', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', req.userId)
      .order('start_time', { ascending: true });

    if (error) throw error;
    success(res, data || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建日程
router.post('/schedules', authMiddleware, async (req, res) => {
  try {
    const { title, description, start_time, end_time, location, reminder_minutes_before } = req.body;

    if (!title || !start_time) return error(res, '缺少必需字段');

    const { data, error } = await supabase
      .from('schedules')
      .insert({
        user_id: req.userId,
        title,
        description,
        start_time,
        end_time,
        location,
        reminder_minutes_before,
        sync_status: 'synced'
      })
      .select()
      .single();

    if (error) throw error;
    success(res, data, '日程创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 更新日程
router.put('/schedules/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_time, end_time, location, reminder_minutes_before } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (start_time) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (location !== undefined) updates.location = location;
    if (reminder_minutes_before !== undefined) updates.reminder_minutes_before = reminder_minutes_before;

    const { data, error } = await supabase
      .from('schedules')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return notFound(res, '日程不存在');
    success(res, data, '日程更新成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除日程
router.delete('/schedules/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;
    success(res, null, '日程删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 按日期范围查询日程
router.get('/schedules/range', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return error(res, '缺少 start 或 end 参数');

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', req.userId)
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time', { ascending: true });

    if (error) throw error;
    success(res, data || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 获取即将到来的日程
router.get('/schedules/upcoming', authMiddleware, async (req, res) => {
  try {
    const minutes = parseInt(req.query.minutes) || 30;
    const now = new Date();
    const future = new Date(now.getTime() + minutes * 60000);

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', req.userId)
      .gte('start_time', now.toISOString())
      .lte('start_time', future.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;
    success(res, data || []);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 待办模块 /todos
// ============================================

// 获取待办列表
router.get('/todos', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    success(res, data || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建待办
router.post('/todos', authMiddleware, async (req, res) => {
  try {
    const { title, description, due_date, priority, tags } = req.body;
    if (!title) return error(res, '缺少标题');

    const { data, error } = await supabase
      .from('todos')
      .insert({
        user_id: req.userId,
        title,
        description,
        due_date,
        priority: priority || 1,
        tags: tags || []
      })
      .select()
      .single();

    if (error) throw error;
    success(res, data, '待办创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 更新待办
router.put('/todos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, is_completed, due_date, priority, tags } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (is_completed !== undefined) updates.is_completed = is_completed;
    if (due_date !== undefined) updates.due_date = due_date;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = tags;

    const { data, error } = await supabase
      .from('todos')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return notFound(res, '待办不存在');
    success(res, data, '待办更新成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除待办
router.delete('/todos/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) throw error;
    success(res, null, '待办删除成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 切换待办完成状态
router.post('/todos/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取当前状态
    const { data: todo, error: getError } = await supabase
      .from('todos')
      .select('is_completed')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (getError || !todo) return notFound(res, '待办不存在');

    // 切换状态
    const { data, error } = await supabase
      .from('todos')
      .update({ is_completed: !todo.is_completed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    success(res, data);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 成就模块 /achievements
// ============================================

// 获取成就列表（含用户解锁状态）
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    // 获取所有成就
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .order('rarity', { ascending: true });

    // 获取用户已解锁成就
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', req.userId);

    const unlockedMap = new Map((userAchievements || []).map(ua => [ua.achievement_id, ua.unlocked_at]));

    // 合并数据
    const result = (achievements || []).map(a => ({
      id: a.id,
      name: a.name,
      nameEn: a.name_en,
      description: a.description,
      icon: a.icon,
      category: a.category,
      requirement: a.requirement,
      type: a.type,
      rarity: a.rarity,
      unlockedAt: unlockedMap.get(a.id) || null
    }));

    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// 检查并解锁成就
router.post('/achievements/check', authMiddleware, async (req, res) => {
  try {
    // 获取用户统计
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_study_time, current_streak')
      .eq('id', req.userId)
      .single();

    const { count: totalSessions } = await supabase
      .from('study_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId);

    const { count: friendsCount } = await supabase
      .from('study_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .not('companion_id', 'is', null);

    // 获取最长单次专注
    const { data: longestSession } = await supabase
      .from('study_sessions')
      .select('duration_minutes')
      .eq('user_id', req.userId)
      .order('duration_minutes', { ascending: false })
      .limit(1)
      .single();

    const stats = {
      total_minutes: profile?.total_study_time || 0,
      daily_streak: profile?.current_streak || 0,
      total_sessions: totalSessions || 0,
      friends_studied_count: friendsCount || 0,
      longest_single_session: longestSession?.duration_minutes || 0
    };

    // 获取所有成就和已解锁的
    const { data: achievements } = await supabase.from('achievements').select('*');
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', req.userId);

    const unlockedIds = new Set((userAchievements || []).map(ua => ua.achievement_id));
    const newlyUnlocked = [];

    for (const achievement of achievements || []) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;
      switch (achievement.type) {
        case 'total_minutes':
          shouldUnlock = stats.total_minutes >= achievement.requirement;
          break;
        case 'single_session':
          shouldUnlock = stats.longest_single_session >= achievement.requirement;
          break;
        case 'daily_streak':
          shouldUnlock = stats.daily_streak >= achievement.requirement;
          break;
        case 'total_sessions':
          shouldUnlock = stats.total_sessions >= achievement.requirement;
          break;
        case 'friends_studied':
          shouldUnlock = stats.friends_studied_count >= achievement.requirement;
          break;
      }

      if (shouldUnlock) {
        await supabase.from('user_achievements').insert({
          user_id: req.userId,
          achievement_id: achievement.id
        });
        newlyUnlocked.push(achievement);
      }
    }

    // 获取更新后的成就列表
    const { data: updatedUserAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', req.userId);

    success(res, {
      newlyUnlocked,
      totalUnlocked: (updatedUserAchievements || []).length
    });
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 商城模块 /mall
// ============================================

// 获取商品列表
router.get('/mall/items', optionalAuthMiddleware, async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('mall_items')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: items, error } = await query;

    if (error) throw error;

    // 如果已登录，获取用户已购买的商品
    let ownedIds = new Set();
    if (req.userId) {
      const { data: purchased } = await supabase
        .from('user_purchased_items')
        .select('item_id')
        .eq('user_id', req.userId);

      ownedIds = new Set((purchased || []).map(p => p.item_id));
    }

    const result = (items || []).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      image: item.image_url,
      price: item.price,
      category: item.category,
      isOwned: ownedIds.has(item.id)
    }));

    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// 获取单个商品
router.get('/mall/items/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from('mall_items')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) throw error;
    if (!item) return notFound(res, '商品不存在');

    // 检查是否已购买
    let isOwned = false;
    if (req.userId) {
      const { data: purchased } = await supabase
        .from('user_purchased_items')
        .select('id')
        .eq('user_id', req.userId)
        .eq('item_id', id)
        .single();

      isOwned = !!purchased;
    }

    success(res, { ...item, is_owned: isOwned });
  } catch (err) {
    serverError(res, err);
  }
});

// 购买商品
router.post('/mall/purchase', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.body;
    if (!itemId) return error(res, '缺少商品ID');

    // 获取商品
    const { data: item, error: itemError } = await supabase
      .from('mall_items')
      .select('*')
      .eq('id', itemId)
      .eq('is_active', true)
      .single();

    if (itemError || !item) return notFound(res, '商品不存在');

    // 检查是否已购买
    const { data: existing } = await supabase
      .from('user_purchased_items')
      .select('id')
      .eq('user_id', req.userId)
      .eq('item_id', itemId)
      .single();

    if (existing) return error(res, '您已拥有此商品');

    // 获取用户积分
    const { data: points, error: pointsError } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', req.userId)
      .single();

    const userPoints = points?.total_points || 0;

    if (userPoints < item.price) {
      return error(res, '积分不足');
    }

    // 扣除积分
    await supabase
      .from('user_points')
      .update({
        total_points: userPoints - item.price,
        total_spent: (points?.total_spent || 0) + item.price,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.userId);

    // 添加购买记录
    await supabase.from('user_purchased_items').insert({
      user_id: req.userId,
      item_id: itemId
    });

    // 添加积分消费记录
    await supabase.from('points_transactions').insert({
      user_id: req.userId,
      amount: -item.price,
      type: 'spend',
      description: `购买商品: ${item.name}`,
      related_item_id: itemId
    });

    // 添加购买历史
    await supabase.from('purchase_history').insert({
      user_id: req.userId,
      item_id: itemId,
      points_spent: item.price
    });

    success(res, {
      success: true,
      message: '购买成功',
      remainingPoints: userPoints - item.price,
      item: { ...item, isOwned: true }
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 获取购买历史
router.get('/mall/purchase/history', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('purchase_history')
      .select(`
        *,
        item:item_id(id, name, description, image_url, price, category)
      `)
      .eq('user_id', req.userId)
      .order('purchased_at', { ascending: false });

    if (error) throw error;

    const result = (data || []).map(h => ({
      id: h.id,
      item: h.item ? {
        id: h.item.id,
        name: h.item.name,
        description: h.item.description,
        image: h.item.image_url,
        price: h.item.price,
        category: h.item.category
      } : null,
      purchasedAt: h.purchased_at,
      pointsSpent: h.points_spent
    }));

    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 衣柜模块 /wardrobe
// ============================================

// 获取装扮列表
router.get('/wardrobe/outfits', authMiddleware, async (req, res) => {
  try {
    // 获取所有装扮
    const { data: outfits } = await supabase
      .from('outfits')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    // 获取用户拥有的装扮
    const { data: userOutfits } = await supabase
      .from('user_outfits')
      .select('outfit_id, is_equipped')
      .eq('user_id', req.userId);

    const ownedMap = new Map((userOutfits || []).map(uo => [uo.outfit_id, uo.is_equipped]));

    const result = (outfits || []).map(o => ({
      id: o.id,
      name: o.name,
      category: o.category,
      image: o.image_url,
      previewImage: o.preview_image_url || o.image_url,
      isOwned: ownedMap.has(o.id),
      isEquipped: ownedMap.get(o.id) || false,
      description: o.description,
      price: o.price
    }));

    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// 装备装扮
router.post('/wardrobe/outfits/:id/equip', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否拥有
    const { data: owned } = await supabase
      .from('user_outfits')
      .select('id')
      .eq('user_id', req.userId)
      .eq('outfit_id', id)
      .single();

    if (!owned) return error(res, '您未拥有此装扮');

    // 获取装扮类别
    const { data: outfit, error: outfitError } = await supabase
      .from('outfits')
      .select('category')
      .eq('id', id)
      .single();

    if (outfitError || !outfit) return notFound(res, '装扮不存在');

    // 先卸下同类别装扮
    const { data: sameCategory } = await supabase
      .from('user_outfits')
      .select('outfit_id')
      .eq('user_id', req.userId)
      .eq('is_equipped', true);

    for (const sc of sameCategory || []) {
      const { data: scOutfit } = await supabase
        .from('outfits')
        .select('category')
        .eq('id', sc.outfit_id)
        .single();

      if (scOutfit?.category === outfit.category) {
        await supabase
          .from('user_outfits')
          .update({ is_equipped: false })
          .eq('user_id', req.userId)
          .eq('outfit_id', sc.outfit_id);
      }
    }

    // 装备新装扮
    await supabase
      .from('user_outfits')
      .update({ is_equipped: true })
      .eq('user_id', req.userId)
      .eq('outfit_id', id);

    success(res, { success: true, message: '装备成功' });
  } catch (err) {
    serverError(res, err);
  }
});

// 卸下装扮
router.post('/wardrobe/outfits/:id/unequip', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await supabase
      .from('user_outfits')
      .update({ is_equipped: false })
      .eq('user_id', req.userId)
      .eq('outfit_id', id);

    success(res, { success: true, message: '卸下成功' });
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 学习历史模块 /study/history
// ============================================

// 每日学习汇总
router.get('/study/history/daily', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 获取学习会话
    const { data: sessions } = await supabase
      .from('study_sessions')
      .select('started_at, duration_minutes')
      .eq('user_id', req.userId)
      .gte('started_at', startDate.toISOString());

    // 按天汇总
    const dailyMap = new Map();
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, { date: key, totalMinutes: 0, sessionsCount: 0, longestSession: 0 });
    }

    for (const session of sessions || []) {
      const date = session.started_at.split('T')[0];
      const day = dailyMap.get(date);
      if (day) {
        day.totalMinutes += session.duration_minutes || 0;
        day.sessionsCount += 1;
        day.longestSession = Math.max(day.longestSession, session.duration_minutes || 0);
        day.averageDuration = day.sessionsCount > 0 ? Math.round(day.totalMinutes / day.sessionsCount) : 0;
      }
    }

    const result = Array.from(dailyMap.values()).reverse();
    success(res, result);
  } catch (err) {
    serverError(res, err);
  }
});

// 每周学习汇总
router.get('/study/history/weekly', authMiddleware, async (req, res) => {
  try {
    // 获取过去4周的数据
    const weeks = 4;
    const weekSummaries = [];

    for (let w = 0; w < weeks; w++) {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('started_at, duration_minutes')
        .eq('user_id', req.userId)
        .gte('started_at', weekStart.toISOString())
        .lt('started_at', weekEnd.toISOString());

      const totalMinutes = (sessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const sessionsCount = (sessions || []).length;
      const dailyAverage = sessionsCount > 0 ? Math.round(totalMinutes / 7) : 0;
      const longestSession = Math.max(0, ...(sessions || []).map(s => s.duration_minutes || 0));

      // 找出最佳一天
      const dayMap = new Map();
      for (const session of sessions || []) {
        const date = session.started_at.split('T')[0];
        dayMap.set(date, (dayMap.get(date) || 0) + (session.duration_minutes || 0));
      }
      let bestDay = { date: '', minutes: 0 };
      for (const [date, minutes] of dayMap) {
        if (minutes > bestDay.minutes) bestDay = { date, minutes };
      }

      // 计算连续学习天数
      let streakDays = 0;
      const sortedDays = Array.from(dayMap.keys()).sort().reverse();
      for (const day of sortedDays) {
        if (dayMap.get(day) > 0) streakDays++;
        else break;
      }

      weekSummaries.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        totalMinutes,
        sessionsCount,
        dailyAverage,
        bestDay,
        streakDays
      });
    }

    success(res, weekSummaries.reverse());
  } catch (err) {
    serverError(res, err);
  }
});

// 每月学习汇总
router.get('/study/history/monthly', authMiddleware, async (req, res) => {
  try {
    const months = 3;
    const monthSummaries = [];

    for (let m = 0; m < months; m++) {
      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - m, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('started_at, duration_minutes')
        .eq('user_id', req.userId)
        .gte('started_at', monthStart.toISOString())
        .lt('started_at', monthEnd.toISOString());

      const totalMinutes = (sessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const sessionsCount = (sessions || []).length;
      const daysInMonth = monthEnd.getDate();
      const dailyAverage = sessionsCount > 0 ? Math.round(totalMinutes / daysInMonth) : 0;

      monthSummaries.push({
        month: monthStart.toISOString().slice(0, 7),
        year: monthStart.getFullYear(),
        totalMinutes,
        sessionsCount,
        dailyAverage,
        weeklyBreakdown: [],
        longestStreak: 0
      });
    }

    success(res, monthSummaries.reverse());
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 用户设置模块
// ============================================

// 获取用户设置
router.get('/user/settings', authMiddleware, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.userId)
      .single();

    // 返回用户的应用设置
    const settings = {
      notifications: {
        enabled: true,
        study_reminder: true,
        friend_request: true,
        system_notification: true
      },
      privacy: {
        show_online_status: true,
        allow_friend_requests: true,
        share_location: false
      },
      display: {
        theme: 'system',
        language: 'zh-Hans'
      },
      profile: profile || {}
    };

    success(res, settings);
  } catch (err) {
    serverError(res, err);
  }
});

// 更新用户设置
router.put('/user/settings', authMiddleware, async (req, res) => {
  try {
    const { notifications, privacy, display } = req.body;

    // 这里可以扩展为保存到专门的设置表
    // 暂时只返回更新后的设置
    const settings = {
      notifications: notifications || {},
      privacy: privacy || {},
      display: display || {}
    };

    success(res, settings, '设置已更新');
  } catch (err) {
    serverError(res, err);
  }
});

// ============================================
// 成就解锁
// ============================================

// 解锁成就
router.post('/achievements/:id/unlock', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查成就是否存在
    const { data: achievement } = await supabase
      .from('achievements')
      .select('*')
      .eq('id', id)
      .single();

    if (!achievement) {
      return notFound(res, '成就不存在');
    }

    // 检查是否已经解锁
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', req.userId)
      .eq('achievement_id', id)
      .single();

    if (existing) {
      return error(res, '成就已经解锁');
    }

    // 解锁成就
    const { data: userAchievement, error: unlockError } = await supabase
      .from('user_achievements')
      .insert({
        user_id: req.userId,
        achievement_id: id,
        unlocked_at: new Date().toISOString()
      })
      .select()
      .single();

    if (unlockError) throw unlockError;

    // 奖励积分
    if (achievement.points > 0) {
      await addPoints(req.userId, achievement.points, 'bonus', `成就: ${achievement.name}`);
    }

    success(res, { ...achievement, user_achievement: userAchievement }, '成就解锁成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 辅助函数: 增加积分
async function addPoints(userId, amount, type, reason) {
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
        total_earned: existingPoints.total_earned + amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_points')
      .insert({
        user_id: userId,
        total_points: amount,
        total_earned: amount
      });
  }

  await supabase
    .from('points_transactions')
    .insert({
      user_id: userId,
      amount,
      type,
      reason
    });
}

// ============================================
// 导出路由
// ============================================

module.exports = router;
