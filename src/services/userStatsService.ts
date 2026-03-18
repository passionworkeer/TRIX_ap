/**
 * 用户统计服务 - User Stats Service
 * 查询用户统计数据：陪伴天数、积分、互动次数
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface UserStats {
  daysActive: number;
  totalPoints: number;
  interactions: number;
  level: number;
  nextLevelPoints: number;
  pointsToNextLevel: number;
}

/**
 * 获取用户详细统计信息
 * @param userId 用户ID
 * @returns 用户统计数据
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  try {
    // 1. 从 profiles 表获取基本信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('created_at, points, days_active')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('无法获取用户信息');
    }

    // 2. 从 user_points 表获取积分和等级
    const { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .select('total_points, level')
      .eq('user_id', userId)
      .maybeSingle();

    if (pointsError) {
      throw new Error('无法获取积分信息');
    }

    // 3. 从 chat_messages 表统计互动次数
    const { count: interactions, error: interactionsError } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId);

    if (interactionsError) {
      throw new Error('无法获取互动次数');
    }

    // 4. 计算陪伴天数
    const createdAt = new Date(profile.created_at);
    const now = new Date();
    const daysActive = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // 5. 获取积分和等级
    const totalPoints = pointsData?.total_points || profile.points || 0;
    const level = pointsData?.level || 1;

    // 6. 计算下一等级所需积分
    const nextLevelPoints = calculateNextLevelPoints(level);
    const pointsToNextLevel = Math.max(0, nextLevelPoints - totalPoints);

    return {
      daysActive,
      totalPoints,
      interactions: interactions || 0,
      level,
      nextLevelPoints,
      pointsToNextLevel
    };
  } catch (error: unknown) {
    logger.error('UserStats', '获取用户统计数据失败:', error);
    throw error;
  }
}

/**
 * 根据等级计算所需积分
 * @param level 当前等级
 * @returns 升级所需积分
 */
function calculateNextLevelPoints(level: number): number {
  const levelThresholds: Record<number, number> = {
    1: 100,
    2: 500,
    3: 1500,
    4: 3000,
    5: 5000
  };

  // 如果等级超过 5，按公式计算
  if (level >= 5) {
    return 5000 + (level - 5) * 2000;
  }

  return levelThresholds[level] || 100;
}

/**
 * 获取用户本周互动次数
 * @param userId 用户ID
 * @returns 本周互动次数
 */
export async function getWeeklyInteractions(userId: string): Promise<number> {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .gte('created_at', oneWeekAgo.toISOString());

    if (error) {
      throw new Error('无法获取本周互动次数');
    }

    return count || 0;
  } catch (error: unknown) {
    logger.error('UserStats', '获取本周互动次数失败:', error);
    return 0;
  }
}
