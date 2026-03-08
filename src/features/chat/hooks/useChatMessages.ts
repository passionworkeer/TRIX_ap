/**
 * useChatMessages - 聊天消息管理 Hook
 *
 * 功能：
 * - 加载聊天历史
 * - 发送消息
 * - 实时订阅新消息
 * - 消息状态管理
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../config/supabase';
import { logger } from '../../../utils/logger';
import {
  getChatHistory,
  sendMessage as dbSendMessage,
  sendMessageWithMedia,
  markMessagesAsRead
} from '../../../services/databaseService';
import { uploadFile } from '../../../services/uploadService';
import { formatTime } from '../../../utils/dateFormat';
import type { ChatMessage } from '../../../config/supabase';

export interface Message {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
  messageType?: 'text' | 'image' | 'video' | 'voice' | 'mixed';
  mediaUri?: string;
  mediaType?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

interface UseChatMessagesOptions {
  friendId: string;
  currentUserId: string;
  isBot?: boolean;
  onMessage?: (message: Message) => void;
}

interface UseChatMessagesReturn {
  messages: Message[];
  loading: boolean;
  sendMessage: (text: string, mediaData?: { uri: string; type: string }) => Promise<void>;
  markAsRead: () => Promise<void>;
  clearMessages: () => void;
}

export const useChatMessages = ({
  friendId,
  currentUserId,
  isBot = false,
  onMessage
}: UseChatMessagesOptions): UseChatMessagesReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 生成会话 ID
  const conversationId = currentUserId < friendId
    ? `${currentUserId}_${friendId}`
    : `${friendId}_${currentUserId}`;

  // 转换数据库消息为 UI 消息
  const convertDbMessageToUI = (dbMsg: ChatMessage): Message => {
    const uiMessage: Message = {
      id: dbMsg.id,
      sender: dbMsg.sender,
      text: dbMsg.text,
      timestamp: formatTime(new Date(dbMsg.created_at)),
      messageType: dbMsg.message_type,
      mediaUri: dbMsg.media_uri || undefined,
      mediaType: dbMsg.message_type,
      mediaMetadata: dbMsg.media_metadata || undefined
    };
    return uiMessage;
  };

  // 加载聊天历史
  useEffect(() => {
    const loadHistory = async () => {
      if (!friendId || friendId.startsWith('clawbot')) {
        // Bot 聊天不从数据库加载
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const history = await getChatHistory(friendId);
        const uiMessages = history.map(convertDbMessageToUI);
        setMessages(uiMessages);

        // 标记已读
        await markMessagesAsRead(friendId);
      } catch (error) {
        logger.chat.error('[useChatMessages] 加载历史失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [friendId, currentUserId]);

  // 实时订阅新消息
  useEffect(() => {
    if (isBot) return; // Bot 聊天不使用 Supabase Realtime

    // 防止重复订阅
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // 创建订阅频道
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
          const newMsg = payload.new as ChatMessage;
          const uiMsg = convertDbMessageToUI(newMsg);
          setMessages((prev) => [...prev, uiMsg]);
          onMessage?.(uiMsg);

          // 如果是对方发的消息，标记已读
          if (newMsg.sender !== 'user') {
            markMessagesAsRead(friendId);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, isBot, friendId]);

  // 发送消息
  const sendMessage = async (text: string, mediaData?: { uri: string; type: string }) => {
    if (!text.trim() && !mediaData) return;

    // 添加临时消息
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: formatTime(new Date()),
      messageType: mediaData?.type === 'image/' ? 'image' : mediaData?.type === 'video/' ? 'video' : 'text',
      mediaUri: mediaData?.uri,
      mediaType: mediaData?.type
    };

    try {
      setMessages((prev) => [...prev, tempMessage]);

      // 发送到数据库
      if (mediaData) {
        // 上传媒体文件
        const category = mediaData.type.startsWith('image/') ? 'image' : 'video';
        const file = await fetch(mediaData.uri).then(r => r.blob()) as File;
        const uploadResult = await uploadFile(file, category);

        await sendMessageWithMedia(
          friendId,
          'user',
          text,
          {
            uri: uploadResult.uri,
            type: mediaData.type,
            size: file.size,
            category
          },
          category
        );
      } else {
        await dbSendMessage(friendId, 'user', text);
      }

      // 移除临时消息，等待实时订阅更新
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
    } catch (error) {
      logger.chat.error('[useChatMessages] 发送消息失败:', error);
      // 保留临时消息，但标记为发送失败
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessage.id
            ? { ...msg, failed: true }
            : msg
        )
      );
      throw error;
    }
  };

  // 标记已读
  const markAsRead = async () => {
    try {
      await markMessagesAsRead(friendId);
    } catch (error) {
      logger.chat.error('[useChatMessages] 标记已读失败:', error);
    }
  };

  // 清空消息
  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    loading,
    sendMessage,
    markAsRead,
    clearMessages
  };
};

export default useChatMessages;
