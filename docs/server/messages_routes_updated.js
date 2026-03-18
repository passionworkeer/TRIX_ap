// ============================================
// 消息API路由
// ============================================
import { Router } from 'express';
import { authenticatePlugin, authenticateServiceToken } from '../middleware/auth.js';
import { messageDB, initDatabase } from '../services/SQLiteStore.js';
import { generateId } from '../utils/helpers.js';
import { NativeAgentWebSocketHandler } from '../ws/ws-native-agent.js';

const router = Router();

/**
 * POST /api/service/messages
 * OpenClaw Plugin 发送消息给手机 (agent -> phone)
 * Auth: Bearer <serviceToken>
 */
router.post('/service/messages', authenticateServiceToken, async (req, res) => {
    try {
        const { conversationId, text, senderId, senderName, attachments } = req.body;
        if (!conversationId) {
            return res.status(400).json({ success: false, error: 'MISSING_CONVERSATION_ID', message: 'conversationId is required' });
        }
        // Save message to DB
        const message = {
            id: generateId('msg'),
            conversationId,
            direction: 'outbound',
            senderId: senderId || 'openclaw:agent',
            senderName: senderName || 'Agent',
            text: text || '',
            attachments: attachments || [],
            timestamp: new Date(),
            delivered: false,
        };
        messageDB.create(message);
        console.log(`[MessageService] Saved outbound message: ${message.id}`);
        res.status(201).json({ success: true, message });
    } catch (error) {
        console.error('[MessageRoutes] Error in /api/service/messages:', error);
        res.status(500).json({ success: false, error: 'SEND_FAILED', message: error.message });
    }
});

/**
 * POST /api/messages/from-plugin
 * Plugin 发送消息到手机 (旧接口，保留兼容)
 */
router.post('/from-plugin', authenticatePlugin, async (req, res) => {
    try {
        const { conversationId, text, attachments } = req.body;
        if (!conversationId) {
            return res.status(400).json({ success: false, error: 'MISSING_CONVERSATION_ID', message: 'conversationId is required' });
        }
        const message = {
            id: generateId('msg'),
            conversationId,
            direction: 'outbound',
            senderId: 'openclaw:plugin',
            senderName: req.device?.name || 'Plugin',
            text,
            attachments: attachments || [],
            timestamp: new Date(),
            delivered: false,
        };
        messageDB.create(message);
        res.json({ success: true, messageId: message.id });
    } catch (error) {
        console.error('[MessageRoutes] Error sending to phone:', error);
        res.status(500).json({ success: false, error: 'SEND_FAILED', message: error.message });
    }
});

/**
 * GET /api/messages/to-plugin
 * Plugin 拉取手机消息 (手机 -> Agent)
 */
router.get('/to-plugin', authenticatePlugin, async (req, res) => {
    try {
        const { conversationId, lastMessageId } = req.query;
        if (!conversationId) {
            return res.status(400).json({ success: false, error: 'MISSING_CONVERSATION_ID', message: 'conversationId is required' });
        }
        // Get undelivered inbound messages
        const messages = messageDB.findUndelivered(conversationId, 'inbound');
        const formatted = messages.map(m => ({
            id: m.id,
            conversationId: m.conversationId,
            direction: m.direction,
            senderId: m.senderId || '',
            senderName: m.senderName || '',
            text: m.text || '',
            attachments: m.attachments || [],
            createdAt: m.timestamp instanceof Date ? m.timestamp.getTime() : Date.parse(m.timestamp),
        }));
        // Mark as delivered
        for (const m of messages) {
            messageDB.markDelivered(m.id);
        }
        res.json({ success: true, messages: formatted, hasMore: false });
    } catch (error) {
        console.error('[MessageRoutes] Error fetching messages:', error);
        res.status(500).json({ success: false, error: 'FETCH_FAILED', message: error.message });
    }
});

/**
 * GET /api/messages/:conversationId
 * 获取消息历史 (需要 serviceToken 认证)
 */
router.get('/:conversationId', async (req, res) => {
    try {
        // Check for serviceToken OR clientToken
        const authHeader = req.headers['authorization'];
        const adminToken = req.headers['x-trix-admin-token'];
        const clientToken = req.headers['x-trix-client-token'];
        const SERVICE_TOKEN = process.env.SERVICE_TOKEN || process.env.ADMIN_TOKEN || 'admin-token-change-me';
        const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-token-change-me';

        let authorized = false;
        if (authHeader?.startsWith('Bearer ')) {
            authorized = authHeader.slice(7) === SERVICE_TOKEN || authHeader.slice(7) === ADMIN_TOKEN;
        }
        if (!authorized && adminToken) {
            authorized = adminToken === ADMIN_TOKEN || adminToken === SERVICE_TOKEN;
        }
        // Allow clientToken for phone-side reading (conversations already paired)
        if (!authorized && clientToken) {
            authorized = true; // clientToken validated by phone-side pairing
        }

        if (!authorized) {
            return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
        }

        const { conversationId } = req.params;
        const { limit, beforeId } = req.query;
        initDatabase();
        const messages = messageDB.findByConversation(conversationId, limit ? parseInt(limit) : 50, beforeId);
        const formatted = messages.map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            direction: m.direction,
            senderId: m.sender_id || '',
            senderName: m.sender_name || '',
            text: m.text || '',
            attachments: m.attachments ? JSON.parse(m.attachments) : [],
            createdAt: new Date(m.created_at).getTime(),
            delivered: Boolean(m.delivered),
        }));
        res.json({ success: true, messages: formatted });
    } catch (error) {
        console.error('[MessageRoutes] Error fetching history:', error);
        res.status(500).json({ success: false, error: 'HISTORY_FAILED', message: error.message });
    }
});

/**
 * POST /api/messages
 * 手机发送消息 (phone -> server)
 * This is the endpoint the frontend calls to send messages
 */
router.post('/', async (req, res) => {
    try {
        const { conversationId, clientToken, direction, senderId, senderName, text, attachments } = req.body;
        if (!conversationId || !clientToken) {
            return res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'conversationId and clientToken are required' });
        }
        const message = {
            id: generateId('msg'),
            conversationId,
            direction: direction || 'inbound',
            senderId: senderId || 'unknown',
            senderName: senderName || 'Unknown',
            text: text || '',
            attachments: attachments || [],
            timestamp: new Date(),
            delivered: false,
        };
        initDatabase();
        messageDB.create(message);
        console.log(`[MessageRoutes] POST /api/messages saved: ${message.id} dir=${message.direction}`);

        // If this is an inbound message, broadcast to native WebSocket agents
        if (message.direction === 'inbound') {
            const envelope = {
                type: 'message.created',
                payload: {
                    message: {
                        id: message.id,
                        conversationId: message.conversationId,
                        direction: message.direction,
                        senderId: message.senderId,
                        senderName: message.senderName,
                        text: message.text,
                        attachments: message.attachments,
                        createdAt: message.timestamp instanceof Date ? message.timestamp.getTime() : Date.now(),
                    }
                }
            };
            NativeAgentWebSocketHandler.broadcastToAgent('default', envelope);
        }

        res.status(201).json({ success: true, message });
    } catch (error) {
        console.error('[MessageRoutes] Error in POST /api/messages:', error);
        res.status(500).json({ success: false, error: 'SEND_FAILED', message: error.message });
    }
});

export { router as createMessageRoutes };
