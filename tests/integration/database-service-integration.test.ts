/**
 * Integration tests for database + service layer.
 *
 * Verifies that service functions call Supabase with correct table names.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Database service layer integration', () => {

  describe('studySessionService', () => {
    it('calls Supabase from("study_sessions") when getting sessions', async () => {
      const { supabase } = await import('../../src/config/supabase');
      const fromSpy = vi.spyOn(supabase, 'from');
      fromSpy.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const { getStudySessions } = await import('../../src/services/studySessionService');
      await getStudySessions();

      expect(fromSpy).toHaveBeenCalledWith('study_sessions');
    });

    it('handles errors gracefully when getting sessions', async () => {
      const { supabase } = await import('../../src/config/supabase');
      const fromSpy = vi.spyOn(supabase, 'from');
      fromSpy.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error('Network error')),
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      } as any);

      const { getStudySessions } = await import('../../src/services/studySessionService');
      const result = await getStudySessions();

      expect(result).toEqual([]);
    });
  });

  describe('achievementService', () => {
    it('calls Supabase from("achievements") when getting achievements', async () => {
      const { supabase } = await import('../../src/config/supabase');
      const fromSpy = vi.spyOn(supabase, 'from');
      fromSpy.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn(),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn(),
      } as any);

      const { getAchievements } = await import('../../src/services/achievementService');
      await getAchievements();

      expect(fromSpy).toHaveBeenCalledWith('achievements');
    });
  });

  describe('pointsService', () => {
    it('calls Supabase from("points_transactions") when getting history', async () => {
      const { supabase } = await import('../../src/config/supabase');
      const fromSpy = vi.spyOn(supabase, 'from');
      fromSpy.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'tx1', user_id: 'test', amount: 10, type: 'earn' },
              error: null,
            }),
          }),
        }),
        update: vi.fn(),
        delete: vi.fn(),
      } as any);

      const { getPointsHistory } = await import('../../src/services/pointsService');
      await getPointsHistory();

      expect(fromSpy).toHaveBeenCalledWith('points_transactions');
    });
  });

  describe('Error handling', () => {
    it('getChatHistory returns empty messages on network error', async () => {
      const { supabase } = await import('../../src/config/supabase');
      const fromSpy = vi.spyOn(supabase, 'from');
      fromSpy.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error('Network error')),
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      } as any);

      const { getChatHistory } = await import('../../src/services/chatService');
      const result = await getChatHistory('friend-123');

      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
    });
  });
});
