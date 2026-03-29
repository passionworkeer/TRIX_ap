/**
 * Unit tests for mallService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                single: vi.fn(),
                order: vi.fn(() => ({
                  limit: vi.fn(),
                  then: vi.fn(() => ({ data: [], error: null }))
                }))
              }))
            })),
            order: vi.fn(() => ({
              then: vi.fn(() => ({ data: [], error: null }))
            }))
          })),
          single: vi.fn()
        })),
        insert: vi.fn(() => ({
          then: vi.fn(() => ({ data: null, error: null }))
        })),
        update: vi.fn(() => ({
          then: vi.fn(() => ({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getMallItems,
  getMallItemsByCategory,
  purchaseItem,
  getUserPointsBalance,
  getPurchaseHistory,
  getPointsTransactions
} from './mallService';

describe('mallService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getMallItems Tests
  // ============================================

  describe('getMallItems', () => {
    it('should return empty array when no items', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      } as any);

      const result = await getMallItems();
      expect(result).toEqual([]);
    });

    it('should call supabase with correct table name', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      } as any);

      await getMallItems();

      expect(supabase.from).toHaveBeenCalledWith('mall_items');
    });

    it('should filter by category when provided', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      // Create a mock query object that supports chainable .eq() and .order()
      // The order() result should also support .eq() for category filtering
      const resolvedValue = { data: [], error: null };

      const mockOrderedQuery: any = {
        eq: vi.fn().mockReturnThis(),
      };
      // Make it thenable (Promise-like)
      mockOrderedQuery.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);

      const mockQuery: any = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnValue(mockOrderedQuery)
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery)
      } as any);

      await getMallItemsByCategory('clothing');

      expect(supabase.from).toHaveBeenCalledWith('mall_items');
      // First eq call is for is_active, second is for category (on ordered query)
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockOrderedQuery.eq).toHaveBeenCalledWith('category', 'clothing');
    });

    it('should fallback to created_at when display_order does not exist', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      });

      const missingDisplayOrder = {
        data: null,
        error: { code: '42703', message: 'column mall_items.display_order does not exist' }
      };
      const fallbackItems = {
        data: [{
          id: 'item-1',
          name: 'Blue Hat',
          description: 'A hat',
          image_url: 'hat.png',
          price: 99,
          category: 'accessory'
        }],
        error: null
      };

      const primaryQuery: any = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(missingDisplayOrder)
      };
      const fallbackQuery: any = {
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(fallbackItems)
      };

      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue(primaryQuery)
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue(fallbackQuery)
        } as any);

      const result = await getMallItems();

      expect(primaryQuery.order).toHaveBeenCalledWith('display_order', { ascending: true });
      expect(fallbackQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([{
        id: 'item-1',
        name: 'Blue Hat',
        description: 'A hat',
        image: 'hat.png',
        price: 99,
        category: 'accessory',
        isOwned: false
      }]);
    });
  });

  // ============================================
  // purchaseItem Tests
  // ============================================

  describe('purchaseItem', () => {
    it('should return error when user not logged in', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await purchaseItem({ itemId: 'item-1' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('请先登录');
    });

    it('should return error when item not found', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      // First call: mall_items - returns error (item not found)
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            })
          })
        })
      } as any);

      const result = await purchaseItem({ itemId: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('商品不存在或已下架');
    });

    it('should return error when insufficient points', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      const mockItem = { id: 'item-1', name: 'Hat', description: 'Hat', image_url: 'hat.png', price: 100, category: 'clothing' };
      const mockPoints = { balance: 50, total_spent: 0 };

      // First call: mall_items - returns item
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
            })
          })
        })
      } as any);

      // Second call: user_points - returns insufficient balance
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPoints, error: null })
          })
        })
      } as any);

      const result = await purchaseItem({ itemId: 'item-1' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('积分不足');
    });

    it('should check user owned items before purchase', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      const mockItem = { id: 'item-1', name: 'Hat', description: 'Hat', image_url: 'hat.png', price: 100, category: 'clothing' };
      const mockPoints = { balance: 200, total_spent: 0 };

      // First call: mall_items - returns item
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
            })
          })
        })
      } as any);

      // Second call: user_points - returns sufficient balance
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPoints, error: null })
          })
        })
      } as any);

      // Third call: user_purchased_items - check if already owned
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      } as any);

      // Fourth call: user_points - deduct points
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      } as any);

      // Fifth call: user_purchased_items - insert purchase record
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      } as any);

      // Sixth call: points_transactions - insert transaction
      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      } as any);

      await purchaseItem({ itemId: 'item-1' });

      // Verify that owned items are checked (third call)
      expect(supabase.from).toHaveBeenNthCalledWith(3, 'user_purchased_items');
    });

    it('should deduct total_points when balance column is unavailable', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      const mockItem = { id: 'item-1', name: 'Hat', description: 'Hat', image_url: 'hat.png', price: 100, category: 'clothing' };
      const mockPoints = { total_points: 200, total_spent: 10 };
      const update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockItem, error: null })
            })
          })
        })
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPoints, error: null })
          })
        })
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        })
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        update
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      } as any);

      vi.mocked(supabase.from).mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null })
      } as any);

      await purchaseItem({ itemId: 'item-1' });

      expect(update).toHaveBeenCalledWith({
        total_points: 100,
        total_spent: 110,
      });
    });
  });

  // ============================================
  // getUserPointsBalance Tests
  // ============================================

  describe('getUserPointsBalance', () => {
    it('should return null when user not logged in', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await getUserPointsBalance();
      expect(result).toBeNull();
    });

    it('should query user_points table', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user-123', balance: 500, total_earned: 1000, total_spent: 500, updated_at: '2024-01-01' },
              error: null
            })
          })
        })
      } as any);

      await getUserPointsBalance();

      expect(supabase.from).toHaveBeenCalledWith('user_points');
    });

    it('should map total_points to balance for newer schemas', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: 'user-123', total_points: 320, total_earned: 500, total_spent: 180, updated_at: '2024-01-01' },
              error: null
            })
          })
        })
      } as any);

      const result = await getUserPointsBalance();

      expect(result?.balance).toBe(320);
      expect(result?.totalSpent).toBe(180);
    });
  });

  // ============================================
  // getPurchaseHistory Tests
  // ============================================

  describe('getPurchaseHistory', () => {
    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await getPurchaseHistory();
      expect(result).toEqual([]);
    });

    it('should query user_purchased_items table', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      } as any);

      await getPurchaseHistory();

      expect(supabase.from).toHaveBeenCalledWith('user_purchased_items');
    });
  });

  // ============================================
  // getPointsTransactions Tests
  // ============================================

  describe('getPointsTransactions', () => {
    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await getPointsTransactions();
      expect(result).toEqual([]);
    });

    it('should query points_transactions table', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      } as any);

      await getPointsTransactions();

      expect(supabase.from).toHaveBeenCalledWith('point_transactions');
    });
  });
});
