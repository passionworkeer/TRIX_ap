/**
 * Gateway Service - 长连接方式
 *
 * 使用 GatewayClient 建立持久连接，支持会话记忆
 */

const { randomUUID } = require('crypto');

// Gateway 配置
const GATEWAY_URL = process.env.GATEWAY_WS_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_AUTH_TOKEN || '2182a91f677257a06f28ebe9172333aa0df9adad397ac149';

class GatewayService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connecting = false;
    this.messageQueue = [];
    this.pendingInit = null;
  }

  async connect() {
    if (this.connected || this.connecting) {
      if (this.pendingInit) return this.pendingInit;
      return;
    }

    this.connecting = true;
    this.pendingInit = this._connect();

    try {
      await this.pendingInit;
      this.connected = true;
      console.log('[GatewayService] Connected to Gateway');
    } catch (e) {
      console.error('[GatewayService] Connection failed:', e.message);
      this.connecting = false;
      throw e;
    } finally {
      this.pendingInit = null;
    }
  }

  async _connect() {
    // 动态导入 ESM 模块
    const { GatewayClient } = await import('file:///C:/nodejs_global/node_modules/openclaw-cn/dist/gateway/client.js');
    const { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } = await import('file:///C:/nodejs_global/node_modules/openclaw-cn/dist/utils/message-channel.js');
    const { loadOrCreateDeviceIdentity } = await import('file:///C:/nodejs_global/node_modules/openclaw-cn/dist/infra/device-identity.js');

    const deviceIdentity = loadOrCreateDeviceIdentity();
    console.log('[GatewayService] Device:', deviceIdentity?.deviceId);

    this.client = new GatewayClient({
      url: GATEWAY_URL,
      token: GATEWAY_TOKEN,
      clientName: GATEWAY_CLIENT_NAMES.CONTROL_UI,
      clientDisplayName: 'TRIX Channel Server',
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      role: 'operator',
      scopes: ['operator.admin', 'operator.read', 'operator.write'],
      deviceIdentity: deviceIdentity,
      onConnectError: (err) => {
        console.error('[GatewayService] Connect error:', err.message);
        this.connected = false;
      },
      onClose: (code, reason) => {
        console.log('[GatewayService] Connection closed:', code, reason);
        this.connected = false;
      },
    });

    this.client.start();

    // 等待连接建立
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);

      const checkConnection = () => {
        if (this.client.ws && this.client.ws.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });

    console.log('[GatewayService] GatewayClient ready');
  }

  async sendChatMessage(message, sessionKey = 'agent:main:main') {
    if (!this.connected || !this.client) {
      await this.connect();
    }

    const idempotencyKey = randomUUID();

    try {
      const result = await this.client.request('agent', {
        message: message,
        sessionKey: sessionKey,
        idempotencyKey: idempotencyKey
      }, { expectFinal: true });

      const text = result.result?.payloads?.[0]?.text;
      console.log('[GatewayService] <- response:', text?.slice(0, 50) || 'ok');

      return result;
    } catch (e) {
      // 如果连接断开，尝试重连
      if (e.message.includes('not connected') || e.message.includes('closed')) {
        console.log('[GatewayService] Reconnecting...');
        this.connected = false;
        this.connecting = false;
        await this.connect();
        return this.sendChatMessage(message, sessionKey);
      }
      throw e;
    }
  }

  close() {
    if (this.client) {
      this.client.stop();
      this.client = null;
    }
    this.connected = false;
    this.connecting = false;
    console.log('[GatewayService] Closed');
  }
}

module.exports = new GatewayService();
