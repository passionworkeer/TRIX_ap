/**
 * GatewayClient Service
 *
 * WebSocket client for connecting to OpenClaw Gateway
 * Uses @trix-app/relay-client package
 */

import { GatewayClient as BaseGatewayClient } from '@trix-app/relay-client';
import { logger } from '../utils/logger';
import type { GatewayConnectionOptions, EventHandler } from '../types/gateway';

class GatewayClientWrapper extends BaseGatewayClient {
  constructor() {
    super();

    // 添加日志
    this.on('connect', () => {
      logger.gateway.debug('[GatewayClient] Connected');
    });

    this.on('disconnect', (reason) => {
      logger.gateway.debug('[GatewayClient] Disconnected:', reason);
    });

    this.on('error', (error) => {
      logger.gateway.error('[GatewayClient] Error:', error);
    });
  }
}

// Export singleton instance
export const gatewayClient = new GatewayClientWrapper();
export default gatewayClient;

// Re-export types for compatibility
export type { GatewayConnectionOptions, EventHandler };
