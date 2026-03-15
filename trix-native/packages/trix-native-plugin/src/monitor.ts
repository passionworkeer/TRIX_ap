// ============================================
// TRIX Native Monitor - WebSocket 长连接接收消息
// ============================================

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';

let ws: WebSocket | null = null;

/**
 * 启动 WebSocket 监控服务
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

    // 建立 WebSocket 连接
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[TRIX Native Monitor] WebSocket connected');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        console.log('[TRIX Native Monitor] Received:', data.type);

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
        console.error('[TRIX Native Monitor] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[TRIX Native Monitor] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[TRIX Native Monitor] WebSocket closed, reconnecting in 5s...');
      // 断线后 5 秒重连
      setTimeout(() => startMonitor(api, ctx), 5000);
    };
  } catch (error) {
    console.error('[TRIX Native Monitor] Failed to start:', error);
  }
}

/**
 * 停止 WebSocket 连接
 */
export function stopMonitor(): void {
  if (ws) {
    ws.close();
    ws = null;
    console.log('[TRIX Native Monitor] Stopped');
  }
}
