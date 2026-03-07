import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { ACHIEVEMENTS, Achievement, AchievementType } from '../types/achievement';

interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  metadata?: Record<string, any>;
}

interface UserStats {
  total_minutes: number;
  total_sessions: number;
  daily_streak: number;
  friends_studied_count: number;
  longest_single_session: number;
  early_bird_count: number;
  night_owl_count: number;
}

class AchievementService {
  /**
   * 检查并解锁成就
   */
  async checkAndUnlockAchievements(userId: string): Promise<Achievement[]> {
    try {
      // 获取用户统计
      const stats = await this.getUserStats(userId);

      // 获取已解锁成就
      const unlockedIds = await this.getUnlockedAchievementIds(userId);

      // 检查每个成就
      const newlyUnlocked: Achievement[] = [];

      for (const achievement of ACHIEVEMENTS) {
        if (unlockedIds.includes(achievement.id)) continue;

        const shouldUnlock = this.checkAchievement(achievement, stats);

        if (shouldUnlock) {
          await this.unlockAchievement(userId, achievement.id);
          newlyUnlocked.push(achievement);
        }
      }

      return newlyUnlocked;
    } catch (error) {
      logger.study.error('Failed to check achievements:', error);
      return [];
    }
  }

  /**
   * 检查单个成就是否满足条件
   */
  private checkAchievement(achievement: Achievement, stats: UserStats): boolean {
    switch (achievement.type) {
      case 'total_minutes':
        return stats.total_minutes >= achievement.requirement;

      case 'single_session':
        return stats.longest_single_session >= achievement.requirement;

      case 'daily_streak':
        return stats.daily_streak >= achievement.requirement;

      case 'total_sessions':
        return stats.total_sessions >= achievement.requirement;

      case 'friends_studied':
        return stats.friends_studied_count >= achievement.requirement;

      case 'early_bird':
        return stats.early_bird_count >= achievement.requirement;

      case 'night_owl':
        return stats.night_owl_count >= achievement.requirement;

      default:
        return false;
    }
  }

  /**
   * 获取用户统计
   */
  private async getUserStats(userId: string): Promise<UserStats> {
    try {
      // 从 profiles 获取基本统计
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('total_study_time, current_streak')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // 获取总专注次数
      const { count: totalSessions } = await supabase
        .from('study_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // 获取最长单次专注
      const { data: longestSession } = await supabase
        .from('study_sessions')
        .select('duration_minutes')
        .eq('user_id', userId)
        .order('duration_minutes', { ascending: false })
        .limit(1)
        .single();

      // 获取好友学习次数
      const { count: friendsCount } = await supabase
        .from('study_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('companion_id', 'is', null);

      // 获取所有会话的开始时间以计算早鸟和夜猫子
      const { data: allSessions } = await supabase
        .from('study_sessions')
        .select('start_time')
        .eq('user_id', userId);

      let earlyBirdCount = 0;
      let nightOwlCount = 0;

      if (allSessions) {
        allSessions.forEach(session => {
          if (!session.start_time) return;
          const startHour = new Date(session.start_time).getHours();
          // 早鸟：4:00 - 8:00 (含4不含8)
          if (startHour >= 4 && startHour < 8) {
            earlyBirdCount++;
          } 
          // 夜猫子：22:00 - 3:00
          else if (startHour >= 22 || startHour < 3) {
            nightOwlCount++;
          }
        });
      }

      return {
        total_minutes: profile?.total_study_time || 0,
        total_sessions: totalSessions || 0,
        daily_streak: profile?.current_streak || 0,
        friends_studied_count: friendsCount || 0,
        longest_single_session: longestSession?.duration_minutes || 0,
        early_bird_count: earlyBirdCount,
        night_owl_count: nightOwlCount
      };
    } catch (error) {
      logger.study.error('Failed to get user stats:', error);
      return {
        total_minutes: 0,
        total_sessions: 0,
        daily_streak: 0,
        friends_studied_count: 0,
        longest_single_session: 0,
        early_bird_count: 0,
        night_owl_count: 0
      };
    }
  }

  /**
   * 获取已解锁的成就ID列表
   */
  private async getUnlockedAchievementIds(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []).map(item => item.achievement_id);
    } catch (error) {
      logger.study.error('Failed to get unlocked achievements:', error);
      return [];
    }
  }

  /**
   * 解锁成就
   */
  private async unlockAchievement(userId: string, achievementId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievementId,
          unlocked_at: new Date().toISOString()
        });

      if (error) throw error;

      logger.study.debug(`🏆 Achievement unlocked: ${achievementId}`);
    } catch (error) {
      logger.study.error('Failed to unlock achievement:', error);
    }
  }

  /**
   * 获取用户所有成就（包含解锁状态）
   */
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const unlockedIds = await this.getUnlockedAchievementIds(userId);

      return ACHIEVEMENTS.map(achievement => ({
        ...achievement,
        unlockedAt: unlockedIds.includes(achievement.id)
          ? new Date().toISOString()
          : undefined
      }));
    } catch (error) {
      logger.study.error('Failed to get user achievements:', error);
      return ACHIEVEMENTS;
    }
  }
}

export const achievementService = new AchievementService();
