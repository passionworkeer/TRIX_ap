/**
 * Unit tests for pointsService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn()
          })),
          maybeSingle: vi.fn()
        }))
      })),
      insert: vi.fn(() => ({
        then: vi.fn()
      }))
    }))
  }
}));

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getUserPointsStats,
  addUserPoints,
  getPointsHistory,
  getPointsLeaderboard,
  rewardStudyCompletion,
  initializeUserPoints
} from './pointsService';

describe('pointsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getUserPointsStats Tests
  // ============================================

  describe('getUserPointsStats', () => {
    it('should return user points stats successfully', async () => {
      const mockStats = {
        total_points: 1000,
        level: 5,
        today_earned: 50,
        week_earned: 200,
        total_transactions: 25
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [mockStats],
        error: null
      });

      const result = await getUserPointsStats('user-123');

      expect(result).toEqual(mockStats);
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_points_stats', {
        p_user_id: 'user-123'
      });
    });

    it('should return null when no data', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null
      });

      const result = await getUserPointsStats('user-123');

      expect(result).toBeNull();
    });

    it('should return null when data is empty array', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null
      });

      const result = await getUserPointsStats('user-123');

      expect(result).toBeNull();
    });

    it('should throw error when rpc fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('RPC error')
      });

      await expect(getUserPointsStats('user-123')).rejects.toThrow();
    });
  });

  // ============================================
  // addUserPoints Tests
  // ============================================

  describe('addUserPoints', () => {
    it('should add points successfully', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await addUserPoints(
        'user-123',
        100,
        'study_complete',
        'Test description'
      );

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('add_user_points', {
        p_user_id: 'user-123',
        p_points: 100,
        p_transaction_type: 'study_complete',
        p_description: 'Test description',
        p_metadata: null
      });
    });

    it('should add points with metadata', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      });

      const metadata = { source: 'test' };
      const result = await addUserPoints(
        'user-123',
        50,
        'achievement',
        'Achievement unlocked',
        metadata
      );

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('add_user_points', {
        p_user_id: 'user-123',
        p_points: 50,
        p_transaction_type: 'achievement',
        p_description: 'Achievement unlocked',
        p_metadata: metadata
      });
    });

    it('should return false when rpc returns false', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: false,
        error: null
      });

      const result = await addUserPoints(
        'user-123',
        100,
        'study_complete'
      );

      expect(result).toBe(false);
    });

    it('should throw error when rpc fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('RPC error')
      });

      await expect(
        addUserPoints('user-123', 100, 'study_complete')
      ).rejects.toThrow();
    });
  });

  // ============================================
  // getPointsHistory Tests
  // ============================================

  describe('getPointsHistory', () => {
    it('should return points history successfully', async () => {
      const mockHistory = [
        {
          id: 'tx-1',
          points_change: 100,
          transaction_type: 'study_complete',
          description: 'Study',
          metadata: {},
          balance_after: 100,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'tx-2',
          points_change: -50,
          transaction_type: 'redeem',
          description: 'Redeem',
          metadata: {},
          balance_after: 50,
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockHistory,
                error: null
              })
            })
          })
        })
      } as any);

      const result = await getPointsHistory('user-123');

      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when no history', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
      } as any);

      const result = await getPointsHistory('user-123');

      expect(result).toEqual([]);
    });

    it('should use default limit of 20', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: mockLimit
            })
          })
        })
      } as any);

      await getPointsHistory('user-123');

      expect(mockLimit).toHaveBeenCalledWith(20);
    });

    it('should use custom limit', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: mockLimit
            })
          })
        })
      } as any);

      await getPointsHistory('user-123', 50);

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('should throw error when query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('Query error')
              })
            })
          })
        })
      } as any);

      await expect(getPointsHistory('user-123')).rejects.toThrow();
    });
  });

  // ============================================
  // getPointsLeaderboard Tests
  // ============================================

  describe('getPointsLeaderboard', () => {
    it('should return leaderboard successfully', async () => {
      const mockLeaderboard = [
        { user_id: 'user-1', total_points: 1000 },
        { user_id: 'user-2', total_points: 800 }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockLeaderboard,
              error: null
            })
          })
        })
      } as any);

      const result = await getPointsLeaderboard();

      expect(result).toEqual(mockLeaderboard);
    });

    it('should use default limit of 10', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: mockLimit
          })
        })
      } as any);

      await getPointsLeaderboard();

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it('should use custom limit', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: mockLimit
          })
        })
      } as any);

      await getPointsLeaderboard(25);

      expect(mockLimit).toHaveBeenCalledWith(25);
    });

    it('should return empty array when no data', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      } as any);

      const result = await getPointsLeaderboard();

      expect(result).toEqual([]);
    });

    it('should throw error when query fails', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Query error')
            })
          })
        })
      } as any);

      await expect(getPointsLeaderboard()).rejects.toThrow();
    });
  });

  // ============================================
  // rewardStudyCompletion Tests
  // ============================================

  describe('rewardStudyCompletion', () => {
    it('should calculate points correctly (2 points per minute)', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await rewardStudyCompletion('user-123', 25);

      expect(result).toBe(50); // 25 * 2 = 50
    });

    it('should floor the points calculation', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await rewardStudyCompletion('user-123', 13);

      expect(result).toBe(26); // 13 * 2 = 26
    });

    it('should call addUserPoints with correct parameters', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      });

      await rewardStudyCompletion('user-123', 30);

      expect(supabase.rpc).toHaveBeenCalledWith('add_user_points', {
        p_user_id: 'user-123',
        p_points: 60,
        p_transaction_type: 'study_complete',
        p_description: '完成 30 分钟专注学习',
        p_metadata: expect.objectContaining({
          duration_minutes: 30,
          completed_at: expect.any(String)
        })
      });
    });

    it('should handle zero minutes', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null
      });

      const result = await rewardStudyCompletion('user-123', 0);

      expect(result).toBe(0);
    });
  });

  // ============================================
  // initializeUserPoints Tests
  // ============================================

  describe('initializeUserPoints', () => {
    it('should create new points record when not exists', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        }),
        insert: mockInsert
      } as any);

      await initializeUserPoints('user-123');

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        total_points: 0,
        level: 1
      });
    });

    it('should not create record when already exists', async () => {
      const mockInsert = vi.fn();

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'existing-id' },
              error: null
            })
          })
        }),
        insert: mockInsert
      } as any);

      await initializeUserPoints('user-123');

      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should throw error on insert failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        }),
        insert: vi.fn().mockResolvedValue({
          error: new Error('Insert error')
        })
      } as any);

      await expect(initializeUserPoints('user-123')).rejects.toThrow();
    });

    it('should throw error on select failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Select error')
            })
          })
        })
      } as any);

      await expect(initializeUserPoints('user-123')).rejects.toThrow();
    });
  });
});
