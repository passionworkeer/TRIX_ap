// ============================================
// 消息服务
// ============================================

import { store } from '../services/MemoryStore.js';
import type { Message, FromPluginRequest, FromPluginResponse, ToPluginQuery, ToPluginResponse } from '../types.js';
import { generateId } from '../utils/helpers.js';

export class MessageService {
  /**
   * 保存手机发送的消息
   */
  async savePhoneMessage(
    conversationId: string,
    data: { text?: string; attachments?: any[] }
  ): Promise<Message> {
    const message: Message = {
      id: generateId('msg'),
      conversationId,
      from: 'phone',
      text: data.text,
      attachments: data.attachments,
      timestamp: new Date(),
      delivered: false
    };

    // 存储消息
    const key = `phone:${conversationId}`;
    if (!store.messages.has(key)) {
      store.messages.set(key, []);
    }
    store.messages.get(key)!.push(message);

    console.log(`[MessageService] Saved phone message: ${message.id} to ${conversationId}`);

    return message;
  }

  /**
   * 保存 Agent 发送的消息 (通过 Plugin)
   */
  async saveAgentMessage(
    conversationId: string,
    data: { text?: string; attachments?: any[] }
  ): Promise<Message> {
    const message: Message = {
      id: generateId('msg'),
      conversationId,
      from: 'agent',
      text: data.text,
      attachments: data.attachments,
      timestamp: new Date(),
      delivered: false
    };

    // 存储消息
    const key = `agent:${conversationId}`;
    if (!store.messages.has(key)) {
      store.messages.set(key, []);
    }
    store.messages.get(key)!.push(message);

    console.log(`[MessageService] Saved agent message: ${message.id} to ${conversationId}`);

    return message;
  }

  /**
   * Plugin 获取待发送到 Agent 的消息 (手机 -> Agent)
   */
  async getMessagesToPlugin(query: ToPluginQuery): Promise<ToPluginResponse> {
    const key = `phone:${query.conversationId}`;
    const messages = store.messages.get(key) || [];

    // 找到起始位置
    let startIndex = 0;
    if (query.lastMessageId) {
      startIndex = messages.findIndex(m => m.id === query.lastMessageId) + 1;
    }

    // 获取后续消息
    const pendingMessages = messages.slice(startIndex, startIndex + 50);

    return {
      success: true,
      messages: pendingMessages,
      hasMore: messages.length > startIndex + 50
    };
  }

  /**
   * Plugin 发送消息到手机 (Agent -> 手机)
   */
  async sendToPhone(conversationId: string, message: Message): Promise<FromPluginResponse> {
    // 存储消息
    const key = `agent:${conversationId}`;
    if (!store.messages.has(key)) {
      store.messages.set(key, []);
    }
    store.messages.get(key)!.push(message);

    console.log(`[MessageService] Queued agent message: ${message.id} to phone`);

    return {
      success: true,
      messageId: message.id
    };
  }

  /**
   * 获取消息历史
   */
  async getMessageHistory(
    conversationId: string,
    limit: number = 50,
    beforeId?: string
  ): Promise<Message[]> {
    const phoneKey = `phone:${conversationId}`;
    const agentKey = `agent:${conversationId}`;

    const phoneMessages = store.messages.get(phoneKey) || [];
    const agentMessages = store.messages.get(agentKey) || [];

    // 合并并按时间排序
    const allMessages = [...phoneMessages, ...agentMessages].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // 如果有 beforeId，找到起始位置
    let startIndex = allMessages.length;
    if (beforeId) {
      startIndex = allMessages.findIndex(m => m.id === beforeId);
      if (startIndex === -1) startIndex = allMessages.length;
    }

    return allMessages.slice(Math.max(0, startIndex - limit), startIndex);
  }

  /**
   * 标记消息已送达
   */
  async markDelivered(messageId: string, conversationId: string): Promise<void> {
    const phoneKey = `phone:${conversationId}`;
    const agentKey = `agent:${conversationId}`;

    for (const key of [phoneKey, agentKey]) {
      const messages = store.messages.get(key);
      if (messages) {
        const message = messages.find(m => m.id === messageId);
        if (message) {
          message.delivered = true;
          break;
        }
      }
    }
  }
}
