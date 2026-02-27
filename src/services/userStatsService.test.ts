/**
 * Unit tests for userStatsService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn(),
          gte: vi.fn()
        }))
      }))
    }))
  }
}));

// Import after mocks
import { supabase } from '../config/supabase';
import { getUserStats, getWeeklyInteractions } from './userStatsService';

describe('userStatsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getUserStats Tests
  // ============================================

  describe('getUserStats', () => {
    it('should return user stats successfully', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 500,
        days_active: 30
      };

      const mockPointsData = {
        total_points: 800,
        level: 3
      };

      // Mock three sequential calls: profiles, user_points, chat_messages
      const mockFrom = vi.mocked(supabase.from);

      // First call: profiles table
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      // Second call: user_points table
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockPointsData,
              error: null
            })
          })
        })
      } as any);

      // Third call: chat_messages table
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 50,
            error: null
          })
        })
      } as any);

      const result = await getUserStats('user-123');

      expect(result).toHaveProperty('daysActive');
      expect(result).toHaveProperty('totalPoints');
      expect(result).toHaveProperty('interactions');
      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('nextLevelPoints');
      expect(result).toHaveProperty('pointsToNextLevel');
      expect(result.totalPoints).toBe(800);
      expect(result.level).toBe(3);
      expect(result.interactions).toBe(50);
    });

    it('should use profile points when user_points not found', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 300,
        days_active: 15
      };

      const mockFrom = vi.mocked(supabase.from);

      // First call: profiles table
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      // Second call: user_points table - no data
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any);

      // Third call: chat_messages table
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
      } as any);

      const result = await getUserStats('user-123');

      expect(result.totalPoints).toBe(300);
      expect(result.level).toBe(1); // Default level
    });

    it('should calculate daysActive correctly', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const mockProfile = {
        created_at: thirtyDaysAgo.toISOString(),
        points: 100,
        days_active: 30
      };

      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { total_points: 100, level: 1 },
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
      } as any);

      const result = await getUserStats('user-123');

      // Should be approximately 30 days (might be 29 or 30 depending on timing)
      expect(result.daysActive).toBeGreaterThanOrEqual(29);
      expect(result.daysActive).toBeLessThanOrEqual(31);
    });

    it('should calculate nextLevelPoints correctly for level 1', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 50,
        days_active: 1
      };

      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { total_points: 50, level: 1 },
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
      } as any);

      const result = await getUserStats('user-123');

      expect(result.nextLevelPoints).toBe(100); // Level 2 requires 100 points
      expect(result.pointsToNextLevel).toBe(50); // 100 - 50 = 50
    });

    it('should calculate nextLevelPoints correctly for level 6 (formula)', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 5000,
        days_active: 60
      };

      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { total_points: 5000, level: 6 },
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
      } as any);

      const result = await getUserStats('user-123');

      // Level 6 = 5000 + (6-5) * 2000 = 7000
      expect(result.nextLevelPoints).toBe(7000);
      expect(result.pointsToNextLevel).toBe(2000);
    });

    it('should throw error when profile not found', async () => {
      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Not found')
            })
          })
        })
      } as any);

      await expect(getUserStats('user-123')).rejects.toThrow();
    });

    it('should throw error when points query fails', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 100,
        days_active: 10
      };

      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Points error')
            })
          })
        })
      } as any);

      await expect(getUserStats('user-123')).rejects.toThrow();
    });

    it('should throw error when interactions query fails', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 100,
        days_active: 10
      };

      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { total_points: 100, level: 1 },
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: null,
            error: new Error('Interactions error')
          })
        })
      } as any);

      await expect(getUserStats('user-123')).rejects.toThrow();
    });

    it('should handle zero pointsToNextLevel when at max level points', async () => {
      const mockProfile = {
        created_at: '2024-01-01T00:00:00Z',
        points: 100,
        days_active: 10
      };

      const mockFrom = vi.mocked(supabase.from);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { total_points: 100, level: 1 },
              error: null
            })
          })
        })
      } as any);

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null
          })
        })
      } as any);

      const result = await getUserStats('user-123');

      // pointsToNextLevel = max(0, nextLevelPoints - totalPoints)
      expect(result.pointsToNextLevel).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // getWeeklyInteractions Tests
  // ============================================

  describe('getWeeklyInteractions', () => {
    it('should return weekly interactions count', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              count: 25,
              error: null
            })
          })
        })
      } as any);

      const result = await getWeeklyInteractions('user-123');

      expect(result).toBe(25);
    });

    it('should return 0 when no interactions', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              count: 0,
              error: null
            })
          })
        })
      } as any);

      const result = await getWeeklyInteractions('user-123');

      expect(result).toBe(0);
    });

    it('should return 0 when query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              count: null,
              error: new Error('Query error')
            })
          })
        })
      } as any);

      const result = await getWeeklyInteractions('user-123');

      expect(result).toBe(0);
    });

    it('should call gte with correct parameters', async () => {
      const mockGte = vi.fn().mockResolvedValue({
        count: 10,
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: mockGte
          })
        })
      } as any);

      await getWeeklyInteractions('user-123');

      // Verify gte was called with 'created_at' and a date string
      expect(mockGte).toHaveBeenCalledWith('created_at', expect.any(String));
    });
  });
});
