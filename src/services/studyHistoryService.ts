import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface StudySession {
  id: string;
  user_id: string;
  duration: number;
  started_at: string;
  ended_at: string;
  companion_id?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
}

export interface DailySummary {
  date: string;
  totalMinutes: number;
  sessionsCount: number;
  longestSession: number;
  averageDuration: number;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalMinutes: number;
  sessionsCount: number;
  dailyAverage: number;
  bestDay: { date: string; minutes: number };
  streakDays: number;
}

export interface MonthlySummary {
  month: string;
  year: number;
  totalMinutes: number;
  sessionsCount: number;
  dailyAverage: number;
  weeklyBreakdown: WeeklySummary[];
  longestStreak: number;
}

class StudyHistoryService {
  /**
   * 获取专注历史记录
   */
  async getStudyHistory(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    } = {}
  ): Promise<StudySession[]> {
    try {
      let query = supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (options.startDate) {
        query = query.gte('started_at', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('started_at', options.endDate);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.study.error('Failed to get study history:', error);
      return [];
    }
  }

  /**
   * 获取今日概要
   */
  async getTodaySummary(userId: string): Promise<DailySummary> {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    try {
      const { data, error } = await supabase
        .from<Array<{ duration: number }>>('study_sessions')
        .select('duration')
        .eq('user_id', userId)
        .gte('started_at', today)
        .lt('started_at', tomorrow);

      if (error) throw error;

      const sessions = data || [];
      const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
      const longestSession = Math.max(0, ...sessions.map(s => s.duration));
      const averageDuration = sessions.length > 0 ? totalMinutes / sessions.length : 0;

      return {
        date: today,
        totalMinutes,
        sessionsCount: sessions.length,
        longestSession,
        averageDuration
      };
    } catch (error) {
      logger.study.error('Failed to get today summary:', error);
      return {
        date: today,
        totalMinutes: 0,
        sessionsCount: 0,
        longestSession: 0,
        averageDuration: 0
      };
    }
  }

  /**
   * 获取周概要
   */
  async getWeeklySummary(userId: string, weekOffset: number = 0): Promise<WeeklySummary> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    // 计算本周一
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset + (weekOffset * 7));
    monday.setHours(0, 0, 0, 0);

    // 计算本周日
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    try {
      const sessions = await this.getStudyHistory(userId, {
        startDate: monday.toISOString(),
        endDate: sunday.toISOString()
      });

      const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
      const dailyAverage = totalMinutes / 7;

      // 找出最佳的一天
      const dailyTotals: Record<string, number> = {};
      sessions.forEach(session => {
        const date = session.started_at.slice(0, 10);
        dailyTotals[date] = (dailyTotals[date] || 0) + session.duration;
      });

      let bestDay = { date: monday.toISOString().slice(0, 10), minutes: 0 };
      Object.entries(dailyTotals).forEach(([date, minutes]) => {
        if (minutes > bestDay.minutes) {
          bestDay = { date, minutes };
        }
      });

      // 计算连续学习天数
      const streakDays = Object.keys(dailyTotals).length;

      return {
        weekStart: monday.toISOString().slice(0, 10),
        weekEnd: sunday.toISOString().slice(0, 10),
        totalMinutes,
        sessionsCount: sessions.length,
        dailyAverage,
        bestDay,
        streakDays
      };
    } catch (error) {
      logger.study.error('Failed to get weekly summary:', error);
      return {
        weekStart: monday.toISOString().slice(0, 10),
        weekEnd: sunday.toISOString().slice(0, 10),
        totalMinutes: 0,
        sessionsCount: 0,
        dailyAverage: 0,
        bestDay: { date: monday.toISOString().slice(0, 10), minutes: 0 },
        streakDays: 0
      };
    }
  }

  /**
   * 保存专注记录
   */
  async saveStudySession(session: Omit<StudySession, 'id' | 'created_at'>): Promise<StudySession | null> {
    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .insert(session)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      logger.study.error('Failed to save study session:', error);
      return null;
    }
  }

  /**
   * 获取连续学习天数
   */
  async getCurrentStreak(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('current_streak')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return data?.current_streak || 0;
    } catch (error) {
      logger.study.error('Failed to get current streak:', error);
      return 0;
    }
  }
}

export const studyHistoryService = new StudyHistoryService();
