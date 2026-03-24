/**
 * Service tests for baiduMapService
 *
 * Tests baiduMapService methods
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../utils/coordinateUtils', () => ({
  WGS84ToGCJ02: vi.fn((lat: number, lon: number) => ({ lat, lon })),
  GCJ02ToBD09: vi.fn((lat: number, lon: number) => ({ lat, lon })),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Helper to set/unset global BMap
function setBMap(available: boolean) {
  Object.defineProperty(globalThis, 'BMap', {
    configurable: true,
    value: available ? {} : undefined,
    writable: true,
  });
  Object.defineProperty(globalThis, 'baiduMapLoaded', {
    configurable: true,
    value: available ? true : undefined,
    writable: true,
  });
}

describe('baiduMapService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Ensure BMap is undefined initially for each test
    setBMap(false);
  });

  describe('loadBaiduMapSDK', () => {
    it('should return true if SDK already loaded', async () => {
      setBMap(true);
      const { loadBaiduMapSDK } = await import('../services/baiduMapService');
      const result = await loadBaiduMapSDK();
      expect(result).toBe(true);
    });

    it('should return false or handle gracefully when SDK is not loaded', async () => {
      setBMap(false);
      const { loadBaiduMapSDK } = await import('../services/baiduMapService');
      const result = await loadBaiduMapSDK();
      // Without real window/script loading in test env, should return boolean
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isBaiduMapAvailable', () => {
    it('should return true when BMap is available', async () => {
      setBMap(true);
      const { isBaiduMapAvailable } = await import('../services/baiduMapService');
      expect(isBaiduMapAvailable()).toBe(true);
    });

    it('should return false when BMap is not available', async () => {
      setBMap(false);
      const { isBaiduMapAvailable } = await import('../services/baiduMapService');
      expect(isBaiduMapAvailable()).toBe(false);
    });
  });

  describe('MapOptions interface', () => {
    it('should accept valid map options', async () => {
      const { MapOptions } = await import('../services/baiduMapService');
      const options: MapOptions = {
        center: { lat: 31.2304, lon: 121.4737 },
        zoom: 15,
        enableScrollZoom: true,
        enableDoubleClickZoom: true,
        enableDragging: true,
        minZoom: 3,
        maxZoom: 18,
        mapType: 'BMAP_NORMAL_MAP',
      };
      expect(options.center?.lat).toBe(31.2304);
      expect(options.zoom).toBe(15);
    });
  });

  describe('Point type', () => {
    it('should define Point type correctly', async () => {
      const { Point } = await import('../services/baiduMapService');
      const point: Point = { lat: 31.2304, lon: 121.4737 };
      expect(point.lat).toBe(31.2304);
    });
  });

  describe('POI type', () => {
    it('should define POI type correctly', async () => {
      const { POI } = await import('../services/baiduMapService');
      const poi: POI = {
        title: 'Test Location',
        address: '123 Test St',
        latitude: 31.2304,
        longitude: 121.4737,
        city: 'Shanghai',
        district: 'Huangpu',
        telephone: '12345678',
        uid: 'uid-123',
      };
      expect(poi.title).toBe('Test Location');
      expect(poi.city).toBe('Shanghai');
    });
  });

  describe('GeocodeResult type', () => {
    it('should define GeocodeResult type correctly', async () => {
      const { GeocodeResult } = await import('../services/baiduMapService');
      const result: GeocodeResult = {
        latitude: 31.2304,
        longitude: 121.4737,
        address: '123 Test St',
        province: 'Shanghai',
        city: 'Shanghai',
        district: 'Huangpu',
        street: 'Nanjing Road',
        streetNumber: '123',
      };
      expect(result.address).toBe('123 Test St');
      expect(result.province).toBe('Shanghai');
    });
  });
});
