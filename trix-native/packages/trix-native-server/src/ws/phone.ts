// ============================================
// 手机 WebSocket 处理器
// ============================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import { PairingService } from '../services/PairingService.js';
import { MessageService } from '../services/MessageService.js';
import { store } from '../services/MemoryStore.js';
import type { WSPhoneMessage } from '../types.js';

export class PhoneWebSocketHandler {
  private io: SocketIOServer;
  private pairingService: PairingService;
  private messageService: MessageService;

  constructor(
    io: SocketIOServer,
    pairingService: PairingService,
    messageService: MessageService
  ) {
    this.io = io;
    this.pairingService = pairingService;
    this.messageService = messageService;
  }

  /**
   * 初始化手机 WebSocket 处理
   */
  initialize(): void {
    const phoneNamespace = this.io.of('/ws/phone');

    phoneNamespace.on('connection', (socket: Socket) => {
      console.log(`[PhoneWS] Client connected: ${socket.id}`);

      // 从查询参数获取配对码
      const code = socket.handshake.query.code as string;

      if (!code) {
        socket.emit('error', { message: 'Missing pairing code' });
        socket.disconnect();
        return;
      }

      // 验证配对码
      const pairing = this.pairingService.getPairingByCode(code);

      if (!pairing) {
        socket.emit('error', { message: 'Invalid pairing code' });
        socket.disconnect();
        return;
      }

      // 检查配对状态
      if (pairing.status === 'paired') {
        // 已配对，检查是否是同一个设备
        if (pairing.deviceId) {
          // 可以选择允许或拒绝
          console.log(`[PhoneWS] Device ${pairing.deviceId} reconnecting`);
        }
      } else if (pairing.status !== 'waiting') {
        socket.emit('error', { message: 'Pairing expired or invalid' });
        socket.disconnect();
        return;
      }

      // 更新配对状态
      if (pairing.status === 'waiting') {
        this.pairingService.updatePairingStatus(code, 'phone_connected');
      }

      // 保存连接映射
      store.phoneConnections.set(socket.id, code);

      // 通知客户端连接成功
      socket.emit('connected', {
        success: true,
        code: pairing.code,
        status: pairing.status
      });

      // 处理消息
      socket.on('message', async (data: WSPhoneMessage) => {
        await this.handleMessage(socket, code, data);
      });

      // 处理心跳
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // 处理断开
      socket.on('disconnect', () => {
        console.log(`[PhoneWS] Client disconnected: ${socket.id}`);
        store.phoneConnections.delete(socket.id);
      });
    });
  }

  /**
   * 处理手机消息
   */
  private async handleMessage(socket: Socket, code: string, data: WSPhoneMessage): Promise<void> {
    console.log(`[PhoneWS] Received message from ${socket.id}:`, data.type);

    const pairing = this.pairingService.getPairingByCode(code);
    if (!pairing || !pairing.deviceId) {
      socket.emit('error', { message: 'Not paired' });
      return;
    }

    switch (data.type) {
      case 'message':
        // 保存消息
        const conversationId = data.conversationId || 'default';
        const message = await this.messageService.savePhoneMessage(conversationId, {
          text: data.text,
          attachments: data.attachments
        });

        // 确认收到
        socket.emit('ack', { messageId: message.id });

        console.log(`[PhoneWS] Saved message: ${message.id}`);
        break;

      default:
        console.log(`[PhoneWS] Unknown message type: ${data.type}`);
    }
  }

  /**
   * 发送消息到手机
   */
  async sendToPhone(conversationId: string, message: any): Promise<boolean> {
    const phoneNamespace = this.io.of('/ws/phone');

    // 查找对应的 socket
    for (const [socketId, code] of store.phoneConnections) {
      const pairing = this.pairingService.getPairingByCode(code);
      if (pairing && pairing.status === 'paired') {
        const socket = phoneNamespace.sockets.get(socketId);
        if (socket && socket.connected) {
          socket.emit('message', message);
          console.log(`[PhoneWS] Sent message to ${socketId}`);
          return true;
        }
      }
    }

    console.log(`[PhoneWS] No connected phone found for conversation: ${conversationId}`);
    return false;
  }
}
