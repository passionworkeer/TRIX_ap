// ============================================
// 消息服务
// ============================================

import { messageDB, initDatabase } from './SQLiteStore.js';
import type { Message, FromPluginRequest, FromPluginResponse, ToPluginQuery, ToPluginResponse } from '../types.js';
import { generateId } from '../utils/helpers.js';

export class MessageService {
  constructor() {
    // 初始化数据库
    initDatabase();
  }

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

    // 保存到数据库
    messageDB.create(message);

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

    // 保存到数据库
    messageDB.create(message);

    console.log(`[MessageService] Saved agent message: ${message.id} to ${conversationId}`);

    return message;
  }

  /**
   * Plugin 获取待发送到 Agent 的消息 (手机 -> Agent)
   */
  async getMessagesToPlugin(query: ToPluginQuery): Promise<ToPluginResponse> {
    const messages = messageDB.findUndelivered(query.conversationId, 'phone');

    const formattedMessages: Message[] = messages.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      from: m.from as 'phone' | 'agent',
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      attachments: m.attachments,
      timestamp: m.timestamp,
      delivered: m.delivered
    }));

    return {
      success: true,
      messages: formattedMessages,
      hasMore: false
    };
  }

  /**
   * Plugin 发送消息到手机 (Agent -> 手机)
   */
  async sendToPhone(conversationId: string, message: Message): Promise<FromPluginResponse> {
    // 保存到数据库
    messageDB.create(message);

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
    const messages = messageDB.findByConversation(conversationId, limit, beforeId);

    return messages.map(m => ({
      id: m.id,
      conversationId: m.conversationId,
      from: m.from as 'phone' | 'agent',
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      attachments: m.attachments,
      timestamp: m.timestamp,
      delivered: m.delivered
    }));
  }

  /**
   * 标记消息已送达
   */
  async markDelivered(messageId: string, conversationId: string): Promise<void> {
    messageDB.markDelivered(messageId);
  }
}
