import { supabase } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import type {
  ChatMessage,
  UnreadCount,
  Notification,
  Mail,
  StudySession,
  FriendLatestMessage,
} from '../config/supabase';

/**
 * 添加好友 (支持邮箱或用户名)
 * @param account 对方账号（邮箱或用户名）
 */
export async function addFriend(account: string): Promise<void> {
  // 兼容旧调用方：统一走好友请求流程，避免直接建立 accepted 关系
  await sendFriendRequest(account);
}

/**
 * 发送好友请求
 * @param account 对方账号（邮箱或用户名）
 */
export async function sendFriendRequest(account: string): Promise<void> {
  try {
    // 1. 查找目标用户 (从 profiles 表)
    const { data: targetProfile, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .or(`email.eq.${account},username.eq.${account}`)
      .single();

    if (userError || !targetProfile) {
      throw new Error('用户不存在');
    }

    const targetUserId = targetProfile.id;

    // 2. 获取当前用户信息
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('请先登录');
    }
    const currentUserId = session.user.id;
    const currentUserEmail = session.user.email;

    if (targetUserId === currentUserId) {
      throw new Error('不能添加自己为好友');
    }

    // 3. 检查双向关系
    const [{ data: outgoing }, { data: incoming }] = await Promise.all([
      supabase
        .from('friends')
        .select('id,status')
        .eq('user_id', currentUserId)
        .eq('friend_id', targetUserId)
        .maybeSingle(),
      supabase
        .from('friends')
        .select('id,status')
        .eq('user_id', targetUserId)
        .eq('friend_id', currentUserId)
        .maybeSingle()
    ]);

    if (outgoing?.status === 'accepted' || incoming?.status === 'accepted') {
      throw new Error('你们已经是好友了');
    }

    if (outgoing?.status === 'pending') {
      throw new Error('好友请求已发送，请等待对方确认');
    }

    // 对方已经给你发过请求：自动互相通过
    if (incoming?.status === 'pending') {
      const { error: acceptError } = await supabase
        .from('friends')
        .upsert([
          { user_id: currentUserId, friend_id: targetUserId, status: 'accepted', updated_at: new Date().toISOString() },
          { user_id: targetUserId, friend_id: currentUserId, status: 'accepted', updated_at: new Date().toISOString() }
        ], {
          onConflict: 'user_id,friend_id',
          ignoreDuplicates: false
        });

      if (acceptError) {
        throw new Error('接受好友请求失败');
      }
      return;
    }

    // 4. 创建 pending 请求记录（仅单向）
    const { error: requestError } = await supabase
      .from('friends')
      .upsert({
        user_id: currentUserId,
        friend_id: targetUserId,
        status: 'pending',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,friend_id',
        ignoreDuplicates: false
      });

    if (requestError) {
      throw new Error('发送好友请求失败');
    }

    // 5. 插入通知（type: friend_request）
    const { error: notifyError } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'friend_request',
        title: '好友请求',
        content: `${currentUserEmail || '某用户'} 想添加你为好友`,
        avatar_url: '',
        is_read: false,
        created_at: new Date().toISOString(),
      });
    if (notifyError) {
      throw new Error('发送好友请求通知失败');
    }
  } catch (error: any) {
    handleGlobalError(error, '发送好友请求失败');
    throw error;
  }
}

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
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('friend_latest_messages')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_time', { ascending: false, nullsFirst: false });

    if (error) {
      handleGlobalError(error, '获取好友列表失败');
      return [];
    }

    return data || [];
  } catch (error) {
    handleGlobalError(error, '获取好友列表失败');
    return [];
  }
}

/** 更新好友在线状态 */
export async function updateFriendStatus(
  friendId: string,
  status: 'online' | 'offline' | 'busy' | 'away'
): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    
    const { error } = await supabase
      .from('friends')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('friend_id', friendId);

    if (error) {
      console.error('更新好友状态失败:', error);
    }
  } catch (error) {
    console.error('更新好友状态失败:', error);
  }
}

/** 更新好友学习状态 */
export async function updateFriendStudyStatus(
  friendId: string,
  isStudying: boolean,
  studyTime?: number
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

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
      .eq('user_id', userId)
      .eq('friend_id', friendId);

    if (error) {
      console.error('更新好友学习状态失败:', error);
    }
  } catch (error) {
    console.error('更新好友学习状态失败:', error);
  }
}

/** 根据 ID 获取好友信息 */
export async function getFriendById(friendId: string): Promise<FriendLatestMessage | null> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('friends')
      .select(`
        friend_id,
        name,
        avatar_url,
        bio,
        study_time,
        is_studying,
        unread_count,
        last_message,
        last_message_time
      `)
      .eq('user_id', userId)
      .eq('friend_id', friendId)
      .single();

    if (error) {
      console.error('获取好友信息失败:', error);
      return null;
    }

    return data as FriendLatestMessage;
  } catch (error) {
    console.error('获取好友信息失败:', error);
    return null;
  }
}

// 聊天记录管理

/** 获取与某个好友的聊天记录 */
export async function getChatHistory(friendId: string): Promise<ChatMessage[]> {
  try {
    const userId = await getCurrentUserId();
    
    // 构建会话ID (较小的UUID在前)
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      handleGlobalError(error, '获取聊天记录失败');
      return [];
    }

    // 转换为旧的数据格式以兼容现有代码
    return (data || []).map(msg => {
      const uiMessage: ChatMessage = {
        id: msg.id,
        friend_id: friendId,
        sender: msg.sender_id === userId ? 'user' : 'friend',
        text: msg.text,
        created_at: msg.created_at
      };

      // Add media fields if present
      if (msg.message_type && msg.message_type !== 'text') {
        uiMessage.message_type = msg.message_type;
        uiMessage.media_uri = msg.media_uri;
        uiMessage.media_type = msg.media_type;
        uiMessage.media_size = msg.media_size;
        uiMessage.media_metadata = msg.media_metadata;
      }

      return uiMessage;
    });
  } catch (error) {
    handleGlobalError(error, '获取聊天记录失败');
    return [];
  }
}

/** 发送消息 */
export async function sendMessage(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    // 构建会话ID
    const conversationId = userId < friendId
      ? `${userId}_${friendId}`
      : `${friendId}_${userId}`;

    // 确定发送者和接收者
    const senderId = sender === 'user' ? userId : friendId;
    const receiverId = sender === 'user' ? friendId : userId;
    
    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text,
      is_read: false
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      handleGlobalError(error, '发送消息失败');
      return null;
    }

    // 更新未读计数
    await updateUnreadCount(receiverId, senderId, text);

    return data?.id || null;
  } catch (error: any) {
    handleGlobalError(error, '发送消息失败');
    return null;
  }
}

/**
 * 📎 发送带媒体附件的消息
 * @param friendId - 好友ID
 * @param sender - 发送者类型
 * @param text - 消息文本（可以为空）
 * @param mediaData - 媒体数据
 * @param messageType - 消息类型 ('image' | 'video' | 'mixed')
 * @returns 消息ID或null
 */
export async function sendMessageWithMedia(
  friendId: string,
  sender: 'user' | 'friend' | 'bot',
  text: string,
  mediaData: {
    uri: string;
    type: string;
    size: number;
    category: 'image' | 'video';
    metadata?: {
      width?: number;
      height?: number;
      duration?: number;
    };
  },
  messageType: 'image' | 'video' | 'mixed'
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    // 构建会话ID
    const conversationId = userId < friendId
      ? `${userId}_${friendId}`
      : `${friendId}_${userId}`;

    // 确定发送者和接收者
    const senderId = sender === 'user' ? userId : friendId;
    const receiverId = sender === 'user' ? friendId : userId;

    const messageData = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text || '', // 允许空文本用于纯媒体消息
      is_read: false,
      message_type: messageType,
      media_uri: mediaData.uri,
      media_type: mediaData.type,
      media_size: mediaData.size,
      media_metadata: mediaData.metadata || null
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('发送媒体消息失败:', error);
      return null;
    }

    // 更新未读计数（使用预览文本）
    const previewText = text || `[${messageType === 'image' ? '图片' : '视频'}]`;
    await updateUnreadCount(receiverId, senderId, previewText);

    return data?.id || null;
  } catch (error: any) {
    console.error('发送媒体消息失败:', error);
    return null;
  }
}

/** 更新未读计数 (内部辅助函数) */
async function updateUnreadCount(
  userId: string,
  friendId: string,
  lastMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('unread_counts')
    .upsert({
      user_id: userId,
      friend_id: friendId,
      unread_count: 1,
      last_message: lastMessage,
      last_message_time: new Date().toISOString()
    }, {
      onConflict: 'user_id,friend_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('更新未读计数失败:', error);
  }
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
  try {
    const userId = await getCurrentUserId();
    
    // 构建会话ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('清空聊天记录失败:', error);
    }
  } catch (error) {
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
export async function subscribeToChatMessages(
  friendId: string,
  callback: (message: ChatMessage) => void
) {
  try {
    const userId = await getCurrentUserId();
    
    // 构建会话ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const msg = payload.new as any;
          // 转换为旧格式
          callback({
            id: msg.id,
            friend_id: friendId,
            sender: msg.sender_id === userId ? 'user' : 'friend',
            text: msg.text,
            created_at: msg.created_at
          } as ChatMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (error) {
    console.error('订阅聊天消息失败:', error);
    return () => {}; // 返回空的清理函数
  }
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
