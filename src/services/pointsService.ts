/**
 * 积分服务 - Points Service
 *
 * 功能：
 * - 获取用户积分统计
 * - 添加积分（学习、任务等）
 * - 查询积分历史记录
 * - 计算用户等级
 */

import { supabase } from '../config/supabase';

export interface UserPointsStats {
  total_points: number;
  level: number;
  today_earned: number;
  week_earned: number;
  total_transactions: number;
}

export interface PointsTransaction {
  id: string;
  points_change: number;
  transaction_type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  balance_after: number;
  created_at: string;
}

export type TransactionType =
  | 'study_complete'      // 完成专注学习
  | 'study_streak'        // 连续学习奖励
  | 'daily_login'         // 每日登录
  | 'achievement'         // 成就解锁
  | 'social_share'        // 社交分享
  | 'redeem'             // 兑换奖励
  | 'admin_adjust';      // 管理员调整

/**
 * 获取用户积分统计
 * @param userId 用户ID
 * @returns 积分统计数据
 */
export async function getUserPointsStats(userId: string): Promise<UserPointsStats | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_points_stats', { p_user_id: userId });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data[0] as UserPointsStats;
  } catch (error) {
    console.error('[PointsService] 获取积分统计失败:', error);
    throw error;
  }
}

/**
 * 为用户添加积分
 * @param userId 用户ID
 * @param points 积分变化（正数=获得，负数=消费）
 * @param type 交易类型
 * @param description 描述
 * @param metadata 额外信息
 */
export async function addUserPoints(
  userId: string,
  points: number,
  type: TransactionType,
  description?: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('add_user_points', {
        p_user_id: userId,
        p_points: points,
        p_transaction_type: type,
        p_description: description || null,
        p_metadata: metadata || null
      });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('[PointsService] 添加积分失败:', error);
    throw error;
  }
}

/**
 * 获取用户积分历史记录
 * @param userId 用户ID
 * @param limit 返回条数
 * @returns 积分交易记录
 */
export async function getPointsHistory(
  userId: string,
  limit: number = 20
): Promise<PointsTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('point_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as PointsTransaction[];
  } catch (error) {
    console.error('[PointsService] 获取积分历史失败:', error);
    throw error;
  }
}

/**
 * 获取积分排行榜
 * @param limit 返回条数
 * @returns 排行榜数据
 */
export async function getPointsLeaderboard(limit: number = 10): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('user_points_overview')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[PointsService] 获取排行榜失败:', error);
    throw error;
  }
}

/**
 * 完成专注学习并奖励积分
 * @param userId 用户ID
 * @param durationMinutes 学习时长（分钟）
 * @returns 获得的积分
 */
export async function rewardStudyCompletion(
  userId: string,
  durationMinutes: number
): Promise<number> {
  // 计算积分：每分钟2积分
  const pointsEarned = Math.floor(durationMinutes * 2);

  await addUserPoints(
    userId,
    pointsEarned,
    'study_complete',
    `完成 ${durationMinutes} 分钟专注学习`,
    {
      duration_minutes: durationMinutes,
      completed_at: new Date().toISOString()
    }
  );

  return pointsEarned;
}

/**
 * 初始化用户积分（用于新用户）
 * @param userId 用户ID
 */
export async function initializeUserPoints(userId: string): Promise<void> {
  try {
    // 先检查是否已存在
    const { data: existing } = await supabase
      .from('user_points')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    // 如果不存在，则插入
    if (!existing) {
      const { error } = await supabase
        .from('user_points')
        .insert({
          user_id: userId,
          total_points: 0,
          level: 1
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('[PointsService] 初始化积分失败:', error);
    throw error;
  }
}
