/**
 * Gateway WebSocket Service
 *
 * 与 OpenClaw Gateway 通信，发送消息并获取 AI 响应
 */

const WebSocket = require('ws');

// Gateway 配置
const GATEWAY_URL = process.env.GATEWAY_WS_URL || 'ws://127.0.0.1:18789';
const GATEWAY_AUTH_TOKEN = process.env.GATEWAY_AUTH_TOKEN || process.env.VITE_GATEWAY_AUTH_TOKEN || '';
const CLIENT_ID = 'trix-channel-supplement';
const CLIENT_MODE = 'backend';
const ROLE = 'operator';

// 固定的 session key 用于主智能体
const MAIN_AGENT_SESSION = 'agent:main:main';

class GatewayService {
  constructor() {
    this.ws = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.connecting = false;
    this.messageHandler = null;
  }

  /**
   * 生成请求 ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${this.requestId++}`;
  }

  /**
   * 连接到 Gateway
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.connecting) {
        // 等待现有连接完成
        const checkConnection = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.connecting = true;
      console.log(`[GatewayService] Connecting to ${GATEWAY_URL}...`);

      try {
        this.ws = new WebSocket(GATEWAY_URL, {
          headers: {
            'X-Client-ID': CLIENT_ID,
            'X-Client-Mode': CLIENT_MODE,
            'X-Role': ROLE,
            'Authorization': `Bearer ${GATEWAY_AUTH_TOKEN}`
          }
        });

        this.ws.on('open', () => {
          console.log('[GatewayService] Connected to Gateway');
          this.connecting = false;
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          console.error('[GatewayService] WebSocket error:', error.message);
          this.connecting = false;
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('[GatewayService] Gateway disconnected');
          this.ws = null;
          // 尝试重连
          setTimeout(() => this.connect().catch(() => {}), 5000);
        });
      } catch (error) {
        this.connecting = false;
        reject(error);
      }
    });
  }

  /**
   * 处理收到的消息
   */
  handleMessage(data) {
    try {
      const msg = JSON.parse(data.toString());
      // console.log('[GatewayService] Received:', msg.type, msg.id);

      if (msg.type === 'req' && msg.id) {
        // 这是对之前请求的响应
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            pending.reject(new Error(msg.error.message || msg.error));
          } else {
            pending.resolve(msg.result || msg.payload);
          }
        }
      } else if (msg.type === 'event') {
        // 事件消息
        if (this.messageHandler) {
          this.messageHandler(msg);
        }
      }
    } catch (error) {
      console.error('[GatewayService] Failed to parse message:', error);
    }
  }

  /**
   * 发送请求并等待响应
   */
  sendRequest(method, params = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.connect();

        const requestId = this.generateRequestId();
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Gateway request ${method} timeout`));
        }, 60000); // 60秒超时

        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });

        this.ws.send(JSON.stringify({
          type: 'req',
          id: requestId,
          method,
          params
        }));

        console.log(`[GatewayService] -> ${method}:`, params.message?.slice(0, 50) || '');
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 发送聊天消息并获取 AI 响应
   */
  async sendChatMessage(message, sessionKey = MAIN_AGENT_SESSION) {
    try {
      const result = await this.sendRequest('chat.send', {
        sessionKey,
        message,
        idempotencyKey: `trix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      });

      console.log('[GatewayService] <- chat.send result');
      return result;
    } catch (error) {
      console.error('[GatewayService] sendChatMessage error:', error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 导出单例
module.exports = new GatewayService();
