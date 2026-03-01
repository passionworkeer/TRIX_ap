/**
 * Unit tests for achievementService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Import after mocks
import { supabase } from '../config/supabase';
import { achievementService } from './achievementService';
import { ACHIEVEMENTS } from '../types/achievement';

describe('achievementService', () => {
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('checkAndUnlockAchievements', () => {
    it('should return empty array when no achievements to unlock', async () => {
      // Mock getUserStats to return stats that don't meet any achievement
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 0,
        total_sessions: 0,
        daily_streak: 0,
        friends_studied_count: 0,
        longest_single_session: 0,
        early_bird_count: 0,
        night_owl_count: 0,
      });

      // Mock getUnlockedAchievementIds to return all achievements already unlocked
      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue(
        ACHIEVEMENTS.map(a => a.id)
      );

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);
      expect(result).toEqual([]);
    });

    it('should unlock achievement when requirements are met', async () => {
      // Mock getUserStats to return stats that meet first achievement (10 minutes)
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 15,
        total_sessions: 1,
        daily_streak: 1,
        friends_studied_count: 0,
        longest_single_session: 15,
        early_bird_count: 0,
        night_owl_count: 0,
      });

      // Mock getUnlockedAchievementIds to return empty (no achievements unlocked)
      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);

      // Mock unlockAchievement
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should unlock the first achievement (duration_10: 10 minutes)
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].id).toBe('duration_10');
    });

    it('should handle errors gracefully and return empty array', async () => {
      // Mock getUserStats to throw an error
      vi.spyOn(achievementService as any, 'getUserStats').mockRejectedValue(
        new Error('Database error')
      );

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);
      expect(result).toEqual([]);
    });

    it('should not unlock already unlocked achievements', async () => {
      // Mock getUserStats to return stats that meet first achievement
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 100,
        total_sessions: 10,
        daily_streak: 5,
        friends_studied_count: 3,
        longest_single_session: 60,
        early_bird_count: 1,
        night_owl_count: 1,
      });

      // Mock getUnlockedAchievementIds to return first achievement already unlocked
      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([
        'duration_10'
      ]);

      // Mock unlockAchievement
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should not unlock duration_10 again
      expect(result.some(a => a.id === 'duration_10')).toBe(false);
    });
  });

  describe('getUserAchievements', () => {
    it('should return all achievements with unlocked status', async () => {
      // Mock getUnlockedAchievementIds to return some unlocked achievements
      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([
        'duration_10',
        'streak_3'
      ]);

      const result = await achievementService.getUserAchievements(mockUserId);

      // Should return all achievements
      expect(result.length).toBe(ACHIEVEMENTS.length);

      // Check unlocked achievements have unlockedAt set
      const duration10 = result.find(a => a.id === 'duration_10');
      expect(duration10?.unlockedAt).toBeDefined();

      const streak3 = result.find(a => a.id === 'streak_3');
      expect(streak3?.unlockedAt).toBeDefined();

      // Check locked achievements have unlockedAt undefined
      const duration60 = result.find(a => a.id === 'duration_60');
      expect(duration60?.unlockedAt).toBeUndefined();
    });

    it('should return all achievements as locked when none unlocked', async () => {
      // Mock getUnlockedAchievementIds to return empty
      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);

      const result = await achievementService.getUserAchievements(mockUserId);

      // All achievements should have unlockedAt undefined
      result.forEach(achievement => {
        expect(achievement.unlockedAt).toBeUndefined();
      });
    });

    it('should handle errors gracefully and return default achievements', async () => {
      // Mock getUnlockedAchievementIds to throw an error
      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockRejectedValue(
        new Error('Database error')
      );

      const result = await achievementService.getUserAchievements(mockUserId);

      // Should return default ACHIEVEMENTS
      expect(result).toEqual(ACHIEVEMENTS);
    });
  });

  describe('checkAchievement (private method via public interface)', () => {
    it('should unlock total_minutes achievement when total_minutes >= requirement', async () => {
      // Mock getUserStats to return stats meeting total_minutes requirement
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 300,
        total_sessions: 10,
        daily_streak: 1,
        friends_studied_count: 0,
        longest_single_session: 30,
        early_bird_count: 0,
        night_owl_count: 0,
      });

      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should unlock duration_300 (300 minutes)
      expect(result.some(a => a.id === 'duration_300')).toBe(true);
    });

    it('should unlock single_session achievement when longest_session >= requirement', async () => {
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 60,
        total_sessions: 2,
        daily_streak: 1,
        friends_studied_count: 0,
        longest_single_session: 60,
        early_bird_count: 0,
        night_owl_count: 0,
      });

      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should unlock single_60 (60 minutes single session)
      expect(result.some(a => a.id === 'single_60')).toBe(true);
    });

    it('should unlock daily_streak achievement when daily_streak >= requirement', async () => {
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 100,
        total_sessions: 10,
        daily_streak: 7,
        friends_studied_count: 0,
        longest_single_session: 20,
        early_bird_count: 0,
        night_owl_count: 0,
      });

      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should unlock streak_7 (7 days)
      expect(result.some(a => a.id === 'streak_7')).toBe(true);
    });

    it('should unlock friends_studied achievement when friends_studied_count >= requirement', async () => {
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 50,
        total_sessions: 5,
        daily_streak: 1,
        friends_studied_count: 10,
        longest_single_session: 15,
        early_bird_count: 0,
        night_owl_count: 0,
      });

      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should unlock social_10 (10 friends studied)
      expect(result.some(a => a.id === 'social_10')).toBe(true);
    });

    it('should unlock multiple achievements at once', async () => {
      vi.spyOn(achievementService as any, 'getUserStats').mockResolvedValue({
        total_minutes: 1000,
        total_sessions: 50,
        daily_streak: 30,
        friends_studied_count: 10,
        longest_single_session: 60,
        early_bird_count: 5,
        night_owl_count: 3,
      });

      vi.spyOn(achievementService as any, 'getUnlockedAchievementIds').mockResolvedValue([]);
      vi.spyOn(achievementService as any, 'unlockAchievement').mockResolvedValue();

      const result = await achievementService.checkAndUnlockAchievements(mockUserId);

      // Should unlock multiple achievements
      expect(result.length).toBeGreaterThan(1);
    });
  });
});
