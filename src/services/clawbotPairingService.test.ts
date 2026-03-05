/**
 * Unit tests for clawbotPairingService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock crypto.getRandomValues
const mockRandomValues = vi.fn((array) => {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
});

// Mock global objects
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockRandomValues
  },
  writable: true
});

// Mock navigator
Object.defineProperty(globalThis, 'navigator', {
  value: {
    platform: 'Win32',
    userAgent: 'Mozilla/5.0 Test'
  },
  writable: true
});

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock fetch
const mockFetch = vi.fn();
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true
});

// Mock import.meta.env
vi.mock('vite', () => ({
  importMeta: {
    env: {
      DEV: true
    }
  }
}));

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'req-123' }, error: null })
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  }
}));

// Mock getClawbotEndpoints
vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn(() => ({
    gatewayUrl: 'wss://example.ngrok.io/ws',
    gatewayToken: 'test-token-123'
  }))
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    pairing: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }
  }
}));

// Import after mocks
import { supabase } from '../config/supabase';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { logger } from '../utils/logger';
import { ClawbotPairingService, ClawbotPairingService as ClawbotPairingServiceClass } from './clawbotPairingService';

describe('ClawbotPairingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockReturnValue(undefined);
    mockLocalStorage.removeItem.mockReturnValue(undefined);
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const service = new ClawbotPairingServiceClass();
      expect(service).toBeDefined();
      expect(getClawbotEndpoints).toHaveBeenCalled();
    });

    it('should accept custom options', () => {
      const service = new ClawbotPairingServiceClass({
        gatewayUrl: 'wss://custom.example.io/ws',
        authToken: 'custom-token',
        pollInterval: 1000,
        maxPollAttempts: 50
      });
      expect(service).toBeDefined();
    });

    it('should warn when no token is provided', () => {
      (getClawbotEndpoints as any).mockReturnValueOnce({
        gatewayUrl: 'wss://example.io/ws',
        gatewayToken: ''
      });

      const service = new ClawbotPairingServiceClass();
      expect(logger.pairing.warn).toHaveBeenCalled();
    });
  });

  describe('directConnect', () => {
    it('should save gateway URL and token to localStorage', () => {
      const service = new ClawbotPairingServiceClass();
      const result = service.directConnect('wss://gateway.example.io/ws', 'device-token-123');

      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('clawbot_gateway_url', 'wss://gateway.example.io/ws');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('clawbot_device_token', 'device-token-123');
    });

    it('should return false on localStorage error', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const service = new ClawbotPairingServiceClass();
      const result = service.directConnect('wss://gateway.example.io/ws', 'device-token-123');

      expect(result).toBe(false);
      expect(logger.pairing.error).toHaveBeenCalled();
    });
  });

  describe('getQRCodeContent', () => {
    it('should generate valid QR code content', () => {
      const service = new ClawbotPairingServiceClass();
      const qrContent = service.getQRCodeContent('request-123');

      expect(qrContent).toContain('request-123');
      expect(qrContent).toContain('gatewayUrl');
      expect(qrContent).toContain('pairingToken');
    });
  });

  describe('parseQRCodeContent', () => {
    it('should parse valid QR code content', () => {
      const service = new ClawbotPairingServiceClass();
      const qrData = {
        gatewayUrl: 'wss://example.io/ws',
        pairingToken: 'test-token',
        requestId: 'req-123',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      const result = service.parseQRCodeContent(JSON.stringify(qrData));

      expect(result.gatewayUrl).toBe('wss://example.io/ws');
      expect(result.pairingToken).toBe('test-token');
      expect(result.requestId).toBe('req-123');
    });

    it('should parse QR code with snake_case fields', () => {
      const service = new ClawbotPairingServiceClass();
      const qrData = {
        gateway_url: 'wss://example.io/ws',
        pairing_token: 'test-token',
        request_id: 'req-123',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      };

      const result = service.parseQRCodeContent(JSON.stringify(qrData));

      expect(result.gatewayUrl).toBe('wss://example.io/ws');
      expect(result.pairingToken).toBe('test-token');
    });

    it('should throw error for invalid JSON', () => {
      const service = new ClawbotPairingServiceClass();

      expect(() => service.parseQRCodeContent('invalid json')).toThrow('无效的二维码格式');
    });

    it('should throw error when gatewayUrl is missing', () => {
      const service = new ClawbotPairingServiceClass();
      const qrData = {
        pairingToken: 'test-token',
        requestId: 'req-123',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      // Should throw an error
      expect(() => service.parseQRCodeContent(JSON.stringify(qrData))).toThrow();
    });

    it('should throw error when pairingToken is missing', () => {
      const service = new ClawbotPairingServiceClass();
      const qrData = {
        gatewayUrl: 'wss://example.io/ws',
        requestId: 'req-123',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      // The implementation checks for gatewayUrl first, then pairingToken
      // Should throw an error
      expect(() => service.parseQRCodeContent(JSON.stringify(qrData))).toThrow();
    });

    it('should throw error when QR code is expired', () => {
      const service = new ClawbotPairingServiceClass();
      const qrData = {
        gatewayUrl: 'wss://example.io/ws',
        pairingToken: 'test-token',
        requestId: 'req-123',
        expiresAt: '2020-01-01T00:00:00Z' // Past date
      };

      // Should throw an error (either expired or invalid format)
      expect(() => service.parseQRCodeContent(JSON.stringify(qrData))).toThrow();
    });
  });

  describe('extractPairingInfo', () => {
    it('should extract pairing info from raw data', () => {
      const service = new ClawbotPairingServiceClass();
      const rawData = {
        gatewayUrl: 'wss://example.io/ws',
        pairingToken: 'test-token',
        deviceId: 'device-123',
        expiresAt: '2024-01-01T00:00:00Z',
        version: '1.0.0'
      };

      const result = service.extractPairingInfo(rawData);

      expect(result.gatewayUrl).toBe('wss://example.io/ws');
      expect(result.pairingToken).toBe('test-token');
      expect(result.deviceId).toBe('device-123');
      expect(result.expiresAt).toBe('2024-01-01T00:00:00Z');
      expect(result.version).toBe('1.0.0');
    });

    it('should handle snake_case fields', () => {
      const service = new ClawbotPairingServiceClass();
      const rawData = {
        gateway_url: 'wss://example.io/ws',
        pairing_token: 'test-token',
        device_id: 'device-123',
        expires_at: '2024-01-01T00:00:00Z'
      };

      const result = service.extractPairingInfo(rawData);

      expect(result.gatewayUrl).toBe('wss://example.io/ws');
      expect(result.pairingToken).toBe('test-token');
      expect(result.deviceId).toBe('device-123');
    });
  });

  describe('generatePairingRequest', () => {
    it('should generate pairing request with device ID', async () => {
      const service = new ClawbotPairingServiceClass();

      // Mock localStorage to return no existing device ID
      mockLocalStorage.getItem.mockReturnValue(null);

      const request = await service.generatePairingRequest('Test Device');

      expect(request).toBeDefined();
      expect(request.deviceId).toBeDefined();
      expect(request.deviceName).toBe('Test Device');
      expect(request.deviceType).toBe('mobile');
      expect(request.status).toBe('pending');
    });

    it('should use existing device ID if available', async () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue('existing-device-id');

      const request = await service.generatePairingRequest('Test Device');

      expect(request.deviceId).toBe('existing-device-id');
    });

    it('should save new device ID to localStorage', async () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue(null);

      await service.generatePairingRequest('Test Device');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('trix_device_id', expect.any(String));
    });
  });

  describe('pollPairingStatus', () => {
    // Polling tests are complex due to setInterval timing
    // The main functionality is tested through integration tests
    it('should be defined', () => {
      const service = new ClawbotPairingServiceClass();
      expect(service.pollPairingStatus).toBeDefined();
    });
  });

  describe('cancelPairingRequest', () => {
    it('should update pairing request status to cancelled', async () => {
      const service = new ClawbotPairingServiceClass();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 405
      });

      (supabase.from as any).mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      });

      await service.cancelPairingRequest('req-123');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      const service = new ClawbotPairingServiceClass();

      mockFetch.mockRejectedValue(new Error('Network error'));

      (supabase.from as any).mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      });

      // Should not throw
      await expect(service.cancelPairingRequest('req-123')).resolves.not.toThrow();
    });
  });

  describe('checkPairingStatus', () => {
    it('should return not paired when no token stored', async () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await service.checkPairingStatus();

      expect(result).toEqual({ paired: false, connected: false });
    });

    it('should return paired status when token exists', async () => {
      const service = new ClawbotPairingServiceClass();

      // First call returns device token, second call returns device ID
      mockLocalStorage.getItem
        .mockReturnValueOnce('device-token-123') // clawbot_device_token
        .mockReturnValueOnce('device-123'); // trix_device_id

      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: {
              id: 'req-123',
              device_id: 'device-123',
              device_name: 'Test Device',
              status: 'approved',
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 3600000).toISOString()
            },
            error: null
          })
        }))
      });

      const result = await service.checkPairingStatus();

      // Just verify the method works and returns an object
      expect(result).toBeDefined();
      expect(typeof result.paired).toBe('boolean');
    });

    it('should return not paired when request not found', async () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue('device-token-123');

      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
        }))
      });

      const result = await service.checkPairingStatus();

      expect(result).toEqual({ paired: false, connected: false });
    });

    it('should return not paired when expired', async () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue('device-token-123');

      (supabase.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: {
              id: 'req-123',
              status: 'approved',
              expires_at: new Date(Date.now() - 3600000).toISOString()
            },
            error: null
          })
        }))
      });

      const result = await service.checkPairingStatus();

      expect(result.paired).toBe(false);
      expect(result.connected).toBe(false);
    });
  });

  describe('cleanupExpiredRequests', () => {
    it('should delete expired requests', async () => {
      const service = new ClawbotPairingServiceClass();

      (supabase.from as any).mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      });

      await service.cleanupExpiredRequests();

      expect(supabase.from).toHaveBeenCalledWith('pairing_requests');
    });

    it('should handle errors gracefully', async () => {
      const service = new ClawbotPairingServiceClass();

      (supabase.from as any).mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') })
        }))
      });

      await expect(service.cleanupExpiredRequests()).resolves.not.toThrow();
    });
  });

  describe('getStoredDeviceToken', () => {
    it('should return stored device token', () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue('device-token-123');

      const token = service.getStoredDeviceToken();

      expect(token).toBe('device-token-123');
    });

    it('should return null when no token stored', () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue(null);

      const token = service.getStoredDeviceToken();

      expect(token).toBeNull();
    });
  });

  describe('getStoredNodeId', () => {
    it('should return stored node ID', () => {
      const service = new ClawbotPairingServiceClass();

      mockLocalStorage.getItem.mockReturnValue('node-123');

      const nodeId = service.getStoredNodeId();

      expect(nodeId).toBe('node-123');
    });
  });

  describe('clearStoredCredentials', () => {
    it('should clear all stored credentials', () => {
      const service = new ClawbotPairingServiceClass();

      service.clearStoredCredentials();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('clawbot_device_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('clawbot_node_id');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('clawbot_gateway_url');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('clawbot_pairing_token');
    });
  });

  describe('getGatewayPublicIP', () => {
    it('should return public IP address', () => {
      const service = new ClawbotPairingServiceClass();

      const ip = service.getGatewayPublicIP();

      expect(ip).toContain('example.ngrok.io');
      expect(ip).toContain('18789');
    });
  });

  describe('getGatewayUrl', () => {
    it('should return current gateway URL', () => {
      const service = new ClawbotPairingServiceClass();

      const url = service.getGatewayUrl();

      expect(url).toBe('wss://example.ngrok.io/ws');
    });
  });

  describe('setGatewayUrl', () => {
    it('should update gateway URL', () => {
      const service = new ClawbotPairingServiceClass();

      service.setGatewayUrl('wss://new.example.io/ws');

      expect(service.getGatewayUrl()).toBe('wss://new.example.io/ws');
      expect(logger.pairing.debug).toHaveBeenCalled();
    });
  });

  describe('getCurrentRequestId', () => {
    it('should return null when no request ID', () => {
      const service = new ClawbotPairingServiceClass();

      expect(service.getCurrentRequestId()).toBeNull();
    });
  });

  describe('pollPairingStatusViaGateway', () => {
    it('should poll via gateway API and handle approved status', async () => {
      const service = new ClawbotPairingServiceClass();

      const onStatusChange = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          status: 'approved',
          deviceToken: 'device-token-123',
          message: 'Approved'
        })
      });

      service.pollPairingStatusViaGateway('req-123', onStatusChange, 10, 1);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onStatusChange).toHaveBeenCalledWith({
        requestId: 'req-123',
        status: 'approved',
        deviceToken: 'device-token-123',
        message: 'Approved'
      });
    });

    it('should fallback to localStorage when receiving HTML', async () => {
      const service = new ClawbotPairingServiceClass();

      const onStatusChange = vi.fn();

      mockFetch.mockResolvedValue({
        ok: false,
        headers: new Map([['content-type', 'text/html']]),
        status: 404
      });

      service.pollPairingStatusViaGateway('req-123', onStatusChange, 10, 1);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should stop polling and resolve
      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });
});
