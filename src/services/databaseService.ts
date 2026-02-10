/**
 * 简单实现：直接让 123@trix.app 和 1234@trix.app 互为好友
 * 只要输入对方邮箱为这两个之一就直接插入互为好友
 */
export async function simpleAddFriend(account: string): Promise<void> {
  // 仅支持 123@trix.app 和 1234@trix.app
  const emails = ['123@trix.app', '1234@trix.app'];
  if (!emails.includes(account)) throw new Error('仅支持测试账号');

  // 获取当前登录用户
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) throw new Error('请先登录');
  const currentUserEmail = session.user.email;
  const currentUserId = session.user.id;

  if (currentUserEmail === account) throw new Error('不能添加自己');

  // 查找对方用户
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, username')
    .in('email', emails);
  if (userError || !users || users.length !== 2) throw new Error('测试账号不全');

  const me = users.find(u => u.email === currentUserEmail);
  const other = users.find(u => u.email === account);
  if (!me || !other) throw new Error('找不到用户');

  // 插入互为好友
  await supabase.from('friends').upsert([
    {
      user_id: me.id,
      friend_id: other.id,
      name: other.username || account,
      status: 'online',
      bio: '',
      study_time: 0,
      is_studying: false,
    },
    {
      user_id: other.id,
      friend_id: me.id,
      name: me.username || currentUserEmail,
      status: 'online',
      bio: '',
      study_time: 0,
      is_studying: false,
    }
  ], { onConflict: 'user_id,friend_id' });
}
/**
 * 发送好友请求
 * @param account 对方账号（邮箱或用户名）
 */
export async function sendFriendRequest(account: string): Promise<void> {
  // 1. 查找目标用户
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, username')
    .or(`email.eq.${account},username.eq.${account}`)
    .single();

  if (userError || !user) {
    throw new Error('未找到该用户');
  }

  // 2. 获取当前用户信息
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error('请先登录');
  }
  const currentUserId = session.user.id;
  const currentUserEmail = session.user.email;

  if (user.id === currentUserId) {
    throw new Error('不能添加自己为好友');
  }

  // 3. 检查是否已是好友
  const { data: existing, error: existError } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', currentUserId)
    .eq('friend_id', user.id)
    .maybeSingle();
  if (existing) {
    throw new Error('你们已经是好友了');
  }

  // 4. 插入通知（type: friend_request）
  const { error: notifyError } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      type: 'friend_request',
      title: '好友请求',
      content: `${currentUserEmail || '某用户'} 想添加你为好友`,
      avatar_url: '',
      is_read: false,
      created_at: new Date().toISOString(),
    });
  if (notifyError) {
    throw new Error('发送好友请求失败');
  }
}
import { supabase } from '../config/supabase';
import type {
  Friend,
  ChatMessage,
  UnreadCount,
  Notification,
  Mail,
  StudySession,
  FriendLatestMessage,
} from '../config/supabase';

// ============================================
// 辅助函数 - 获取当前登录用户 ID
// ============================================

/**
 * 获取当前登录用户的 ID
 * @throws {Error} 如果用户未登录
 * @returns {Promise<string>} 用户 ID
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('获取用户会话失败:', error);
    throw new Error('无法获取用户会话');
  }
  
  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }
  
  return session.user.id;
}

// ============================================
// 好友管理
// ============================================

/** 获取所有好友（包含未读消息信息） */
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

/** 更新好友在线状态 */
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

/** 更新好友学习状态 */
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

// 聊天记录管理

/** 获取与某个好友的聊天记录 */
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

/** 发送消息 */
export async function sendMessage(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string
): Promise<string | null> {
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

/** 标记消息为已读 */
export async function markMessagesAsRead(friendId: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    const { error } = await supabase
      .rpc('mark_messages_as_read', {
        p_user_id: userId,
        p_friend_id: friendId
      });

    if (error) {
      console.error('标记消息已读失败:', error);
    }
  } catch (error) {
    console.error('标记消息已读失败:', error);
  }
}

/** 清空某个好友的聊天记录 */
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

/** 获取所有未读消息计数 */
export async function getUnreadCounts(): Promise<UnreadCount[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('unread_counts')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('获取未读计数失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('获取未读计数失败:', error);
    return [];
  }
}

/** 获取总未读消息数 */
export async function getTotalUnreadCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('unread_counts')
      .select('unread_count')
      .eq('user_id', userId);

    if (error) {
      console.error('获取总未读数失败:', error);
      return 0;
    }

    return data?.reduce((sum, item) => sum + item.unread_count, 0) || 0;
  } catch (error) {
    console.error('获取总未读数失败:', error);
    return 0;
  }
}

// ============================================
// 通知管理
// ============================================

/** 获取所有通知 */
export async function getNotifications(): Promise<Notification[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取通知失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('获取通知失败:', error);
    return [];
  }
}

/** 标记通知为已读 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('标记通知已读失败:', error);
  }
}

/** 删除通知 */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('删除通知失败:', error);
  }
}

/** 获取未读通知数量 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('获取未读通知数失败:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('获取未读通知数失败:', error);
    return 0;
  }
}

// ============================================
// 邮件管理
// ============================================

/** 获取所有邮件 */
export async function getMails(): Promise<Mail[]> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('mails')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取邮件失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('获取邮件失败:', error);
    return [];
  }
}

/** 标记邮件为已读 */
export async function markMailAsRead(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .update({ is_read: true })
    .eq('id', mailId);

  if (error) {
    console.error('标记邮件已读失败:', error);
  }
}

/** 删除邮件 */
export async function deleteMail(mailId: string): Promise<void> {
  const { error } = await supabase
    .from('mails')
    .delete()
    .eq('id', mailId);

  if (error) {
    console.error('删除邮件失败:', error);
  }
}

/** 获取未读邮件数量 */
export async function getUnreadMailCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    
    const { count, error } = await supabase
      .from('mails')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('获取未读邮件数失败:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('获取未读邮件数失败:', error);
    return 0;
  }
}

// ============================================
// 学习记录管理
// ============================================

/** 获取学习记录 */
export async function getStudySessions(limit?: number): Promise<StudySession[]> {
  try {
    const userId = await getCurrentUserId();
    
    let query = supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
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
  } catch (error) {
    console.error('获取学习记录失败:', error);
    return [];
  }
}

/** 创建学习记录 */
export async function createStudySession(
  subject: string,
  duration: number,
  startedAt: string,
  endedAt?: string,
  notes?: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
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
  } catch (error) {
    console.error('创建学习记录失败:', error);
    return null;
  }
}

/** 获取今日学习时长 */
export async function getTodayStudyTime(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('study_sessions')
      .select('duration')
      .eq('user_id', userId)
      .gte('started_at', today.toISOString());

    if (error) {
      console.error('获取今日学习时长失败:', error);
      return 0;
    }

    return data?.reduce((sum, session) => sum + session.duration, 0) || 0;
  } catch (error) {
    console.error('获取今日学习时长失败:', error);
    return 0;
  }
}

// ============================================
// 实时订阅
// ============================================

/** 订阅好友消息更新 */
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

/** 订阅未读计数更新 */
export async function subscribeToUnreadCounts(
  callback: (unreadCount: UnreadCount) => void
) {
  try {
    const userId = await getCurrentUserId();
    
    const channel = supabase
      .channel('unread_counts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unread_counts',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as UnreadCount);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('订阅未读计数更新失败:', error);
    return () => {}; // 返回空的清理函数
  }
}

/** 订阅通知更新 */
export async function subscribeToNotifications(
  callback: (notification: Notification) => void
) {
  try {
    const userId = await getCurrentUserId();
    
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('订阅通知更新失败:', error);
    return () => {}; // 返回空的清理函数
  }
}
