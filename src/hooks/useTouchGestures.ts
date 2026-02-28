import { useState, useCallback, useRef, useEffect } from 'react';

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
}

interface UseTouchGesturesOptions {
  onSwipe?: (gesture: SwipeGesture) => void;
  onTap?: () => void;
  onLongPress?: () => void;
  swipeThreshold?: number;
  longPressDelay?: number;
}

/**
 * useTouchGestures - 触摸手势 Hook
 *
 * 支持滑动、点击、长按等手势识别
 */
export function useTouchGestures(options: UseTouchGesturesOptions = {}) {
  const {
    onSwipe,
    onTap,
    onLongPress,
    swipeThreshold = 50,
    longPressDelay = 500
  } = options;

  const touchStartRef = useRef<TouchPoint | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };
    setIsPressed(true);

    // 开始长按计时器
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
        setIsPressed(false);
      }, longPressDelay);
    }
  }, [onLongPress, longPressDelay]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // 如果移动，取消长按
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPressTimer();
    setIsPressed(false);

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.timestamp;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 判断是点击还是滑动
    if (distance < swipeThreshold) {
      // 点击
      if (onTap && deltaTime < 300) {
        onTap();
      }
    } else if (onSwipe) {
      // 滑动
      const velocity = distance / deltaTime;
      let direction: SwipeGesture['direction'];

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }

      onSwipe({
        direction,
        distance,
        velocity
      });
    }

    touchStartRef.current = null;
  }, [onSwipe, onTap, swipeThreshold, clearLongPressTimer]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    isPressed,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd
    }
  };
}

/**
 * 触摸反馈样式
 */
export const touchFeedback = {
  // 轻触反馈
  light: 'active:scale-95 transition-transform',
  // 中等反馈
  medium: 'active:scale-90 transition-transform',
  // 强烈反馈
  strong: 'active:scale-85 transition-transform',
  // 波纹效果
  ripple: 'relative overflow-hidden',
};
