import { useState, useEffect, useRef, useCallback } from 'react';

interface UseStudyTimerOptions {
  /** 初始时长（分钟） */
  initialDuration: number;
  /** 是否处于计时器页面 */
  isTimerPage: boolean;
  /** 计时完成回调 */
  onComplete?: () => void;
}

interface UseStudyTimerReturn {
  /** 剩余时间（秒） */
  timeLeft: number;
  /** 是否正在计时 */
  isActive: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 初始时长（分钟） */
  initialDuration: number;
  /** 开始计时 */
  startTimer: (duration: number) => void;
  /** 停止计时 */
  stopTimer: () => void;
  /** 格式化时间 */
  formatTime: (seconds: number) => { m: string; s: string };
  /** 设置初始时长 */
  setInitialDuration: (duration: number) => void;
}

/**
 * useStudyTimer - 专注计时器 Hook
 *
 * 管理专注倒计时逻辑
 */
export function useStudyTimer(options: UseStudyTimerOptions): UseStudyTimerReturn {
  const { initialDuration: defaultDuration, isTimerPage, onComplete } = options;

  const [timeLeft, setTimeLeft] = useState(defaultDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [initialDuration, setInitialDuration] = useState(defaultDuration);

  // 完成锁 - 确保完成逻辑只执行一次
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const isActiveRef = useRef(isActive);

  // 更新回调引用
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // 更新 isActive 引用
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // 进入计时器页面时初始化
  useEffect(() => {
    if (isTimerPage) {
      startTimer(initialDuration);
    } else {
      setIsActive(false);
    }
  }, [isTimerPage]);

  // 倒计时逻辑
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isTimerPage && isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive && !hasCompletedRef.current) {
      // 倒计时结束
      hasCompletedRef.current = true;
      setIsActive(false);
      setIsCompleted(true);

      // 触发完成回调
      if (onCompleteRef.current) {
        onCompleteRef.current();
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerPage, isActive, timeLeft]);

  const startTimer = useCallback((duration: number) => {
    setTimeLeft(duration * 60);
    setIsActive(true);
    setIsCompleted(false);
    hasCompletedRef.current = false;
    setInitialDuration(duration);
  }, []);

  const stopTimer = useCallback(() => {
    setIsActive(false);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return {
      m: mins.toString().padStart(2, '0'),
      s: secs.toString().padStart(2, '0')
    };
  }, []);

  return {
    timeLeft,
    isActive,
    isCompleted,
    initialDuration,
    startTimer,
    stopTimer,
    formatTime,
    setInitialDuration
  };
}
