/**
 * GatewayClient Tests
 *
 * Unit tests for GatewayClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createReqFrame,
  parseFrame,
  isEvtFrame,
  isResFrame,
  serializeFrame,
} from '../src/protocol';
import {
  generateKeyPair,
  buildSignedDevice,
  generateRandomId,
  base64UrlEncode,
  base64UrlDecode,
} from '../src/crypto';
import { GatewayClient } from '../src/GatewayClient';

describe('GatewayClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Protocol', () => {
    it('should create request frame with correct structure', () => {
      const frame = createReqFrame('test.method', { param1: 'value1' });

      expect(frame.type).toBe('req');
      expect(frame.method).toBe('test.method');
      expect(frame.params).toEqual({ param1: 'value1' });
      expect(frame.id).toBeDefined();
      expect(typeof frame.id).toBe('string');
    });

    it('should parse valid response frame', () => {
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

    it('should parse valid event frame', () => {
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

    it('should return null for invalid JSON', () => {
      const frame = parseFrame('not valid json');
      expect(frame).toBeNull();
    });

    it('should serialize frame to JSON string', () => {
      const frame = createReqFrame('test.method', {});
      const serialized = serializeFrame(frame);

      expect(serialized).toBe(JSON.stringify(frame));
    });
  });

  describe('Crypto', () => {
    it('should generate key pair', async () => {
      const keys = await generateKeyPair();

      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toBeDefined();
      expect(typeof keys.publicKey).toBe('string');
      expect(typeof keys.privateKey).toBe('string');
    });

    it('should generate random ID of specified length', () => {
      const id16 = generateRandomId(16);
      const id32 = generateRandomId(32);

      expect(id16.length).toBe(32); // hex = 2x bytes
      expect(id32.length).toBe(64); // hex = 2x bytes
    });

    it('should build signed device payload', async () => {
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

    it('should encode/decode base64 URL safe', () => {
      const testBytes = new Uint8Array([1, 2, 3, 255, 128, 64]);

      const encoded = base64UrlEncode(testBytes);
      const decoded = base64UrlDecode(encoded);

      expect(decoded).toEqual(testBytes);
    });
  });

  describe('GatewayClient Connection', () => {
    it('should create instance without error', () => {
      const client = new GatewayClient();
      expect(client).toBeDefined();
    });

    it('should have isConnected return false before connection', () => {
      const client = new GatewayClient();
      expect(client.isConnected()).toBe(false);
    });

    it('should have getDeviceId return null before connection', () => {
      const client = new GatewayClient();
      expect(client.getDeviceId()).toBeNull();
    });

    it('should support event listeners', () => {
      const client = new GatewayClient();

      const handler = vi.fn();
      client.on('test-event', handler);
      client.on('test-event', handler); // Add twice

      expect(client.isConnected()).toBe(false);
    });

    it('should throw error when requesting without connection', () => {
      const client = new GatewayClient();

      expect(() => client.request('test.method', {})).rejects.toThrow('gateway not connected');
    });
  });

  describe('Types', () => {
    it('should have correct ReqFrame structure', () => {
      const frame = createReqFrame('method', { key: 'value' });

      // TypeScript compilation test - if this passes, types are correct
      const _typeCheck: 'req' = frame.type;
      expect(_typeCheck).toBe('req');
    });

    it('should allow optional params', () => {
      const frame = createReqFrame('method');

      expect(frame.params).toBeUndefined();
    });
  });
});
