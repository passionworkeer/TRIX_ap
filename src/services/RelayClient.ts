/**
 * RelayClient Service
 *
 * 连接 ClawPilot 兼容的中继服务器
 * 用于通过中继服务器连接 OpenClaw Gateway
 */

import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

export interface RelayQRPayload {
  version: number;
  server: string;
  gatewayId: string;
  accessCode: string;
  displayName: string;
}

export interface RelayConnectionOptions {
  server: string;
  gatewayId: string;
  accessCode: string;
}

class RelayClient {
  private socket: Socket | null = null;
  private serverUrl: string | null = null;
  private gatewayId: string | null = null;
  private accessCode: string | null = null;
  private connected = false;
  private authenticated = false;
  private eventListeners = new Map<string, Set<(data: unknown) => void>>();

  constructor() {}

  /**
   * 解析 QR 码内容
   */
  parseQRContent(content: string): RelayQRPayload | null {
    try {
      const payload = JSON.parse(content);

      // 验证必要字段
      if (!payload.server || !payload.gatewayId || !payload.accessCode) {
        logger.relay.warn('[RelayClient] Invalid QR payload:', payload);
        return null;
      }

      return payload as RelayQRPayload;
    } catch (error) {
      logger.relay.error('[RelayClient] Failed to parse QR content:', error);
      return null;
    }
  }

  /**
   * 连接中继服务器
   */
  async connect(options: RelayConnectionOptions): Promise<void> {
    const { server, gatewayId, accessCode } = options;

    this.serverUrl = server.replace(/^http/, 'ws') + '/relay-client';
    this.gatewayId = gatewayId;
    this.accessCode = accessCode;

    return new Promise((resolve, reject) => {
      try {
        // 转换 http/https 到 ws/wss
        const wsUrl = server.replace(/^http/, 'ws') + '/relay-client';
        logger.relay.info('[RelayClient] Connecting to:', wsUrl);

        this.socket = io(wsUrl, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });

        this.socket.on('connect', () => {
          logger.relay.debug('[RelayClient] Socket connected');
          this.connected = true;

          // 认证
          this.socket?.emit('auth', {
            gatewayId,
            accessCode,
          }, (response: { ok: boolean; error?: string; device?: unknown }) => {
            if (response.ok) {
              this.authenticated = true;
              logger.relay.info('[RelayClient] Authenticated successfully');
              this.emit('authenticated', response.device);
              resolve();
            } else {
              this.authenticated = false;
              logger.relay.error('[RelayClient] Auth failed:', response.error);
              reject(new Error(response.error || 'Authentication failed'));
            }
          });
        });

        this.socket.on('disconnect', () => {
          logger.relay.debug('[RelayClient] Disconnected');
          this.connected = false;
          this.authenticated = false;
          this.emit('disconnect');
        });

        this.socket.on('connect_error', (error) => {
          logger.relay.error('[RelayClient] Connection error:', error);
          reject(error);
        });

        // 监听来自设备的消息
        this.socket.on('from_device', (data) => {
          logger.relay.debug('[RelayClient] Received from device:', data);
          this.emit('message', data);
        });

        // 监听网关连接请求响应
        this.socket.on('gateway_status', (data) => {
          this.emit('gateway_status', data);
        });

        // 设置连接超时
        setTimeout(() => {
          if (!this.connected) {
            this.socket?.disconnect();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 发送消息到设备
   */
  sendToDevice(method: string, params?: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.authenticated) {
        reject(new Error('Not connected or authenticated'));
        return;
      }

      this.socket.emit('to_device', { method, params }, (response: { ok: boolean; error?: string }) => {
        if (response.ok) {
          resolve();
        } else {
          reject(new Error(response.error || 'Send failed'));
        }
      });
    });
  }

  /**
   * 请求连接设备 Gateway
   */
  async connectGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.authenticated) {
        reject(new Error('Not connected or authenticated'));
        return;
      }

      this.socket.emit('connect_gateway', {}, (response: { ok: boolean; error?: string }) => {
        if (response.ok) {
          resolve();
        } else {
          reject(new Error(response.error || 'Connect gateway failed'));
        }
      });
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.eventListeners.clear();
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  /**
   * 获取 Gateway ID
   */
  getGatewayId(): string | null {
    return this.gatewayId;
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * 添加事件监听
   */
  on<T = unknown>(event: string, handler: (data: T) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler as (data: unknown) => void);
  }

  /**
   * 移除事件监听
   */
  off<T = unknown>(event: string, handler: (data: T) => void): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler as (data: unknown) => void);
    }
  }

  /**
   * 触发事件
   */
  private emit<T = unknown>(event: string, data?: T): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.relay.error(`[RelayClient] Event handler error (${event}):`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const relayClient = new RelayClient();
export default relayClient;
