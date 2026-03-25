import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../config/supabase';
import { logger } from '../../../utils/logger';
import { rewardStudyCompletion } from '../../../services/pointsService';

interface UseStudySessionOptions {
  /** 用户 ID */
  userId: string | undefined;
  /** 计时完成回调 */
  onSessionComplete?: (studiedMinutes: number) => void;
}

interface UseStudySessionReturn {
  /** 是否正在自习 */
  isStudying: boolean;
  /** 专注开始时间 */
  focusStartTime: number | null;
  /** 初始时长（分钟） */
  initialDuration: number;
  /** 当前会话 ID */
  currentSessionId: string | null;
  /** 开始专注 */
  startStudy: (duration: number) => Promise<void>;
  /** 停止专注 */
  stopStudy: () => Promise<number>; // 返回实际专注分钟数
  /** 设置专注开始时间 */
  setFocusStartTime: (time: number | null) => void;
  /** 设置初始时长 */
  setInitialDuration: (duration: number) => void;
}

/**
 * useStudySession - 专注会话管理 Hook
 *
 * 处理开始/停止专注、数据库更新、积分奖励
 */
export function useStudySession(options: UseStudySessionOptions): UseStudySessionReturn {
  const { userId, onSessionComplete } = options;

  const [isStudying, setIsStudying] = useState(false);
  const [focusStartTime, setFocusStartTime] = useState<number | null>(null);
  const [initialDuration, setInitialDuration] = useState(25);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Refs 防止闭包问题
  const isStudyingRef = useRef(false);
  const userIdRef = useRef(userId);
  const onSessionCompleteRef = useRef(onSessionComplete);
  const currentSessionIdRef = useRef<string | null>(null);

  // 更新 refs
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    isStudyingRef.current = isStudying;
  }, [isStudying]);

  useEffect(() => {
    onSessionCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  /**
   * 浏览器关闭时清理状态
   */
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (isStudyingRef.current && userIdRef.current) {
        logger.study.debug('🌐 [useStudySession] 浏览器关闭，清理自习状态...');

        // 获取当前用户的 companion_id
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('companion_id')
          .eq('id', userIdRef.current)
          .single();

        const companionId = myProfile?.companion_id;

        // 清理自己的状态
        await supabase
          .from('profiles')
          .update({
            is_studying: false,
            companion_id: null
          })
          .eq('id', userIdRef.current);

        // 如果有好友，也清除好友的关联
        if (companionId) {
          await supabase
            .from('profiles')
            .update({ companion_id: null })
            .eq('id', companionId);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  /**
   * 开始专注
   */
  const startStudy = useCallback(async (duration: number) => {
    if (!userId) return;

    setInitialDuration(duration);
    const startTime = Date.now();
    setFocusStartTime(startTime);

    try {
      logger.study.debug('🚀 [useStudySession] 开始自习，更新数据库状态...');
      
      // 更新 profiles 表的 is_studying 状态
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_studying: true })
        .eq('id', userId);

      if (profileError) {
        logger.study.error('❌ [useStudySession] 更新 is_studying 失败:', profileError);
        return;
      }

      // 创建 study_sessions 记录
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          started_at: new Date(startTime).toISOString(),
          duration: 0, // 初始时长为 0，结束后更新
          subject: '自习'
        })
        .select('id')
        .single();

      if (sessionError) {
        logger.study.error('❌ [useStudySession] 创建 study_sessions 记录失败:', sessionError);
        // 即使创建记录失败，也继续专注流程
      } else {
        logger.study.debug('✅ [useStudySession] 已创建 study_sessions 记录, id =', sessionData.id);
        setCurrentSessionId(sessionData.id);
        currentSessionIdRef.current = sessionData.id;
      }

      logger.study.debug('✅ [useStudySession] 已更新 is_studying = true');
      setIsStudying(true);
      isStudyingRef.current = true;
    } catch (err) {
      logger.study.error('❌ [useStudySession] 数据库更新异常:', err);
    }
  }, [userId]);

  /**
   * 停止专注
   * @returns 实际专注分钟数
   */
  const stopStudy = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    setIsStudying(false);
    isStudyingRef.current = false;

    // 计算专注时长
    let studiedMinutes = 0;
    const endTime = Date.now();

    if (focusStartTime && initialDuration) {
      const elapsedMs = endTime - focusStartTime;
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      studiedMinutes = Math.min(elapsedMinutes, initialDuration);
      logger.study.debug(`📊 [useStudySession] 本次专注时长: ${studiedMinutes} 分钟`);
    }

    try {
      logger.study.debug('🛑 [useStudySession] 停止自习，更新数据库状态...');

      // 更新 study_sessions 记录
      const sessionId = currentSessionIdRef.current;
      if (sessionId && studiedMinutes > 0) {
        const { error: sessionError } = await supabase
          .from('study_sessions')
          .update({
            ended_at: new Date(endTime).toISOString(),
            duration: studiedMinutes
          })
          .eq('id', sessionId);

        if (sessionError) {
          logger.study.error('❌ [useStudySession] 更新 study_sessions 记录失败:', sessionError);
        } else {
          logger.study.debug('✅ [useStudySession] 已更新 study_sessions 记录, duration =', studiedMinutes);
        }
      }

      // 获取当前用户的 companion_id 和 total_study_time
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('companion_id, total_study_time')
        .eq('id', userId)
        .single();

      const companionId = myProfile?.companion_id;
      const currentTotal = myProfile?.total_study_time || 0;

      // 累加专注时长
      const newTotal = currentTotal + studiedMinutes;
      logger.study.debug(`🏅 [useStudySession] 累计专注时长: ${currentTotal} + ${studiedMinutes} = ${newTotal} 分钟`);

      // 更新自己的状态
      const { error } = await supabase
        .from('profiles')
        .update({
          is_studying: false,
          companion_id: null,
          total_study_time: newTotal
        })
        .eq('id', userId);

      if (error) {
        logger.study.error('❌ [useStudySession] 更新自己的状态失败:', error);
        return studiedMinutes;
      } else {
        logger.study.debug('✅ [useStudySession] 已更新状态, total_study_time =', newTotal);
      }

      // 如果有好友，清除好友的关联
      if (companionId) {
        logger.study.debug(`🔗 [useStudySession] 清除好友 ${companionId} 的关联`);
        const { error: companionError } = await supabase
          .from('profiles')
          .update({ companion_id: null })
          .eq('id', companionId);

        if (companionError) {
          logger.study.error('❌ [useStudySession] 清除好友关联失败:', companionError);
        } else {
          logger.study.debug('✅ [useStudySession] 已清除好友的 companion_id');
        }
      }

      // 奖励积分
      if (studiedMinutes > 0) {
        try {
          const pointsEarned = await rewardStudyCompletion(userId, studiedMinutes);
          logger.study.debug(`💎 [useStudySession] 已奖励 ${pointsEarned} 积分`);
        } catch (error) {
          logger.study.error('❌ [useStudySession] 奖励积分失败:', error);
        }
      }

      // 清除当前会话 ID
      setCurrentSessionId(null);
      currentSessionIdRef.current = null;

      // 触发完成回调
      if (onSessionCompleteRef.current) {
        onSessionCompleteRef.current(studiedMinutes);
      }

      return studiedMinutes;
    } catch (err) {
      logger.study.error('❌ [useStudySession] 数据库更新异常:', err);
      return studiedMinutes;
    }
  }, [userId, focusStartTime, initialDuration]);

  return {
    isStudying,
    focusStartTime,
    initialDuration,
    currentSessionId,
    startStudy,
    stopStudy,
    setFocusStartTime,
    setInitialDuration
  };
}
