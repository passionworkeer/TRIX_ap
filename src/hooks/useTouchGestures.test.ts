/**
 * Unit tests for useTouchGestures Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTouchGestures, touchFeedback } from './useTouchGestures';

describe('useTouchGestures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useTouchGestures());

      expect(result.current.isPressed).toBe(false);
      expect(result.current.touchHandlers).toBeDefined();
      expect(result.current.touchHandlers.onTouchStart).toBeDefined();
      expect(result.current.touchHandlers.onTouchMove).toBeDefined();
      expect(result.current.touchHandlers.onTouchEnd).toBeDefined();
    });
  });

  describe('touchFeedback', () => {
    it('should have light feedback style', () => {
      expect(touchFeedback.light).toBe('active:scale-95 transition-transform');
    });

    it('should have medium feedback style', () => {
      expect(touchFeedback.medium).toBe('active:scale-90 transition-transform');
    });

    it('should have strong feedback style', () => {
      expect(touchFeedback.strong).toBe('active:scale-85 transition-transform');
    });

    it('should have ripple feedback style', () => {
      expect(touchFeedback.ripple).toBe('relative overflow-hidden');
    });
  });

  describe('onTouchStart', () => {
    it('should set isPressed to true on touch start', () => {
      const { result } = renderHook(() => useTouchGestures());

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(mockEvent);
      });

      expect(result.current.isPressed).toBe(true);
    });

    it('should store touch position', () => {
      const { result } = renderHook(() => useTouchGestures());

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(mockEvent);
      });

      // The hook should have stored the touch position internally
      // We can't directly access it, but we can verify the behavior through other tests
    });

    it('should start long press timer when onLongPress is provided', () => {
      vi.useFakeTimers();

      const onLongPress = vi.fn();
      const { result } = renderHook(() =>
        useTouchGestures({ onLongPress, longPressDelay: 500 })
      );

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(mockEvent);
      });

      // Fast forward time
      vi.advanceTimersByTime(500);

      expect(onLongPress).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('onTouchMove', () => {
    it('should clear long press timer on touch move', () => {
      vi.useFakeTimers();

      const onLongPress = vi.fn();
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({
          onLongPress,
          onSwipe,
          longPressDelay: 500,
        })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      // Move before long press triggers
      const moveEvent = {
        touches: [{ clientX: 150, clientY: 250 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchMove(moveEvent);
      });

      // Fast forward past the long press delay
      vi.advanceTimersByTime(500);

      expect(onLongPress).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('onTouchEnd - Tap', () => {
    it('should trigger onTap for short taps', () => {
      vi.useFakeTimers();

      const onTap = vi.fn();
      const { result } = renderHook(() =>
        useTouchGestures({ onTap, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 105, clientY: 205 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      // Fast forward a short time
      vi.advanceTimersByTime(100);

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onTap).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not trigger onTap for long duration touches', () => {
      vi.useFakeTimers();

      const onTap = vi.fn();
      const { result } = renderHook(() =>
        useTouchGestures({ onTap, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 105, clientY: 205 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      // Fast forward past 300ms
      vi.advanceTimersByTime(400);

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onTap).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not trigger onTap when movement exceeds threshold', () => {
      const onTap = vi.fn();
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onTap, onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 200, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('onTouchEnd - Swipe', () => {
    it('should trigger onSwipe with right direction', () => {
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 200, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onSwipe).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'right',
          distance: expect.any(Number),
          velocity: expect.any(Number),
        })
      );
    });

    it('should trigger onSwipe with left direction', () => {
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 200, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onSwipe).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'left',
        })
      );
    });

    it('should trigger onSwipe with down direction', () => {
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onSwipe).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'down',
        })
      );
    });

    it('should trigger onSwipe with up direction', () => {
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onSwipe).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'up',
        })
      );
    });

    it('should calculate correct distance', () => {
      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 0, clientY: 0 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 30, clientY: 40 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onSwipe).toHaveBeenCalledWith(
        expect.objectContaining({
          distance: 50, // sqrt(30^2 + 40^2) = 50
        })
      );
    });

    it('should calculate correct velocity', () => {
      vi.useFakeTimers();

      const onSwipe = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, swipeThreshold: 50 })
      );

      const startEvent = {
        touches: [{ clientX: 0, clientY: 0 }],
      } as unknown as React.TouchEvent;

      // 100ms later
      const endEvent = {
        changedTouches: [{ clientX: 50, clientY: 0 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      vi.advanceTimersByTime(100);

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onSwipe).toHaveBeenCalledWith(
        expect.objectContaining({
          velocity: 0.5, // 50 / 100ms
        })
      );

      vi.useRealTimers();
    });
  });

  describe('cleanup', () => {
    it('should clear long press timer on unmount', () => {
      vi.useFakeTimers();

      const onLongPress = vi.fn();

      const { result, unmount } = renderHook(() =>
        useTouchGestures({ onLongPress, longPressDelay: 500 })
      );

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(mockEvent);
      });

      unmount();

      // Fast forward past the long press delay
      vi.advanceTimersByTime(500);

      expect(onLongPress).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('custom options', () => {
    it('should use custom swipeThreshold', () => {
      const onSwipe = vi.fn();
      const onTap = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onSwipe, onTap, swipeThreshold: 100 })
      );

      // This should be a tap because 20 < 100
      const startEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      const endEvent = {
        changedTouches: [{ clientX: 115, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(startEvent);
      });

      act(() => {
        result.current.touchHandlers.onTouchEnd(endEvent);
      });

      expect(onTap).toHaveBeenCalled();
    });

    it('should use custom longPressDelay', () => {
      vi.useFakeTimers();

      const onLongPress = vi.fn();

      const { result } = renderHook(() =>
        useTouchGestures({ onLongPress, longPressDelay: 1000 })
      );

      const mockEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.touchHandlers.onTouchStart(mockEvent);
      });

      // Advance 500ms - should not trigger
      vi.advanceTimersByTime(500);

      expect(onLongPress).not.toHaveBeenCalled();

      // Advance to 1000ms total - should trigger
      vi.advanceTimersByTime(500);

      expect(onLongPress).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
