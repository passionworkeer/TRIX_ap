import { useState, useCallback, useRef, useEffect } from 'react';
import type { ClawbotChannelMessage } from '../types/clawbotChannel';
import { logger } from '../utils/logger';

interface UseClawbotMessagesOptions {
  /** 用户 ID（用于加载历史） */
  userId?: string;
  /** 加载历史消息 */
  loadHistory?: (userId: string) => Promise<ClawbotChannelMessage[]>;
  /** 保存消息 */
  saveMessage?: (userId: string, message: ClawbotChannelMessage) => Promise<void>;
  /** 删除消息 */
  deleteMessage?: (userId: string, messageId: string) => Promise<void>;
}

interface UseClawbotMessagesReturn {
  /** 消息列表 */
  messages: ClawbotChannelMessage[];
  /** 添加或更新消息 */
  upsertMessage: (message: ClawbotChannelMessage) => void;
  /** 批量添加消息 */
  addMessages: (newMessages: ClawbotChannelMessage[]) => void;
  /** 删除消息 */
  removeMessage: (messageId: string) => void;
  /** 清空所有消息 */
  clearMessages: () => void;
  /** 加载历史消息 */
  loadHistoryMessages: () => Promise<void>;
  /** 保存消息到持久化 */
  persistMessage: (message: ClawbotChannelMessage) => Promise<void>;
}

/**
 * useClawbotMessages - Clawbot 消息管理 Hook
 *
 * 管理消息列表的增删改查和持久化
 */
export function useClawbotMessages(options: UseClawbotMessagesOptions = {}): UseClawbotMessagesReturn {
  const { userId, loadHistory, saveMessage } = options;

  const [messages, setMessages] = useState<ClawbotChannelMessage[]>([]);
  const messagesRef = useRef<ClawbotChannelMessage[]>([]);

  // 同步 ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * 生成持久化用的消息 ID
   */
  const toPersistedMessageId = useCallback((message: ClawbotChannelMessage): string => {
    if (message.id && message.id.length > 0) {
      return message.id;
    }
    return `${message.sender}-${message.timestamp}`;
  }, []);

  /**
   * 添加或更新消息
   */
  const upsertMessage = useCallback((message: ClawbotChannelMessage) => {
    setMessages((prev) => {
      const messageId = toPersistedMessageId(message);
      const exists = prev.some((item) => toPersistedMessageId(item) === messageId);

      if (exists) {
        return prev;
      }

      const next = [...prev, { ...message, id: messageId }];
      next.sort((a, b) => a.timestamp - b.timestamp);
      return next;
    });
  }, [toPersistedMessageId]);

  /**
   * 批量添加消息
   */
  const addMessages = useCallback((newMessages: ClawbotChannelMessage[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map(toPersistedMessageId));
      const uniqueNew = newMessages.filter(
        (msg) => !existingIds.has(toPersistedMessageId(msg))
      );

      if (uniqueNew.length === 0) return prev;

      const next = [...prev, ...uniqueNew.map(msg => ({
        ...msg,
        id: msg.id || toPersistedMessageId(msg)
      }))];
      next.sort((a, b) => a.timestamp - b.timestamp);
      return next;
    });
  }, [toPersistedMessageId]);

  /**
   * 删除消息
   */
  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => {
      const id = toPersistedMessageId(msg);
      return id !== messageId;
    }));
  }, [toPersistedMessageId]);

  /**
   * 清空所有消息
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * 加载历史消息
   */
  const loadHistoryMessages = useCallback(async () => {
    if (!userId || !loadHistory) return;

    try {
      const history = await loadHistory(userId);
      if (history.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map(toPersistedMessageId));
          const uniqueHistory = history.filter(
            (msg) => !existingIds.has(toPersistedMessageId(msg))
          );

          if (uniqueHistory.length === 0) return prev;

          const next = [...prev, ...uniqueHistory];
          next.sort((a, b) => a.timestamp - b.timestamp);
          return next;
        });
      }
    } catch (error) {
      logger.error('useClawbotMessages', '加载历史失败:', error);
    }
  }, [userId, loadHistory, toPersistedMessageId]);

  /**
   * 保存消息到持久化
   */
  const persistMessage = useCallback(async (message: ClawbotChannelMessage) => {
    if (!userId || !saveMessage) return;

    try {
      await saveMessage(userId, {
        ...message,
        id: message.id || toPersistedMessageId(message)
      });
    } catch (error) {
      logger.error('useClawbotMessages', '保存消息失败:', error);
    }
  }, [userId, saveMessage, toPersistedMessageId]);

  return {
    messages,
    upsertMessage,
    addMessages,
    removeMessage,
    clearMessages,
    loadHistoryMessages,
    persistMessage
  };
}
