/**
 * RelayClient Service
 *
 * 连接 ClawPilot 兼容的中继服务器
 * 使用原生 WebSocket + JSON-RPC 协议
 * 兼容 ClawPilot NPM 包
 */

import { RelayClient as BaseRelayClient } from '@trix-app/relay-client';
import { logger } from '../utils/logger';

export interface RelayQRPayload {
  version: number;
  server: string;
  gatewayId: string;
  accessCode: string;
  displayName?: string;
}

export interface RelayConnectionOptions {
  server: string;
  gatewayId: string;
  accessCode: string;
}

class RelayClientWrapper extends BaseRelayClient {
  constructor() {
    super();

    // 添加日志
    this.on('connect', () => {
      logger.relay.debug('[RelayClient] Connected');
    });

    this.on('disconnect', (reason) => {
      logger.relay.debug('[RelayClient] Disconnected:', reason);
    });

    this.on('authenticated', (deviceInfo) => {
      logger.relay.info('[RelayClient] Authenticated:', deviceInfo);
    });

    this.on('error', (error) => {
      logger.relay.error('[RelayClient] Error:', error);
    });
  }

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
}

// Export singleton instance
export const relayClient = new RelayClientWrapper();
export default relayClient;
