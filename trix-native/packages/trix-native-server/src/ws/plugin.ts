// ============================================
// Plugin WebSocket 处理器 (可选优化)
// ============================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/helpers.js';
import { store } from '../services/MemoryStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trix-native-secret-change-in-production';

export class PluginWebSocketHandler {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 初始化 Plugin WebSocket 处理
   */
  initialize(): void {
    const pluginNamespace = this.io.of('/ws/plugin');

    pluginNamespace.on('connection', (socket: Socket) => {
      console.log(`[PluginWS] Client connected: ${socket.id}`);

      // 从查询参数获取 token
      const token = socket.handshake.query.token as string;

      if (!token) {
        socket.emit('error', { message: 'Missing token' });
        socket.disconnect();
        return;
      }

      // 验证 token
      const payload = verifyToken(token, JWT_SECRET);

      if (!payload) {
        socket.emit('error', { message: 'Invalid or expired token' });
        socket.disconnect();
        return;
      }

      const deviceId = payload.deviceId as string;
      const device = store.devices.get(deviceId);

      if (!device || device.status !== 'active') {
        socket.emit('error', { message: 'Device not found or inactive' });
        socket.disconnect();
        return;
      }

      // 更新设备在线状态
      device.lastSeen = new Date();

      // 保存连接映射
      store.pluginConnections.set(socket.id, deviceId);

      // 确认连接成功
      socket.emit('connected', {
        success: true,
        deviceId: device.id,
        deviceName: device.name
      });

      // 处理消息
      socket.on('message', (data: any) => {
        this.handleMessage(socket, deviceId, data);
      });

      // 处理心跳
      socket.on('ping', () => {
        socket.emit('pong');
        device.lastSeen = new Date();
      });

      // 处理确认
      socket.on('ack', (data: { messageIds: string[] }) => {
        console.log(`[PluginWS] Received ack for messages:`, data.messageIds);
        // 可以在这里标记消息已送达
      });

      // 处理断开
      socket.on('disconnect', () => {
        console.log(`[PluginWS] Client disconnected: ${socket.id}`);
        store.pluginConnections.delete(socket.id);
      });
    });
  }

  /**
   * 处理 Plugin 消息
   */
  private handleMessage(socket: Socket, deviceId: string, data: any): void {
    console.log(`[PluginWS] Received message from ${deviceId}:`, data.type);

    switch (data.type) {
      case 'join_conversation':
        // Plugin 加入某个对话
        socket.join(`conversation:${data.conversationId}`);
        console.log(`[PluginWS] Plugin joined conversation: ${data.conversationId}`);
        break;

      default:
        console.log(`[PluginWS] Unknown message type: ${data.type}`);
    }
  }

  /**
   * 发送消息到 Plugin
   */
  async sendToPlugin(deviceId: string, message: any): Promise<boolean> {
    const pluginNamespace = this.io.of('/ws/plugin');

    // 查找对应的 socket
    for (const [socketId, connectedDeviceId] of store.pluginConnections) {
      if (connectedDeviceId === deviceId) {
        const socket = pluginNamespace.sockets.get(socketId);
        if (socket && socket.connected) {
          socket.emit('message', message);
          console.log(`[PluginWS] Sent message to device: ${deviceId}`);
          return true;
        }
      }
    }

    console.log(`[PluginWS] No connected plugin found for device: ${deviceId}`);
    return false;
  }
}
