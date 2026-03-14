// ============================================
// 消息API路由
// ============================================

import { Router } from 'express';
import { MessageService } from '../services/MessageService.js';
import { authenticatePlugin, authenticateAdmin } from '../middleware/auth.js';
import { generateId } from '../utils/helpers.js';

const router = Router();

export function createMessageRoutes(messageService: MessageService): Router {
  /**
   * POST /api/messages/from-plugin
   * Plugin 发送消息到手机 (Agent → 手机)
   * 需要 Plugin 认证
   */
  router.post('/from-plugin', authenticatePlugin, async (req, res) => {
    try {
      const { conversationId, text, attachments } = req.body;

      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: 'MISSING_CONVERSATION_ID',
          message: 'conversationId is required'
        });
        return;
      }

      const message = await messageService.saveAgentMessage(conversationId, {
        text,
        attachments
      });

      // TODO: 通过 WebSocket 推送给手机

      res.json({
        success: true,
        messageId: message.id
      });
    } catch (error) {
      console.error('[MessageRoutes] Error sending to phone:', error);
      res.status(500).json({
        success: false,
        error: 'SEND_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/messages/to-plugin
   * Plugin 拉取手机消息 (手机 → Agent)
   * 需要 Plugin 认证
   */
  router.get('/to-plugin', authenticatePlugin, async (req, res) => {
    try {
      const { conversationId, lastMessageId } = req.query;

      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: 'MISSING_CONVERSATION_ID',
          message: 'conversationId is required'
        });
        return;
      }

      const result = await messageService.getMessagesToPlugin({
        conversationId: conversationId as string,
        lastMessageId: lastMessageId as string | undefined
      });

      res.json(result);
    } catch (error) {
      console.error('[MessageRoutes] Error fetching messages:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/messages/from-phone
   * 手机发送消息到服务器 (临时接口，用于测试)
   * 需要配对码验证
   */
  router.post('/from-phone', async (req, res) => {
    try {
      const { code, conversationId, text, attachments } = req.body;

      if (!code || !conversationId) {
        res.status(400).json({
          success: false,
          error: 'MISSING_PARAMS',
          message: 'code and conversationId are required'
        });
        return;
      }

      // 验证配对码
      // 这里简化处理，实际应该验证手机 WebSocket 连接

      const message = await messageService.savePhoneMessage(conversationId, {
        text,
        attachments
      });

      res.json({
        success: true,
        messageId: message.id
      });
    } catch (error) {
      console.error('[MessageRoutes] Error receiving from phone:', error);
      res.status(500).json({
        success: false,
        error: 'RECEIVE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/messages/:conversationId
   * 获取消息历史
   */
  router.get('/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { limit, beforeId } = req.query;

      const messages = await messageService.getMessageHistory(
        conversationId,
        limit ? parseInt(limit as string) : 50,
        beforeId as string | undefined
      );

      res.json({
        success: true,
        messages
      });
    } catch (error) {
      console.error('[MessageRoutes] Error fetching history:', error);
      res.status(500).json({
        success: false,
        error: 'HISTORY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
