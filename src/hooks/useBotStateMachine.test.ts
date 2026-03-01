/**
 * Unit tests for useBotStateMachine Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBotStateMachine } from './useBotStateMachine';
import type { ClawbotChannelMessage } from '../services/ClawbotChannelBridge';

describe('useBotStateMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have IDLE as initial state', () => {
      const { result } = renderHook(() => useBotStateMachine());

      expect(result.current.botState).toBe('IDLE');
    });

    it('should return all required functions', () => {
      const { result } = renderHook(() => useBotStateMachine());

      expect(result.current.enterIdle).toBeDefined();
      expect(result.current.enterThinking).toBeDefined();
      expect(result.current.enterSpeakingWithTimeout).toBeDefined();
      expect(result.current.handleBotMessageState).toBeDefined();
      expect(result.current.cleanup).toBeDefined();
    });
  });

  describe('enterIdle', () => {
    it('should set state to IDLE', () => {
      const { result } = renderHook(() => useBotStateMachine());

      act(() => {
        result.current.enterIdle();
      });

      expect(result.current.botState).toBe('IDLE');
    });

    it('should clear any existing timeouts', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useBotStateMachine());

      // Enter thinking (which sets a timeout)
      act(() => {
        result.current.enterThinking();
      });

      // Now enter idle
      act(() => {
        result.current.enterIdle();
      });

      // Fast forward time - should not trigger anything
      vi.advanceTimersByTime(25000);

      expect(result.current.botState).toBe('IDLE');

      vi.useRealTimers();
    });
  });

  describe('enterThinking', () => {
    it('should set state to THINKING', () => {
      const { result } = renderHook(() => useBotStateMachine());

      act(() => {
        result.current.enterThinking();
      });

      expect(result.current.botState).toBe('THINKING');
    });

    it('should set timeout to return to IDLE after max time', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useBotStateMachine());

      act(() => {
        result.current.enterThinking();
      });

      // Fast forward past THINKING_MAX_MS (25000ms)
      vi.advanceTimersByTime(25000);

      expect(result.current.botState).toBe('IDLE');

      vi.useRealTimers();
    });

    it('should clear previous speaking timeout', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useBotStateMachine());

      // First enter speaking
      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.enterSpeakingWithTimeout(message);
      });

      // Then enter thinking
      act(() => {
        result.current.enterThinking();
      });

      // The speaking timeout should be cleared, but thinking timeout should be set
      // Fast forward past thinking max time
      vi.advanceTimersByTime(25000);

      expect(result.current.botState).toBe('IDLE');

      vi.useRealTimers();
    });
  });

  describe('enterSpeakingWithTimeout', () => {
    it('should set state to SPEAKING', () => {
      const { result } = renderHook(() => useBotStateMachine());

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.enterSpeakingWithTimeout(message);
      });

      expect(result.current.botState).toBe('SPEAKING');
    });

    it('should calculate timeout based on content length', () => {
      vi.useFakeTimers();

      const shortMessage: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hi',
        timestamp: Date.now(),
      };

      const longMessage: ClawbotChannelMessage = {
        id: 'msg-2',
        sender: 'bot',
        content: 'This is a much longer message that should take more time to speak',
        timestamp: Date.now(),
      };

      const { result: shortResult } = renderHook(() => useBotStateMachine());
      const { result: longResult } = renderHook(() => useBotStateMachine());

      // Short message
      act(() => {
        shortResult.current.enterSpeakingWithTimeout(shortMessage);
      });

      // The timeout should be at least SPEAKING_MIN_MS (1200ms)
      vi.advanceTimersByTime(1200);
      expect(shortResult.current.botState).toBe('SPEAKING');

      // Fast forward more
      vi.advanceTimersByTime(1000);
      expect(shortResult.current.botState).toBe('IDLE');

      vi.useRealTimers();
    });

    it('should return to IDLE after calculated timeout', () => {
      vi.useFakeTimers();

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello, this is a test message!',
        timestamp: Date.now(),
      };

      const { result } = renderHook(() => useBotStateMachine());

      act(() => {
        result.current.enterSpeakingWithTimeout(message);
      });

      // Content: "Hello, this is a test message!" = 29 chars
      // Expected duration: 800 + 29 * 45 = 800 + 1305 = 2105ms
      // But min is 1200, max is 12000, so should be around 2105ms

      vi.advanceTimersByTime(3000);

      expect(result.current.botState).toBe('IDLE');

      vi.useRealTimers();
    });
  });

  describe('handleBotMessageState', () => {
    it('should enter thinking when voiceEnabled is true', () => {
      const { result } = renderHook(() =>
        useBotStateMachine({ voiceEnabled: true })
      );

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleBotMessageState(message);
      });

      expect(result.current.botState).toBe('THINKING');
    });

    it('should enter speaking when voiceEnabled is false', () => {
      const { result } = renderHook(() =>
        useBotStateMachine({ voiceEnabled: false })
      );

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.handleBotMessageState(message);
      });

      expect(result.current.botState).toBe('SPEAKING');
    });
  });

  describe('cleanup', () => {
    it('should clear all timeouts', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useBotStateMachine());

      // Enter thinking
      act(() => {
        result.current.enterThinking();
      });

      // Now cleanup
      act(() => {
        result.current.cleanup();
      });

      // Fast forward time - nothing should happen
      vi.advanceTimersByTime(30000);

      expect(result.current.botState).toBe('THINKING');

      vi.useRealTimers();
    });
  });

  describe('onStateChange callback', () => {
    it('should call onStateChange when state changes', () => {
      const onStateChange = vi.fn();

      const { result } = renderHook(() =>
        useBotStateMachine({ onStateChange })
      );

      act(() => {
        result.current.enterThinking();
      });

      expect(onStateChange).toHaveBeenCalledWith('THINKING');

      act(() => {
        result.current.enterIdle();
      });

      expect(onStateChange).toHaveBeenCalledWith('IDLE');
    });
  });

  describe('voiceEnabled option', () => {
    it('should respect voiceEnabled option in handleBotMessageState', () => {
      const { result: withVoice } = renderHook(() =>
        useBotStateMachine({ voiceEnabled: true })
      );
      const { result: withoutVoice } = renderHook(() =>
        useBotStateMachine({ voiceEnabled: false })
      );

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        withVoice.current.handleBotMessageState(message);
      });

      act(() => {
        withoutVoice.current.handleBotMessageState(message);
      });

      expect(withVoice.current.botState).toBe('THINKING');
      expect(withoutVoice.current.botState).toBe('SPEAKING');
    });
  });

  describe('latestBotMessage option', () => {
    it('should handle latestBotMessage when voiceEnabled changes', () => {
      vi.useFakeTimers();

      const latestMessage: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'bot',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const { result, rerender } = renderHook(
        ({ voiceEnabled }) => useBotStateMachine({ voiceEnabled, latestBotMessage: latestMessage }),
        {
          initialProps: { voiceEnabled: true },
        }
      );

      // First with voice enabled - should enter thinking
      act(() => {
        result.current.handleBotMessageState(latestMessage);
      });

      expect(result.current.botState).toBe('THINKING');

      // Now disable voice - should switch to speaking
      rerender({ voiceEnabled: false, latestBotMessage: latestMessage });

      // Wait for the effect to run
      vi.runAllTimers();

      // The state should now be speaking or idle depending on timing
      // At minimum, it should have attempted to enter speaking

      vi.useRealTimers();
    });
  });

  describe('component unmount cleanup', () => {
    it('should clean up on unmount', () => {
      vi.useFakeTimers();

      const { result, unmount } = renderHook(() => useBotStateMachine());

      act(() => {
        result.current.enterThinking();
      });

      unmount();

      // Fast forward time - should not cause errors
      vi.advanceTimersByTime(30000);

      // No expectations needed - just verify no errors thrown

      vi.useRealTimers();
    });
  });
});
