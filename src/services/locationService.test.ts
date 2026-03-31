/**
 * Unit tests for locationService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock navigator
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};

Object.defineProperty(global, 'navigator', {
  value: {
    geolocation: mockGeolocation,
    permissions: {
      query: vi.fn(),
    },
  },
});

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getFriendsLocations,
  updateMyLocation,
  getLocationShareSettings,
  updateLocationShareSettings,
  checkLocationPermission,
  getCurrentPosition,
} from './locationService';

describe('locationService', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getFriendsLocations', () => {
    it('should require authentication', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(getFriendsLocations()).rejects.toThrow('请先登录');
    });

    it('should return empty array when no friends', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const locations = await getFriendsLocations();
      expect(locations).toEqual([]);
    });

    it('should map joined profile data from profiles relation', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const friendsQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  friend_id: 'friend-1',
                  profiles: {
                    username: 'Alice',
                    avatar_url: 'https://example.com/alice.png',
                    status: 'online',
                  },
                },
              ],
              error: null,
            }),
          }),
        }),
      };

      const locationsQuery = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  user_id: 'friend-1',
                  latitude: 31.2304,
                  longitude: 121.4737,
                  accuracy: 15,
                  updated_at: '2026-03-31T10:00:00.000Z',
                  is_sharing: true,
                },
              ],
              error: null,
            }),
          }),
        }),
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce(friendsQuery as any)
        .mockReturnValueOnce(locationsQuery as any);

      const locations = await getFriendsLocations();

      expect(locations).toEqual([
        {
          friendId: 'friend-1',
          name: 'Alice',
          avatar: 'https://example.com/alice.png',
          latitude: 31.2304,
          longitude: 121.4737,
          accuracy: 15,
          timestamp: '2026-03-31T10:00:00.000Z',
          status: 'online',
          isStudying: false,
        },
      ]);
    });
  });

  describe('updateMyLocation', () => {
    it('should require authentication', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(updateMyLocation({
        latitude: 31.2304,
        longitude: 121.4737,
      })).rejects.toThrow('请先登录');
    });
  });

  describe('getLocationShareSettings', () => {
    it('should return disabled settings when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const settings = await getLocationShareSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.visibility).toBe('nobody');
    });
  });

  describe('updateLocationShareSettings', () => {
    it('should require authentication', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(updateLocationShareSettings({
        enabled: true,
      })).rejects.toThrow('请先登录');
    });
  });

  describe('checkLocationPermission', () => {
    it('should return true when permission granted', async () => {
      vi.mocked(navigator.permissions.query).mockResolvedValue({
        state: 'granted',
      } as any);

      const hasPermission = await checkLocationPermission();
      expect(hasPermission).toBe(true);
    });

    it('should return false when permission denied', async () => {
      vi.mocked(navigator.permissions.query).mockResolvedValue({
        state: 'denied',
      } as any);

      const hasPermission = await checkLocationPermission();
      expect(hasPermission).toBe(false);
    });
  });

  describe('getCurrentPosition', () => {
    it('should resolve with position on success', async () => {
      const mockPosition = {
        coords: {
          latitude: 31.2304,
          longitude: 121.4737,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const position = await getCurrentPosition();
      expect(position.coords.latitude).toBe(31.2304);
      expect(position.coords.longitude).toBe(121.4737);
    });

    it('should reject on permission denied', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
        // The error object needs to have the right properties
        const errorObj = new Error('Permission denied');
        (errorObj as any).code = 1;
        error(errorObj);
      });

      await expect(getCurrentPosition()).rejects.toThrow('获取位置失败'); // Generic error message
    });

    it('should reject when geolocation not supported', async () => {
      const originalGeolocation = navigator.geolocation;
      delete (navigator as any).geolocation;

      await expect(getCurrentPosition()).rejects.toThrow('浏览器不支持地理位置功能');

      (navigator as any).geolocation = originalGeolocation;
    });
  });
});
