/**
 * 添加好友 (支持邮箱或用户名)
 * @param account 对方账号（邮箱或用户名）
 */
export async function addFriend(account: string): Promise<void> {
  try {
    // 1. 获取当前登录用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('请先登录');
    
    const currentUserId = user.id;

    // 2. 从 profiles 表查找目标用户（支持邮箱或用户名）
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id')
      .or(`email.eq.${account},username.eq.${account}`)
      .single();

    if (targetError || !targetProfile) {
      throw new Error('用户不存在');
    }

    const targetUserId = targetProfile.id;

    // 3. 不能添加自己
    if (targetUserId === currentUserId) {
      throw new Error('不能添加自己为好友');
    }

    // 4. 检查是否已是好友
    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('friend_id', targetUserId)
      .maybeSingle();
    
    if (existing) {
      throw new Error('你们已经是好友了');
    }

    // 5. 插入双向好友关系（只写必要字段）
    const { error: insertError } = await supabase.from('friends').insert([
      {
        user_id: currentUserId,
        friend_id: targetUserId,
        status: 'accepted'
      },
      {
        user_id: targetUserId,
        friend_id: currentUserId,
        status: 'accepted'
      }
    ]);

    if (insertError) {
      console.error('添加好友失败:', insertError);
      throw new Error('添加好友失败: ' + insertError.message);
    }

  } catch (error: any) {
    console.error('添加好友错误:', error);
    throw error;
  }
}

/**
 * 简单实现：直接让 123@trix.app 和 1234@trix.app 互为好友
 * 只要输入对方邮箱为这两个之一就直接插入互为好友
 * @deprecated 使用 addFriend 代替
 */
export async function simpleAddFriend(account: string): Promise<void> {
  // 直接调用新的通用函数
  return addFriend(account);
}
/**
 * 发送好友请求
 * @param account 对方账号（邮箱或用户名）
 */
export async function sendFriendRequest(account: string): Promise<void> {
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

  // 3. 检查是否已是好友
  const { data: existing, error: existError } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', currentUserId)
    .eq('friend_id', targetUserId)
    .maybeSingle();
  if (existing) {
    throw new Error('你们已经是好友了');
  }

  // 4. 插入通知（type: friend_request）
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
  try {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('friend_latest_messages')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_time', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('获取好友列表失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('获取好友列表失败:', error);
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
      console.error('获取聊天记录失败:', error);
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
    console.error('获取聊天记录失败:', error);
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
    
    console.log('🚀 [发送消息] 开始:', {
      userId: userId.substring(0, 8) + '...',
      friendId: friendId.substring(0, 8) + '...',
      sender,
      textLength: text.length
    });
    
    // 构建会话ID
    const conversationId = userId < friendId 
      ? `${userId}_${friendId}` 
      : `${friendId}_${userId}`;
    
    console.log('📦 [会话ID]:', conversationId);
    
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
    
    console.log('📨 [消息数据]:', {
      ...messageData,
      sender_id: messageData.sender_id.substring(0, 8) + '...',
      receiver_id: messageData.receiver_id.substring(0, 8) + '...',
      text: messageData.text.substring(0, 30) + '...'
    });
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ [发送失败] Supabase 错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // 检查是否是 RLS 权限问题
      if (error.code === '42501' || error.message.includes('policy')) {
        console.error('🔒 [RLS 策略错误] 数据库权限被拒绝！');
        console.error('💡 解决方案: 检查 chat_messages 表的 RLS 策略配置');
      }
      
      // 检查是否是表不存在或字段不匹配
      if (error.code === '42P01') {
        console.error('📋 [表不存在] chat_messages 表未找到！');
      } else if (error.code === '42703') {
        console.error('📋 [字段错误] 表结构不匹配！可能需要运行 complete-init.sql');
      }
      
      return null;
    }

    console.log('✅ [发送成功] 消息ID:', data?.id);
    
    // 更新未读计数
    await updateUnreadCount(receiverId, senderId, text);

    return data?.id || null;
  } catch (error: any) {
    console.error('❌ [发送失败] 捕获异常:', {
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });
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

    console.log('🚀 [发送媒体消息] 开始:', {
      userId: userId.substring(0, 8) + '...',
      friendId: friendId.substring(0, 8) + '...',
      sender,
      messageType,
      mediaSize: (mediaData.size / 1024).toFixed(2) + 'KB'
    });

    // 构建会话ID
    const conversationId = userId < friendId
      ? `${userId}_${friendId}`
      : `${friendId}_${userId}`;

    console.log('📦 [会话ID]:', conversationId);

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

    console.log('📨 [媒体消息数据]:', {
      ...messageData,
      sender_id: messageData.sender_id.substring(0, 8) + '...',
      receiver_id: messageData.receiver_id.substring(0, 8) + '...',
      text: messageData.text.substring(0, 30) + (messageData.text.length > 30 ? '...' : ''),
      media_uri: messageData.media_uri.substring(0, 50) + '...'
    });

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ [发送媒体消息失败] Supabase 错误:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });

      // 检查是否是 RLS 权限问题
      if (error.code === '42501' || error.message.includes('policy')) {
        console.error('🔒 [RLS 策略错误] 数据库权限被拒绝！');
        console.error('💡 解决方案: 检查 chat_messages 表的 RLS 策略配置');
      }

      // 检查新字段是否存在
      if (error.code === '42703') {
        console.error('📋 [字段错误] chat_messages 表缺少媒体字段！');
        console.error('💡 解决方案: 运行 database/add-media-support-to-chat-messages.sql');
      }

      return null;
    }

    console.log('✅ [发送媒体消息成功] 消息ID:', data?.id);

    // 更新未读计数（使用预览文本）
    const previewText = text || `[${messageType === 'image' ? '图片' : '视频'}]`;
    await updateUnreadCount(receiverId, senderId, previewText);

    return data?.id || null;
  } catch (error: any) {
    console.error('❌ [发送媒体消息失败] 捕获异常:', {
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });
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
