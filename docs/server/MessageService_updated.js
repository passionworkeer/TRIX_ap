// ============================================
// 消息服务
// ============================================
import { messageDB, initDatabase } from './SQLiteStore.js';
import { generateId } from '../utils/helpers.js';
import { NativeAgentWebSocketHandler } from '../ws/ws-native-agent.js';

export class MessageService {
    constructor() {
        initDatabase();
    }

    /**
     * 保存手机发送的消息 (phone -> agent)
     * direction: 'inbound'
     */
    async savePhoneMessage(conversationId, data) {
        const message = {
            id: generateId('msg'),
            conversationId,
            direction: 'inbound',
            senderId: data.senderId || null,
            senderName: data.senderName || null,
            text: data.text,
            attachments: data.attachments || [],
            timestamp: new Date(),
            delivered: false,
        };
        messageDB.create(message);
        console.log(`[MessageService] Saved inbound message: ${message.id} to ${conversationId}`);

        // Broadcast to native WebSocket agents
        const envelope = {
            type: 'message.created',
            payload: { message: this._formatMessageForAgent(message) },
        };
        const sent = NativeAgentWebSocketHandler.broadcastToAgent('default', envelope);
        if (sent) {
            console.log(`[MessageService] Broadcasted to native agent: ${message.id}`);
        }

        return message;
    }

    /**
     * 保存 Agent 发送的消息 (agent -> phone)
     * direction: 'outbound'
     */
    async saveAgentMessage(conversationId, data) {
        const message = {
            id: generateId('msg'),
            conversationId,
            direction: 'outbound',
            senderId: data.senderId || null,
            senderName: data.senderName || null,
            text: data.text,
            attachments: data.attachments || [],
            timestamp: new Date(),
            delivered: false,
        };
        messageDB.create(message);
        console.log(`[MessageService] Saved outbound message: ${message.id} to ${conversationId}`);
        return message;
    }

    /**
     * 获取待发送给 Agent 的消息 (phone -> agent)
     */
    async getMessagesToPlugin(query) {
        const messages = messageDB.findUndelivered(query.conversationId, 'inbound');
        return {
            success: true,
            messages: messages.map(m => this._formatMessageForAgent(m)),
            hasMore: false,
        };
    }

    /**
     * 获取消息历史
     */
    async getMessageHistory(conversationId, limit = 50, beforeId) {
        const messages = messageDB.findByConversation(conversationId, limit, beforeId);
        return messages.map(m => this._formatMessageForAgent(m));
    }

    /**
     * 标记消息已送达
     */
    async markDelivered(messageId) {
        messageDB.markDelivered(messageId);
    }

    /**
     * 格式化消息供 Agent 使用（符合 OpenClaw 规范）
     */
    _formatMessageForAgent(m) {
        return {
            id: m.id,
            conversationId: m.conversationId,
            direction: m.direction,
            senderId: m.senderId || '',
            senderName: m.senderName || '',
            text: m.text || '',
            attachments: m.attachments || [],
            createdAt: m.timestamp instanceof Date ? m.timestamp.getTime() : Date.parse(m.timestamp),
        };
    }
}
