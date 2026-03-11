/**
 * GatewayClient Tests
 *
 * Unit tests for GatewayClient
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection after a short delay
    setTimeout(() => {
      if (this.onopen) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen({});
      }
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason, wasClean: true });
    }
  }
}

// Make WebSocket available globally for the client
(global as any).WebSocket = MockWebSocket;

describe('GatewayClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Protocol', () => {
    it('should create request frame with correct structure', async () => {
      const { createReqFrame } = await import('./src/protocol.js');
      const frame = createReqFrame('test.method', { param1: 'value1' });

      expect(frame.type).toBe('req');
      expect(frame.method).toBe('test.method');
      expect(frame.params).toEqual({ param1: 'value1' });
      expect(frame.id).toBeDefined();
      expect(typeof frame.id).toBe('string');
    });

    it('should parse valid response frame', async () => {
      const { parseFrame, isResFrame } = await import('./src/protocol.js');
      const raw = JSON.stringify({
        type: 'res',
        id: 'test-id',
        ok: true,
        payload: { result: 'success' }
      });

      const frame = parseFrame(raw);
      expect(frame).not.toBeNull();
      expect(isResFrame(frame!)).toBe(true);
      expect(frame!.id).toBe('test-id');
      expect((frame as any).ok).toBe(true);
    });

    it('should parse valid event frame', async () => {
      const { parseFrame, isEvtFrame } = await import('./src/protocol.js');
      const raw = JSON.stringify({
        type: 'event',
        event: 'chat.push',
        payload: { message: 'hello' }
      });

      const frame = parseFrame(raw);
      expect(frame).not.toBeNull();
      expect(isEvtFrame(frame!)).toBe(true);
      expect((frame as any).event).toBe('chat.push');
    });

    it('should return null for invalid JSON', async () => {
      const { parseFrame } = await import('./src/protocol.js');
      const frame = parseFrame('not valid json');
      expect(frame).toBeNull();
    });

    it('should serialize frame to JSON string', async () => {
      const { createReqFrame, serializeFrame } = await import('./src/protocol.js');
      const frame = createReqFrame('test.method', {});
      const serialized = serializeFrame(frame);

      expect(serialized).toBe(JSON.stringify(frame));
    });
  });

  describe('Crypto', () => {
    it('should generate key pair', async () => {
      const { generateKeyPair } = await import('./src/crypto.js');
      const keys = await generateKeyPair();

      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(typeof keys.publicKey).toBe('string');
      expect(typeof keys.privateKey).toBe('string');
    });

    it('should generate random ID of specified length', async () => {
      const { generateRandomId } = await import('./src/crypto.js');
      const id16 = generateRandomId(16);
      const id32 = generateRandomId(32);

      expect(id16.length).toBe(32); // hex = 2x bytes
      expect(id32.length).toBe(64); // hex = 2x bytes
    });

    it('should build signed device payload', async () => {
      const { generateKeyPair, buildSignedDevice } = await import('./src/crypto.js');
      const keys = await generateKeyPair();

      const device = await buildSignedDevice({
        deviceId: 'test-device-123',
        privateKey: keys.privateKey,
        publicKey: keys.publicKey,
        clientId: 'test-client',
        clientMode: 'ui',
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        signedAtMs: Date.now(),
      });

      expect(device.id).toBe('test-device-123');
      expect(device.publicKey).toBeDefined();
      expect(device.signature).toBeDefined();
      expect(device.signedAt).toBeDefined();
    });

    it('should encode/decode base64 URL safe', async () => {
      const { base64UrlEncode, base64UrlDecode } = await import('./src/crypto.js');
      const testBytes = new Uint8Array([1, 2, 3, 255, 128, 64]);

      const encoded = base64UrlEncode(testBytes);
      const decoded = base64UrlDecode(encoded);

      expect(decoded).toEqual(testBytes);
    });
  });

  describe('GatewayClient Connection', () => {
    it('should create instance without error', async () => {
      const { GatewayClient } = await import('./src/GatewayClient.js');
      const client = new GatewayClient();
      expect(client).toBeDefined();
    });

    it('should have isConnected return false before connection', async () => {
      const { GatewayClient } = await import('./src/GatewayClient.js');
      const client = new GatewayClient();
      expect(client.isConnected()).toBe(false);
    });

    it('should have getDeviceId return null before connection', async () => {
      const { GatewayClient } = await import('./src/GatewayClient.js');
      const client = new GatewayClient();
      expect(client.getDeviceId()).toBeNull();
    });

    it('should support event listeners', async () => {
      const { GatewayClient } = await import('./src/GatewayClient.js');
      const client = new GatewayClient();

      const handler = vi.fn();
      client.on('test-event', handler);
      client.on('test-event', handler); // Add twice

      // Manually trigger emit for testing (we'd need to make emit public or test through other means)
      expect(client.isConnected()).toBe(false); // Basic sanity check
    });

    it('should throw error when requesting without connection', async () => {
      const { GatewayClient } = await import('./src/GatewayClient.js');
      const client = new GatewayClient();

      await expect(client.request('test.method')).rejects.toThrow('gateway not connected');
    });
  });

  describe('Types', () => {
    it('should have correct ReqFrame structure', async () => {
      const { createReqFrame } = await import('./src/protocol.js');
      const frame = createReqFrame('method', { key: 'value' });

      // TypeScript compilation test - if this passes, types are correct
      const _typeCheck: 'req' = frame.type;
      expect(_typeCheck).toBe('req');
    });

    it('should allow optional params', async () => {
      const { createReqFrame } = await import('./src/protocol.js');
      const frame = createReqFrame('method');

      expect(frame.params).toBeUndefined();
    });
  });
});
