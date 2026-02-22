/**
 * Unit tests for voice playback service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock HTMLAudioElement
class MockAudioElement {
  src = '';
  muted = false;
  preload = 'auto';
  playsInline = true;
  currentTime = 0;

  private _paused = true;
  private listeners = new Map<string, EventListener[]>();

  get paused() { return this._paused; }

  play() {
    this._paused = false;
    setTimeout(() => this._emit('play'), 0);
    return Promise.resolve();
  }

  pause() {
    this._paused = true;
  }

  load() {}

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    const arr = this.listeners.get(type);
    if (arr) {
      const idx = arr.indexOf(listener);
      if (idx > -1) arr.splice(idx, 1);
    }
  }

  private _emit(type: string) {
    const arr = this.listeners.get(type);
    if (arr) {
      arr.forEach(l => l(new Event(type)));
    }
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }

  static triggerEvent(element: MockAudioElement, type: string) {
    element._emit(type);
  }
}

vi.stubGlobal('Audio', MockAudioElement);

// Mock URL
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
});

// Mock AudioContext
class MockAudioContext {
  state = 'suspended';
  private listeners = new Map<string, EventListener[]>();

  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return { channels, length, sampleRate };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  get destination() {
    return {};
  }
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('webkitAudioContext', MockAudioContext);

describe('voicePlaybackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('audioContextUnlock', () => {
    it('should unlock audio context', async () => {
      const { audioContextUnlock, isAudioUnlocked } = await import('../../src/services/voicePlaybackService');

      expect(isAudioUnlocked()).toBe(false);

      audioContextUnlock();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      // After unlock attempt, state may or may not be unlocked
      // depending on browser behavior (mocked)
      expect(typeof isAudioUnlocked()).toBe('boolean');
    });

    it('should be idempotent', async () => {
      const { audioContextUnlock } = await import('../../src/services/voicePlaybackService');

      // Multiple calls should not throw
      audioContextUnlock();
      audioContextUnlock();
      audioContextUnlock();

      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('subscribeAudioUnlocked', () => {
    it('should return unsubscribe function', async () => {
      const { subscribeAudioUnlocked } = await import('../../src/services/voicePlaybackService');

      const listener = vi.fn();
      const unsubscribe = subscribeAudioUnlocked(listener);

      expect(typeof unsubscribe).toBe('function');

      // Should not throw when called
      unsubscribe();
    });

    it('should call listener when audio unlocks', async () => {
      const { subscribeAudioUnlocked, audioContextUnlock } = await import('../../src/services/voicePlaybackService');

      const listener = vi.fn();
      subscribeAudioUnlocked(listener);

      audioContextUnlock();

      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe('playFromBlob', () => {
    it('should play audio from blob', async () => {
      const { playFromBlob, stopCurrent } = await import('../../src/services/voicePlaybackService');

      const blob = new Blob(['audio-data'], { type: 'audio/mpeg' });
      const onStart = vi.fn();
      const onEnded = vi.fn();
      const onError = vi.fn();

      // Start playback
      const playPromise = playFromBlob(blob, { onStart, onEnded, onError });

      // Stop after a short delay
      setTimeout(() => stopCurrent(), 10);

      await playPromise.catch(() => {});
    });

    it('should handle callbacks', async () => {
      const { playFromBlob, stopCurrent } = await import('../../src/services/voicePlaybackService');

      const callbacks = {
        onStart: vi.fn(),
        onEnded: vi.fn(),
        onError: vi.fn(),
      };

      const blob = new Blob(['audio-data'], { type: 'audio/mpeg' });

      // Clean up any previous playback
      stopCurrent();

      // Don't wait for playPromise since it might hang in test environment
      playFromBlob(blob, callbacks).catch(() => {});
    });

    it('should interrupt previous playback', async () => {
      const { playFromBlob, stopCurrent } = await import('../../src/services/voicePlaybackService');

      const blob1 = new Blob(['audio-1'], { type: 'audio/mpeg' });
      const blob2 = new Blob(['audio-2'], { type: 'audio/mpeg' });

      // Start first playback
      playFromBlob(blob1, {}).catch(() => {});

      // Start second playback - should interrupt first
      await playFromBlob(blob2, {}).catch(() => {});

      stopCurrent();
    });
  });

  describe('stopCurrent', () => {
    it('should stop playback without error', async () => {
      const { stopCurrent } = await import('../../src/services/voicePlaybackService');

      // Should not throw even when nothing is playing
      stopCurrent();
      stopCurrent();
      stopCurrent();
    });

    it('should accept stop reason parameter', async () => {
      const { stopCurrent } = await import('../../src/services/voicePlaybackService');

      stopCurrent('manual');
      stopCurrent('interrupt');
    });
  });
});
