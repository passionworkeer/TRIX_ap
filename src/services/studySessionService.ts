import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type { StudySession } from '../config/supabase';

// ============================================
// 辅助函数 - 获取当前登录用户 ID
// ============================================

/**
 * 获取当前登录用户的 ID
 * @throws {Error} 如果用户未登录
 * @returns {Promise<string>} 用户 ID
 */
async function getCurrentUserId(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    logger.study.error('获取用户会话失败:', error);
    throw new Error('无法获取用户会话');
  }

  if (!session?.user?.id) {
    throw new Error('用户未登录，请先登录');
  }

  return session.user.id;
}

// ============================================
// 学习记录管理
// ============================================

/** 获取学习记录 */
export async function getStudySessions(limit?: number): Promise<StudySession[]> {
  try {
    const userId = await getCurrentUserId();

    let query = supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.study.error('获取学习记录失败:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.study.error('获取学习记录失败:', error);
    return [];
  }
}

/** 创建学习记录 */
export async function createStudySession(
  subject: string,
  duration: number,
  startedAt: string,
  endedAt?: string,
  notes?: string
): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        subject,
        duration,
        started_at: startedAt,
        ended_at: endedAt,
        notes
      })
      .select('id')
      .single();

    if (error) {
      logger.study.error('创建学习记录失败:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    logger.study.error('创建学习记录失败:', error);
    return null;
  }
}

/** 获取今日学习时长 */
export async function getTodayStudyTime(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from<Array<{ duration: number }>>('study_sessions')
      .select('duration')
      .eq('user_id', userId)
      .gte('started_at', today.toISOString());

    if (error) {
      logger.study.error('获取今日学习时长失败:', error);
      return 0;
    }

    return data?.reduce((sum, session) => sum + session.duration, 0) || 0;
  } catch (error) {
    logger.study.error('获取今日学习时长失败:', error);
    return 0;
  }
}
