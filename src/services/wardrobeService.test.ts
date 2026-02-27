/**
 * Unit tests for wardrobeService
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
  getUserOutfits,
  getOutfitsByCategory,
  equipOutfit,
  unequipOutfit,
  getEquippedOutfits,
  getUserWardrobeSummary,
} from './wardrobeService';

describe('wardrobeService', () => {
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

  describe('getUserOutfits', () => {
    it('should require authentication', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(getUserOutfits()).rejects.toThrow('请先登录');
    });
  });

  describe('equipOutfit', () => {
    it('should fail when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await equipOutfit('outfit-1');
      expect(result.success).toBe(false);
      expect(result.message).toBe('请先登录');
    });
  });

  describe('unequipOutfit', () => {
    it('should fail when user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await unequipOutfit('outfit-1');
      expect(result.success).toBe(false);
      expect(result.message).toBe('请先登录');
    });
  });

  describe('getUserWardrobeSummary', () => {
    it('should require authentication', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(getUserWardrobeSummary()).rejects.toThrow('请先登录');
    });
  });
});
