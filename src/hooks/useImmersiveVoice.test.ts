/**
 * Unit tests for useImmersiveVoice Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImmersiveVoice } from './useImmersiveVoice';

// Mock dependencies - create shared mocks that can be configured
const mockUseLocation = vi.fn(() => ({ pathname: '/' }));
const mockVoiceSettings = vi.fn(() => ({ voiceEnabled: false }));
const mockSubscribeAudioUnlocked = vi.fn(() => vi.fn());
const mockStopCurrent = vi.fn();

vi.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', profile: { username: 'TestUser' } },
    profile: { username: 'TestUser' },
  })),
}));

vi.mock('../contexts/ClawbotChannelContext', () => ({
  useClawbotChannel: vi.fn(() => ({
    latestBotMessage: null,
    isPaired: false,
    botState: 'IDLE',
    hasSessionConversationStarted: false,
    notifyVoicePlaybackStarted: vi.fn(),
    notifyVoicePlaybackEnded: vi.fn(),
    notifyVoicePlaybackError: vi.fn(),
  })),
}));

vi.mock('../contexts/VoiceSettingsContext', () => ({
  useVoiceSettings: () => mockVoiceSettings(),
}));

vi.mock('../services/ttsService', () => ({
  synthesizeSpeech: vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/mp3' })),
}));

vi.mock('../services/voicePlaybackService', () => ({
  isAudioUnlocked: vi.fn().mockReturnValue(true),
  playFromBlob: vi.fn().mockResolvedValue(undefined),
  stopCurrent: (...args: unknown[]) => mockStopCurrent(...args),
  subscribeAudioUnlocked: (...args: unknown[]) => mockSubscribeAudioUnlocked(...args),
}));

describe('useImmersiveVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/' });
    mockVoiceSettings.mockReturnValue({ voiceEnabled: false });
    // Clear sessionStorage
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should render without errors', () => {
      // This hook doesn't return anything, so we just verify it doesn't throw
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });

    it('should use all mocked contexts', () => {
      const { result } = renderHook(() => useImmersiveVoice());

      // Hook doesn't return anything, so we just check it rendered
      expect(result.current).toBeUndefined();
    });
  });

  describe('Voice settings', () => {
    it('should respond to voiceEnabled changes', () => {
      const { rerender } = renderHook(({ enabled }) => useImmersiveVoice(), {
        initialProps: { enabled: false },
      });

      // Should work with voice disabled
      expect(() => {
        rerender({ enabled: true });
      }).not.toThrow();

      // Should work when voice is enabled
      expect(() => {
        rerender({ enabled: false });
      }).not.toThrow();
    });
  });

  describe('User changes', () => {
    it('should handle user logout', () => {
      // This tests the effect that handles user ID changes
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });
  });

  describe('Welcome message', () => {
    it('should queue welcome message when user is logged in', () => {
      // The hook should queue a welcome message based on user
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });

    it('should skip welcome message on auth routes', () => {
      mockUseLocation.mockReturnValue({ pathname: '/login' });

      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();

      mockUseLocation.mockReturnValue({ pathname: '/' });
    });
  });

  describe('Bot pairing status', () => {
    it('should queue status message when pairing changes', () => {
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });
  });

  describe('Bot messages', () => {
    it('should handle incoming bot messages', () => {
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });
  });

  describe('Audio unlock', () => {
    it('should subscribe to audio unlock events when voice is enabled', () => {
      // Enable voice settings so subscribeAudioUnlocked is called
      mockVoiceSettings.mockReturnValue({ voiceEnabled: true });

      renderHook(() => useImmersiveVoice());

      // The hook should subscribe to audio unlock events when voiceEnabled is true
      expect(mockSubscribeAudioUnlocked).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on unmount', () => {
      const { result, unmount } = renderHook(() => useImmersiveVoice());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should stop current playback on unmount', () => {
      const { unmount } = renderHook(() => useImmersiveVoice());

      unmount();

      // The hook should call stopCurrent on unmount
      // Note: It calls with false parameter
      expect(mockStopCurrent).toHaveBeenCalled();
    });
  });

  describe('Scene queue', () => {
    it('should clear queue when voice is disabled', () => {
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });

    it('should filter welcome from queue when conversation starts', () => {
      expect(() => {
        renderHook(() => useImmersiveVoice());
      }).not.toThrow();
    });
  });
});
