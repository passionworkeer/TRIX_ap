import { supabase } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { CHAT_VALIDATION, validateString, getValidationErrorMessage, sanitizeString } from '../lib/validation';
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
    logger.chat.error('获取用户会话失败:', error);
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
    logger.chat.error('更新未读计数失败:', error);
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

        // 对于语音消息，使用 voice_url；其他使用 media_uri
        if (msg.message_type === 'voice') {
          uiMessage.voice_url = msg.voice_url;
          uiMessage.voice_duration = msg.voice_duration;
          uiMessage.voice_transcript = msg.voice_transcript;
          uiMessage.voice_mime_type = msg.voice_mime_type;
          // 兼容旧数据：优先使用 voice_url，回退到 media_uri
          uiMessage.media_uri = msg.voice_url || msg.media_uri;
          uiMessage.media_metadata = { duration: msg.voice_duration || msg.media_metadata?.duration || 0 };
        } else {
          uiMessage.media_uri = msg.media_uri;
          uiMessage.media_type = msg.media_type;
          uiMessage.media_size = msg.media_size;
          uiMessage.media_metadata = msg.media_metadata;
        }
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

    // Validate message text if provided
    if (text) {
      const textError = validateString(text, CHAT_VALIDATION.messageText, 'messageText');
      if (textError) {
        throw new Error(getValidationErrorMessage(textError));
      }
    }

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
      text: sanitizeString(text, CHAT_VALIDATION.messageText.max),
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
 * @param messageType - 消息类型 ('image' | 'video' | 'mixed' | 'voice')
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
    category: 'image' | 'video' | 'audio';
    metadata?: {
      width?: number;
      height?: number;
      duration?: number;
    };
  },
  messageType: 'image' | 'video' | 'mixed' | 'voice'
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

    // 根据消息类型构建数据
    const isVoice = messageType === 'voice';

    const messageData: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text || '', // 允许纯媒体消息为空文本
      is_read: false,
      message_type: messageType,
      media_uri: isVoice ? null : mediaData.uri,
      media_type: isVoice ? null : mediaData.type,
      media_size: isVoice ? null : mediaData.size,
      media_metadata: isVoice ? null : (mediaData.metadata || null)
    };

    // 如果是语音消息，添加语音字段
    if (isVoice) {
      messageData.voice_url = mediaData.uri;
      messageData.voice_duration = mediaData.metadata?.duration || 0;
      messageData.voice_mime_type = mediaData.type;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select('id')
      .single();

    if (error) {
      logger.chat.error('发送媒体消息失败:', error);
      return null;
    }

    // 更新未读计数（使用预览文本）
    const typeLabel = messageType === 'image' ? '图片' : messageType === 'video' ? '视频' : messageType === 'voice' ? '语音' : '媒体';
    const previewText = text || `[${typeLabel}]`;
    await updateUnreadCount(receiverId, senderId, previewText);

    return data?.id || null;
  } catch (error: unknown) {
    logger.chat.error('发送媒体消息失败:', error);
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
      logger.chat.error('标记消息已读失败:', error);
    }
  } catch (error) {
    logger.chat.error('标记消息已读失败:', error);
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
      logger.chat.error('清空聊天记录失败:', error);
    }
  } catch (error) {
    logger.chat.error('清空聊天记录失败:', error);
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
      logger.chat.error('获取未读计数失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.chat.error('获取未读计数失败:', error);
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
      logger.chat.error('获取总未读数失败:', error);
      return 0;
    }

    return data?.reduce((sum, item) => sum + item.unread_count, 0) || 0;
  } catch (error) {
    logger.chat.error('获取总未读数失败:', error);
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
    logger.chat.error('订阅聊天消息失败:', error);
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
    logger.chat.error('订阅未读计数更新失败:', error);
    return () => {}; // 返回空的清理函数
  }
}
