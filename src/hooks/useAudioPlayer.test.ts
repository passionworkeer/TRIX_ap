/**
 * Unit tests for useAudioPlayer Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudioPlayer, MUSIC_TRACKS, MusicTrack } from './useAudioPlayer';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock Audio
class MockAudio {
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
  loop = false;
  volume = 0.5;
  src = '';
  currentTime = 0;

  addEventListener = vi.fn((event: string, callback: Function) => {
    // Store callback for later triggering
  });

  removeEventListener = vi.fn();
}

describe.skip('useAudioPlayer', () => {
  let mockAudio: MockAudio;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockAudio = new MockAudio();

    // Mock Audio constructor
    vi.spyOn(window, 'Audio').mockImplementation(() => mockAudio as unknown as HTMLAudioElement);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAudioPlayer());

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentTrack).toBeNull();
      expect(result.current.volume).toBe(0.5);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should load volume from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('0.8');

      const { result } = renderHook(() => useAudioPlayer());

      expect(result.current.volume).toBe(0.8);
    });

    it('should handle invalid volume in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('invalid');

      const { result } = renderHook(() => useAudioPlayer());

      expect(result.current.volume).toBe(0.5); // Default
    });
  });

  describe('MUSIC_TRACKS', () => {
    it('should have predefined tracks', () => {
      expect(MUSIC_TRACKS).toBeDefined();
      expect(MUSIC_TRACKS.length).toBeGreaterThan(0);
    });

    it('should have tracks with required properties', () => {
      MUSIC_TRACKS.forEach((track) => {
        expect(track.id).toBeDefined();
        expect(track.name).toBeDefined();
        expect(track.nameEn).toBeDefined();
        expect(track.icon).toBeDefined();
        expect(track.url).toBeDefined();
        expect(track.category).toBeDefined();
      });
    });

    it('should have tracks in correct categories', () => {
      const natureTracks = MUSIC_TRACKS.filter((t) => t.category === 'nature');
      const ambientTracks = MUSIC_TRACKS.filter((t) => t.category === 'ambient');
      const musicTracks = MUSIC_TRACKS.filter((t) => t.category === 'music');

      expect(natureTracks.length).toBeGreaterThan(0);
      expect(ambientTracks.length).toBeGreaterThan(0);
      expect(musicTracks.length).toBeGreaterThan(0);
    });
  });

  describe('play', () => {
    it('should play a track', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.play(testTrack);
      });

      expect(mockAudio.src).toBe(testTrack.url);
      expect(mockAudio.load).toHaveBeenCalled();
      expect(mockAudio.play).toHaveBeenCalled();
      expect(result.current.currentTrack).toEqual(testTrack);
    });

    it('should set loading state while loading', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      // Get the canplay handler
      let canPlayCallback: Function | null = null;
      mockAudio.addEventListener.mockImplementation((event: string, callback: Function) => {
        if (event === 'canplay') {
          canPlayCallback = callback;
        }
      });

      act(() => {
        result.current.play(testTrack);
      });

      expect(result.current.isLoading).toBe(true);

      // Simulate canplay event
      if (canPlayCallback) {
        await act(async () => {
          canPlayCallback();
        });
      }

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isPlaying).toBe(true);
      });
    });

    it('should toggle play state when playing same track', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      // First play
      await act(async () => {
        result.current.play(testTrack);
      });

      // Simulate playing
      await act(async () => {
        const playCallback = mockAudio.addEventListener.mock.calls.find(
          (call: any[]) => call[0] === 'play'
        )?.[1];
        if (playCallback) playCallback();
      });

      expect(result.current.isPlaying).toBe(true);

      // Now try to play same track again
      await act(async () => {
        result.current.play(testTrack);
      });

      // Should just toggle, not reload
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should switch tracks correctly', async () => {
      const track1: MusicTrack = {
        id: 'track-1',
        name: 'Track 1',
        nameEn: 'Track 1',
        icon: '🎵',
        url: 'https://example.com/track1.mp3',
        category: 'music',
      };

      const track2: MusicTrack = {
        id: 'track-2',
        name: 'Track 2',
        nameEn: 'Track 2',
        icon: '🎵',
        url: 'https://example.com/track2.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.play(track1);
      });

      expect(result.current.currentTrack).toEqual(track1);

      await act(async () => {
        result.current.play(track2);
      });

      expect(mockAudio.src).toBe(track2.url);
      expect(result.current.currentTrack).toEqual(track2);
    });
  });

  describe('pause', () => {
    it('should pause playback', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.play(testTrack);
      });

      // Simulate play event
      await act(async () => {
        const playCallback = mockAudio.addEventListener.mock.calls.find(
          (call: any[]) => call[0] === 'play'
        )?.[1];
        if (playCallback) playCallback();
      });

      act(() => {
        result.current.pause();
      });

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle play/pause when track is loaded', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.play(testTrack);
      });

      // Simulate play event
      await act(async () => {
        const playCallback = mockAudio.addEventListener.mock.calls.find(
          (call: any[]) => call[0] === 'play'
        )?.[1];
        if (playCallback) playCallback();
      });

      // Toggle - should pause
      act(() => {
        result.current.toggle();
      });

      expect(mockAudio.pause).toHaveBeenCalled();

      // Toggle again - should play
      act(() => {
        result.current.toggle();
      });

      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should do nothing when no track is loaded', () => {
      const { result } = renderHook(() => useAudioPlayer());

      act(() => {
        result.current.toggle();
      });

      expect(mockAudio.play).not.toHaveBeenCalled();
      expect(mockAudio.pause).not.toHaveBeenCalled();
    });
  });

  describe('setVolume', () => {
    it('should set volume correctly', () => {
      const { result } = renderHook(() => useAudioPlayer());

      act(() => {
        result.current.setVolume(0.7);
      });

      expect(mockAudio.volume).toBe(0.7);
      expect(result.current.volume).toBe(0.7);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('study-music-volume', '0.7');
    });

    it('should clamp volume between 0 and 1', () => {
      const { result } = renderHook(() => useAudioPlayer());

      act(() => {
        result.current.setVolume(1.5);
      });

      expect(result.current.volume).toBe(1);

      act(() => {
        result.current.setVolume(-0.5);
      });

      expect(result.current.volume).toBe(0);
    });
  });

  describe('stop', () => {
    it('should stop playback and reset time', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.play(testTrack);
      });

      mockAudio.currentTime = 30;

      act(() => {
        result.current.stop();
      });

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.currentTime).toBe(0);
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle play error', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      mockAudio.play = vi.fn().mockRejectedValue(new Error('Playback failed'));

      const { result } = renderHook(() => useAudioPlayer());

      await act(async () => {
        result.current.play(testTrack);
      });

      // Wait for error handling
      await waitFor(() => {
        expect(result.current.error).toBe('播放失败');
        expect(result.current.isPlaying).toBe(false);
      });
    });

    it('should handle audio error event', async () => {
      const testTrack: MusicTrack = {
        id: 'test-track',
        name: 'Test Track',
        nameEn: 'Test',
        icon: '🎵',
        url: 'https://example.com/test.mp3',
        category: 'music',
      };

      const { result } = renderHook(() => useAudioPlayer());

      let errorCallback: Function | null = null;
      mockAudio.addEventListener.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      await act(async () => {
        result.current.play(testTrack);
      });

      // Simulate error event
      if (errorCallback) {
        await act(async () => {
          errorCallback();
        });
      }

      await waitFor(() => {
        expect(result.current.error).toBe('加载音频失败');
        expect(result.current.isPlaying).toBe(false);
      });
    });
  });
});
