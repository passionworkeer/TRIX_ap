// ============================================
// 补充 API 路由
// 未读计数、AI对话、学习目标
// ============================================

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
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
      total: totalUnread
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

    success(res, count || { unread_count: 0 });
  } catch (err) {
    serverError(res, err);
  }
});

// 更新未读计数
router.put('/unread/counts/:friendId', authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;
    const { unread_count, last_message, last_message_at } = req.body;

    const { data: count, error } = await supabase
      .from('unread_counts')
      .upsert({
        user_id: req.userId,
        friend_id: friendId,
        unread_count: unread_count || 0,
        last_message,
        last_message_at: last_message_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,friend_id' })
      .select()
      .single();

    if (error) throw error;

    success(res, count);
  } catch (err) {
    serverError(res, err);
  }
});

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
    const { data: conversations, error } = await supabase
      .from('clawbot_conversations')
      .select('*')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    success(res, conversations || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建对话
router.post('/clawbot/conversations', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;

    const { data: conversation, error } = await supabase
      .from('clawbot_conversations')
      .insert({
        user_id: req.userId,
        title: title || '新对话'
      })
      .select()
      .single();

    if (error) throw error;

    success(res, conversation, '创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 获取对话消息
router.get('/clawbot/conversations/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // 验证对话属于用户
    const { data: conversation } = await supabase
      .from('clawbot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.userId)
      .single();

    if (!conversation) {
      return notFound(res, '对话不存在');
    }

    const { data: messages, error } = await supabase
      .from('clawbot_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    success(res, messages || []);
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
    const { data: conversation } = await supabase
      .from('clawbot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', req.userId)
      .single();

    if (!conversation) {
      return notFound(res, '对话不存在');
    }

    // 保存用户消息
    const { data: userMessage, error: userError } = await supabase
      .from('clawbot_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content
      })
      .select()
      .single();

    if (userError) throw userError;

    // 更新对话时间
    await supabase
      .from('clawbot_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

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

    const { data: assistantMessage, error: assistantError } = await supabase
      .from('clawbot_messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantResponse.content
      })
      .select()
      .single();

    if (assistantError) throw assistantError;

    success(res, {
      user_message: userMessage,
      assistant_message: assistantMessage
    });
  } catch (err) {
    serverError(res, err);
  }
});

// 删除对话
router.delete('/clawbot/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('clawbot_conversations')
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
// 学习目标模块 /study/goals
// ============================================

// 获取学习目标列表
router.get('/study/goals', authMiddleware, async (req, res) => {
  try {
    const { data: goals, error } = await supabase
      .from('study_goals')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    success(res, goals || []);
  } catch (err) {
    serverError(res, err);
  }
});

// 创建学习目标
router.post('/study/goals', authMiddleware, async (req, res) => {
  try {
    const { title, target_minutes, start_date, end_date } = req.body;

    const { data: goal, error } = await supabase
      .from('study_goals')
      .insert({
        user_id: req.userId,
        title,
        target_minutes,
        start_date,
        end_date,
        current_minutes: 0
      })
      .select()
      .single();

    if (error) throw error;

    success(res, goal, '创建成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 更新学习目标进度
router.put('/study/goals/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_minutes, is_completed } = req.body;

    const { data: goal, error } = await supabase
      .from('study_goals')
      .update({
        current_minutes,
        is_completed,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!goal) return notFound(res, '目标不存在');

    success(res, goal, '更新成功');
  } catch (err) {
    serverError(res, err);
  }
});

// 删除学习目标
router.delete('/study/goals/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('study_goals')
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
// 导出
// ============================================

module.exports = router;
