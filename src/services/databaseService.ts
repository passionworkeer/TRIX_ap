// ============================================
// 🗄️ Supabase 数据库服务 - 替换 localStorage
// ============================================

import { supabase, CURRENT_USER_ID } from '../config/supabase';
import type { 
  Friend, 
  ChatMessage, 
  UnreadCount, 
  Notification, 
  Mail, 
  StudySession,
  FriendLatestMessage,
  UserSession
} from '../config/supabase';

// ============================================
// 好友管理
// ============================================

/**
 * 获取所有好友（包含未读消息信息）
 */
export async function getFriends(): Promise<FriendLatestMessage[]> {
  const { data, error } = await supabase
    .from('friend_latest_messages')
    .select('*')
    .order('last_message_time', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('获取好友列表失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 更新好友在线状态
 */
export async function updateFriendStatus(
  friendId: string, 
  status: 'online' | 'offline' | 'busy' | 'away'
): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('friend_id', friendId);

  if (error) {
    console.error('更新好友状态失败:', error);
  }
}

/**
 * 更新好友学习状态
 */
export async function updateFriendStudyStatus(
  friendId: string,
  isStudying: boolean,
  studyTime?: number
): Promise<void> {
  const updateData: any = { 
    is_studying: isStudying,
    updated_at: new Date().toISOString()
  };
  
  if (studyTime !== undefined) {
    updateData.study_time = studyTime;
  }

  const { error } = await supabase
    .from('friends')
    .update(updateData)
    .eq('friend_id', friendId);

  if (error) {
    console.error('更新好友学习状态失败:', error);
  }
}

// ============================================
// 聊天记录管理
// ============================================

/**
 * 获取与某个好友的聊天记录
 */
export async function getChatHistory(friendId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('friend_id', friendId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('获取聊天记录失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 发送消息（支持用户间真实消息传递）
 */
export async function sendMessage(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string
): Promise<string | null> {
  // 如果是发送给真实用户（friend_id 以 user_ 开头），使用用户消息路由函数
  if (friendId.startsWith('user_')) {
    const { data, error } = await supabase
      .rpc('send_user_message', {
        p_sender_user_id: CURRENT_USER_ID,
        p_recipient_friend_id: friendId,
        p_text: text
      });

    if (error) {
      console.error('发送用户消息失败:', error);
      return null;
    }

    return data;
  }

  // 否则使用原有的消息发送函数（AI bot 等）
  const { data, error } = await supabase
    .rpc('send_message', {
      p_friend_id: friendId,
      p_sender: sender,
      p_text: text
    });

  if (error) {
    console.error('发送消息失败:', error);
    return null;
  }

  return data;
}

/**
 * 标记消息为已读
 */
export async function markMessagesAsRead(friendId: string): Promise<void> {
  const { error } = await supabase
    .rpc('mark_messages_as_read', {
      p_user_id: CURRENT_USER_ID,
      p_friend_id: friendId
    });

  if (error) {
    console.error('标记消息已读失败:', error);
  }
}

/**
 * 清空某个好友的聊天记录
 */
export async function clearChatHistory(friendId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('friend_id', friendId);

  if (error) {
    console.error('清空聊天记录失败:', error);
  }
}

// ============================================
// 未读消息管理
// ============================================

/**
 * 获取所有未读消息计数
 */
export async function getUnreadCounts(): Promise<UnreadCount[]> {
  const { data, error } = await supabase
    .from('unread_counts')
    .select('*')
    .eq('user_id', CURRENT_USER_ID);

  if (error) {
    console.error('获取未读计数失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 获取总未读消息数
 */
export async function getTotalUnreadCount(): Promise<number> {
  const { data, error } = await supabase
    .from('unread_counts')
    .select('unread_count')
    .eq('user_id', CURRENT_USER_ID);

  if (error) {
    console.error('获取总未读数失败:', error);
    return 0;
  }

  return data?.reduce((sum, item) => sum + item.unread_count, 0) || 0;
}

// ============================================
// 通知管理
// ============================================

/**
 * 获取所有通知
 */
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', CURRENT_USER_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取通知失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('标记通知已读失败:', error);
  }
}

/**
 * 删除通知
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('删除通知失败:', error);
  }
}

/**
 * 获取未读通知数量
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', CURRENT_USER_ID)
    .eq('is_read', false);

  if (error) {
    console.error('获取未读通知数失败:', error);
    return 0;
  }

  return count || 0;
}

// ============================================
// 邮件管理
// ============================================

/**
 * 获取所有邮件
 */
export async function getMails(): Promise<Mail[]> {
  const { data, error } = await supabase
    .from('mails')
    .select('*')
    .eq('user_id', CURRENT_USER_ID)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('获取邮件失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 标记邮件为已读
 */
export async function markMailAsRead(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .update({ is_read: true })
    .eq('id', mailId);

  if (error) {
    console.error('标记邮件已读失败:', error);
  }
}

/**
 * 删除邮件
 */
export async function deleteMail(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .delete()
    .eq('id', mailId);

  if (error) {
    console.error('删除邮件失败:', error);
  }
}

/**
 * 获取未读邮件数量
 */
export async function getUnreadMailCount(): Promise<number> {
  const { count, error } = await supabase
    .from('mails')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', CURRENT_USER_ID)
    .eq('is_read', false);

  if (error) {
    console.error('获取未读邮件数失败:', error);
    return 0;
  }

  return count || 0;
}

// ============================================
// 学习记录管理
// ============================================

/**
 * 获取学习记录
 */
export async function getStudySessions(limit?: number): Promise<StudySession[]> {
  let query = supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', CURRENT_USER_ID)
    .order('started_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取学习记录失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 创建学习记录
 */
export async function createStudySession(
  subject: string,
  duration: number,
  startedAt: string,
  endedAt?: string,
  notes?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: CURRENT_USER_ID,
      subject,
      duration,
      started_at: startedAt,
      ended_at: endedAt,
      notes
    })
    .select('id')
    .single();

  if (error) {
    console.error('创建学习记录失败:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * 获取今日学习时长
 */
export async function getTodayStudyTime(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('study_sessions')
    .select('duration')
    .eq('user_id', CURRENT_USER_ID)
    .gte('started_at', today.toISOString());

  if (error) {
    console.error('获取今日学习时长失败:', error);
    return 0;
  }

  return data?.reduce((sum, session) => sum + session.duration, 0) || 0;
}

// ============================================
// 实时订阅
// ============================================

/**
 * 订阅好友消息更新
 */
export function subscribeToChatMessages(
  friendId: string,
  callback: (message: ChatMessage) => void
) {
  const channel = supabase
    .channel(`chat:${friendId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `friend_id=eq.${friendId}`
      },
      (payload) => {
        callback(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * 订阅未读计数更新
 */
export function subscribeToUnreadCounts(
  callback: (unreadCount: UnreadCount) => void
) {
  const channel = supabase
    .channel('unread_counts')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'unread_counts',
        filter: `user_id=eq.${CURRENT_USER_ID}`
      },
      (payload) => {
        callback(payload.new as UnreadCount);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * 订阅通知更新
 */
export function subscribeToNotifications(
  callback: (notification: Notification) => void
) {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${CURRENT_USER_ID}`
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================
// 会话管理（用于个性化 Clawbot 连接）
// ============================================

/**
 * 创建或更新用户会话
 */
export async function createOrUpdateSession(
  deviceInfo: { ip?: string; device?: string; browser?: string },
  clawbotEndpoint: string
): Promise<UserSession | null> {
  const sessionToken = `session_${CURRENT_USER_ID}_${Date.now()}`;
  
  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: CURRENT_USER_ID,
      session_token: sessionToken,
      device_info: deviceInfo,
      clawbot_endpoint: clawbotEndpoint,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('创建会话失败:', error);
    return null;
  }

  return data;
}

/**
 * 获取当前用户的活跃会话
 */
export async function getCurrentSession(): Promise<UserSession | null> {
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', CURRENT_USER_ID)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('获取会话失败:', error);
    return null;
  }

  return data;
}

/**
 * 获取用户的 Clawbot Gateway 端点
 */
export async function getUserClawbotEndpoint(userId?: string): Promise<string | null> {
  const targetUserId = userId || CURRENT_USER_ID;
  
  const { data, error } = await supabase
    .from('user_sessions')
    .select('clawbot_endpoint')
    .eq('user_id', targetUserId)
    .eq('is_active', true)
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    console.warn('未找到 Clawbot 端点，使用默认配置');
    return null;
  }

  return data.clawbot_endpoint;
}

/**
 * 更新会话最后活跃时间
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  const { error } = await supabase
    .from('user_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('更新会话活跃时间失败:', error);
  }
}

/**
 * 停用会话
 */
export async function deactivateSession(sessionToken: string): Promise<void> {
  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('session_token', sessionToken);

  if (error) {
    console.error('停用会话失败:', error);
  }
}
