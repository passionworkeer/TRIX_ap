import { supabase } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import type { ChatMessage, UnreadCount } from '../config/supabase';

// ============================================
// 内部辅助函数
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

/** 更新未读计数（内部辅助函数） */
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

// ============================================
// 聊天记录管理
// ============================================

/** 获取与某个好友的聊天记录 */
export async function getChatHistory(friendId: string): Promise<ChatMessage[]> {
  try {
    const userId = await getCurrentUserId();

    // 构建会话 ID（较小 UID 在前）
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

    // 转换为旧数据格式以兼容现有代码
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

    // Build conversation ID
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
  } catch (error: unknown) {
    handleGlobalError(error, '发送消息失败');
    return null;
  }
}

/**
 * 发送包含媒体附件的消息
 * @param friendId - 好友 ID
 * @param sender - 发送者类型
 * @param text - 消息文本（可以为空）
 * @param mediaData - 媒体数据
 * @param messageType - 消息类型 ('image' | 'video' | 'mixed')
 * @returns 消息 ID 或 null
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

    // Build conversation ID
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
      text: text || '', // 允许纯媒体消息为空文本
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
  } catch (error: unknown) {
    console.error('发送媒体消息失败:', error);
    return null;
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

    // Build conversation ID
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
// 实时订阅
// ============================================

/** 订阅好友消息更新 */
export async function subscribeToChatMessages(
  friendId: string,
  callback: (message: ChatMessage) => void
) {
  try {
    const userId = await getCurrentUserId();

    // Build conversation ID
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
