// ============================================
// TRIX Native Monitor - Socket.IO 长连接接收消息
// ============================================

import { io, Socket } from 'socket.io-client';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

let socket: Socket | null = null;

/**
 * 启动 Socket.IO 监控服务
 */
export async function startMonitor(api: OpenClawPluginApi, ctx: any): Promise<void> {
  console.log('[TRIX Native Monitor] Starting...');

  try {
    // 获取凭证
    const creds = await (api as any).runtime.credentials.get('trix-native');

    if (!creds?.token) {
      console.log('[TRIX Native Monitor] No credentials, skipping');
      return;
    }

    // 获取 account 配置
    const config = api.config as any;
    const account = config.channels?.['trix-native']?.accounts?.default;

    if (!account?.serverUrl) {
      console.log('[TRIX Native Monitor] No serverUrl configured');
      return;
    }

    const serverUrl = account.serverUrl;
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/ws/plugin?token=' + creds.token;

    console.log('[TRIX Native Monitor] Connecting to:', wsUrl);

    // 建立 Socket.IO 连接
    socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 3000
    });

    socket.on('connect', () => {
      console.log('[TRIX Native Monitor] Socket.IO connected');
    });

    socket.on('connected', (data) => {
      console.log('[TRIX Native Monitor] Device connected:', data.deviceId, data.deviceName);
    });

    socket.on('message', (data: any) => {
      console.log('[TRIX Native Monitor] Received message:', data.type || 'unknown');

      try {
        if (data.type === 'message' || data.messages) {
          const messages = data.messages || [data];

          for (const msg of messages) {
            // 注入 OpenClaw，触发 Agent 处理
            ctx.dispatch({
              channel: 'trix-native',
              accountId: 'default',
              conversationId: msg.conversationId || creds.deviceId,
              from: msg.from === 'phone' ? 'user' : 'agent',
              text: msg.text,
              attachments: msg.attachments,
              timestamp: msg.timestamp || Date.now()
            });
          }
        }
      } catch (error) {
        console.error('[TRIX Native Monitor] Failed to dispatch message:', error);
      }
    });

    socket.on('error', (error: any) => {
      console.error('[TRIX Native Monitor] Socket.IO error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('[TRIX Native Monitor] Socket.IO disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('[TRIX Native Monitor] Connection error:', error.message);
    });
  } catch (error) {
    console.error('[TRIX Native Monitor] Failed to start:', error);
  }
}

/**
 * 停止 Socket.IO 连接
 */
export function stopMonitor(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[TRIX Native Monitor] Stopped');
  }
}
