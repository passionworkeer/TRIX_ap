// ============================================
// Agent WebSocket 处理器 (OpenClaw Plugin 连接 + 前端用户连接)
// ============================================

import { Server as SocketIOServer, Socket } from 'socket.io';
import { store } from '../services/MemoryStore.js';
import { PairingService } from '../services/PairingService.js';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin-token-change-me';

export class AgentWebSocketHandler {
  private io: SocketIOServer;
  private pairingService?: PairingService;

  constructor(io: SocketIOServer, pairingService?: PairingService) {
    this.io = io;
    this.pairingService = pairingService;
  }

  /**
   * 初始化 Agent WebSocket 处理
   * 路径: /ws?role=agent&adminToken=xxx&accountId=xxx
   */
  initialize(): void {
    const agentNamespace = this.io.of('/ws');

    agentNamespace.on('connection', (socket: Socket) => {
      console.log(`[AgentWS] Client connected: ${socket.id}`);

      // 从查询参数获取参数
      const role = socket.handshake.query.role as string;
      const adminToken = socket.handshake.query.adminToken as string;
      const accountId = socket.handshake.query.accountId as string;
      const conversationId = socket.handshake.query.conversationId as string;
      const clientId = socket.handshake.query.clientId as string;
      const clientToken = socket.handshake.query.clientToken as string;

      // 处理 Agent 角色
      if (role === 'agent') {
        if (!adminToken || adminToken !== ADMIN_TOKEN) {
          socket.emit('error', { message: 'Invalid admin token' });
          socket.disconnect();
          return;
        }

        console.log(`[AgentWS] Agent connected: accountId=${accountId}`);

        // 保存连接映射
        store.agentConnections.set(socket.id, accountId || 'default');

        // 确认连接成功
        socket.emit('open');

        // 处理消息
        socket.on('message', (data: any) => {
          this.handleMessage(socket, accountId, data);
        });

        // 处理心跳
        socket.on('ping', () => {
          socket.emit('pong');
        });

        // 处理断开
        socket.on('disconnect', () => {
          console.log(`[AgentWS] Agent disconnected: ${socket.id}`);
          store.agentConnections.delete(socket.id);
        });
        return;
      }

      // 处理 User 角色 (前端配对后连接)
      if (role === 'user') {
        if (!conversationId || !clientId || !clientToken) {
          socket.emit('error', { message: 'Missing required parameters for user connection' });
          socket.disconnect();
          return;
        }

        console.log(`[AgentWS] User connected: conversationId=${conversationId}, clientId=${clientId}`);

        // 验证 clientToken
        const pairing = this.pairingService?.getPairingByDeviceId(conversationId);
        if (!pairing || pairing.pluginToken !== clientToken) {
          socket.emit('error', { message: 'Invalid client token' });
          socket.disconnect();
          return;
        }

        // 保存用户连接映射
        store.userConnections.set(socket.id, { conversationId, clientId });

        // 确认连接成功
        socket.emit('open');

        // 处理消息
        socket.on('message', (data: any) => {
          console.log(`[AgentWS] Received message from user ${clientId}:`, data);
        });

        // 处理心跳
        socket.on('ping', () => {
          socket.emit('pong');
        });

        // 处理断开
        socket.on('disconnect', () => {
          console.log(`[AgentWS] User disconnected: ${socket.id}`);
          store.userConnections.delete(socket.id);
        });
        return;
      }

      // 无效的角色
      socket.emit('error', { message: 'Invalid role' });
      socket.disconnect();
    });
  }

  /**
   * 处理 Agent 消息
   */
  private handleMessage(socket: Socket, accountId: string, data: any): void {
    console.log(`[AgentWS] Received message from agent ${accountId}:`, data);

    // 解析消息
    try {
      const envelope = typeof data === 'string' ? JSON.parse(data) : data;

      if (envelope.type === 'message.created') {
        // 消息创建事件，存储并转发给手机
        console.log('[AgentWS] New message from agent:', envelope.payload);
      }
    } catch (e) {
      console.error('[AgentWS] Failed to parse message:', e);
    }
  }

  /**
   * 发送消息到 Agent
   */
  async sendToAgent(accountId: string, message: any): Promise<boolean> {
    const agentNamespace = this.io.of('/ws');

    // 查找对应的 socket
    for (const [socketId, connectedAccountId] of store.agentConnections) {
      if (connectedAccountId === accountId) {
        const socket = agentNamespace.sockets.get(socketId);
        if (socket && socket.connected) {
          socket.emit('message', message);
          console.log(`[AgentWS] Sent message to agent: ${accountId}`);
          return true;
        }
      }
    }

    console.log(`[AgentWS] No connected agent found for account: ${accountId}`);
    return false;
  }
}
