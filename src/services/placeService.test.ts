/**
 * Unit tests for placeService
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

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getNearbyPlaces,
  searchPlaces,
  getPlacesByCategory,
  toggleFavoritePlace,
  getFavoritePlaces,
} from './placeService';

describe('placeService', () => {
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

  describe('getNearbyPlaces', () => {
    it('should return places near location', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'place-1',
                  name: 'Test Cafe',
                  category: 'dining',
                  latitude: 31.2304,
                  longitude: 121.4737,
                  description: 'A test cafe',
                  emoji: '☕',
                },
              ],
              error: null,
            }),
          }),
        }),
      } as any);

      const places = await getNearbyPlaces({
        latitude: 31.2304,
        longitude: 121.4737,
        radius: 5000,
      });

      expect(Array.isArray(places)).toBe(true);
    });

    it('should filter by category when provided', async () => {
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

      const places = await getNearbyPlaces({
        latitude: 31.2304,
        longitude: 121.4737,
        category: 'dining',
      });

      expect(Array.isArray(places)).toBe(true);
    });
  });

  describe('searchPlaces', () => {
    it('should search places by query', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const places = await searchPlaces({ query: 'coffee' });
      expect(Array.isArray(places)).toBe(true);
    });
  });

  describe('getPlacesByCategory', () => {
    it('should return places by category', async () => {
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

      const places = await getPlacesByCategory('dining');
      expect(Array.isArray(places)).toBe(true);
    });
  });

  describe('toggleFavoritePlace', () => {
    it('should require authentication', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(toggleFavoritePlace('place-1')).rejects.toThrow('请先登录');
    });
  });

  describe('getFavoritePlaces', () => {
    it('should return empty array when not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const favorites = await getFavoritePlaces();
      expect(favorites).toEqual([]);
    });

    it('should return favorite place IDs when authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const favorites = await getFavoritePlaces();
      expect(Array.isArray(favorites)).toBe(true);
    });
  });
});
