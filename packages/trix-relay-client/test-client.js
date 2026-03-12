/**
 * Test script for @trix-app/relay-client
 *
 * This script tests:
 * 1. RelayClient - connects to relay server via WebSocket
 * 2. GatewayClient - connects to local Gateway directly
 */

import { RelayClient, GatewayClient } from './dist/index.js';

// Configuration
const RELAY_SERVER = process.env.RELAY_SERVER || 'ws://47.243.55.130:8765';
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || 'da7be43639a59da4beb2bf9a60548aecd1138da3eb00e3b1';

async function testRelayClient() {
  console.log('\n========== Testing RelayClient ==========');
  console.log(`Server: ${RELAY_SERVER}`);

  const client = new RelayClient();

  client.on('error', (err) => {
    console.error('[RelayClient] Error:', err);
  });

  client.on('disconnect', (reason) => {
    console.log('[RelayClient] Disconnected:', reason);
  });

  client.on('authenticated', (deviceInfo) => {
    console.log('[RelayClient] Authenticated:', deviceInfo);
  });

  try {
    // Note: Need valid gatewayId and accessCode from pairing
    // For now, just test connection
    console.log('[RelayClient] Attempting to connect...');
    await client.connect({
      server: RELAY_SERVER.replace('ws://', 'http://').replace('wss://', 'https://'),
      gatewayId: 'test-device',
      accessCode: 'test-code'
    });
    console.log('[RelayClient] Connected!');
  } catch (err) {
    console.log('[RelayClient] Connection error (expected):', err.message);
  }
}

async function testGatewayClient() {
  console.log('\n========== Testing GatewayClient ==========');
  console.log(`Gateway: ${GATEWAY_URL}`);

  const client = new GatewayClient();

  client.on('error', (err) => {
    console.error('[GatewayClient] Error:', err);
  });

  client.on('disconnect', (reason) => {
    console.log('[GatewayClient] Disconnected:', reason);
  });

  client.on('connected', () => {
    console.log('[GatewayClient] Connected to Gateway!');
  });

  // Use device identity from OpenClaw
  const deviceId = '5c9737a3181f97504a805adc6986b5c3539187ba7712c962e8e7f9c33f67e3b9';
  const deviceKey = 'MC4CAQAwBQYDK2VwBCIEIEj4pjtFjE9vFGQA4Pg/ycEVlvxAJApmV4ODlhFX8HxB';

  try {
    console.log('[GatewayClient] Attempting to connect...');
    await client.connect({
      url: GATEWAY_URL,
      token: GATEWAY_TOKEN,
      deviceId: deviceId,
      deviceKey: deviceKey,
    });
    console.log('[GatewayClient] Connected!');

    // Keep connection alive for a few seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    client.disconnect();
    console.log('[GatewayClient] Disconnected');
  } catch (err) {
    console.log('[GatewayClient] Connection error:', err.message);
  }
}

async function main() {
  console.log('TRIX Relay Client Test');
  console.log('========================');

  // Test Gateway connection (direct to local)
  await testGatewayClient();

  // Test Relay connection (via server)
  await testRelayClient();

  console.log('\n========== Tests Complete ==========');
}

main().catch(console.error);
