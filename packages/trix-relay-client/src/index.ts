/**
 * TRIX Relay Client
 *
 * WebSocket client for OpenClaw Gateway
 * Compatible with ClawPilot protocol
 *
 * @package @trix-app/relay-client
 */

export { GatewayClient } from './GatewayClient.js';
export { RelayClient } from './RelayClient.js';

export * from './types.js';
export * from './protocol.js';
export * from './crypto.js';

// Default exports
import { GatewayClient } from './GatewayClient.js';
import { RelayClient } from './RelayClient.js';

export default {
  GatewayClient,
  RelayClient,
};
