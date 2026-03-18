export type VoicePlaybackCallbacks = {
  onStart?: () => void;
  onEnded?: () => void;
  onError?: () => void;
};

type AudioUnlockedListener = () => void;

const SILENT_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const IS_DEV = import.meta.env.DEV;

import { logger } from '../utils/logger';

class VoicePlaybackService {
  private audioElement: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private isUnlocked = false;
  private unlockListeners = new Set<AudioUnlockedListener>();
  private playbackToken = 0;
  private activeObjectUrl: string | null = null;
  private detachHandlers: (() => void) | null = null;

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    // playsInline is iOS Safari specific, use type assertion
    (this.audioElement as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
  }

  private debugLog(_message: string, _payload?: Record<string, unknown>): void {
    // Debug logging removed in production
    if (!IS_DEV) {
      return;
    }
  }

  private emitAudioUnlocked(): void {
    this.unlockListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        // Ignore observer errors.
        logger.debug('VoicePlayback', 'Audio unlocked listener error:', error);
      }
    });
  }

  subscribeAudioUnlocked(listener: AudioUnlockedListener): () => void {
    this.unlockListeners.add(listener);
    return () => {
      this.unlockListeners.delete(listener);
    };
  }

  getIsAudioUnlocked(): boolean {
    return this.isUnlocked;
  }

  audioContextUnlock(): void {
    if (this.isUnlocked) {
      return;
    }

    if (!this.audioContext) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        this.audioContext = new Ctx();
      }
    }

    if (this.audioContext) {
      void this.audioContext.resume().catch((error) => {
        logger.debug('VoicePlayback', 'AudioContext resume error:', error);
      });

      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      source.stop(0);
    }

    const markUnlocked = () => {
      if (this.isUnlocked) {
        return;
      }
      this.isUnlocked = true;
      this.debugLog('Audio unlocked');
      this.emitAudioUnlocked();
    };

    const previousSrc = this.audioElement.src;
    this.audioElement.muted = true;
    this.audioElement.src = SILENT_DATA_URI;
    const unlockPromise = this.audioElement.play();

    const restoreAudioElement = () => {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.src = previousSrc;
      this.audioElement.muted = false;
    };

    if (unlockPromise) {
      void unlockPromise
        .then(() => {
          markUnlocked();
        })
        .catch(() => {
          this.debugLog('Audio unlock blocked by browser');
        })
        .finally(() => {
          restoreAudioElement();
        });
      return;
    }

    markUnlocked();
    restoreAudioElement();
  }

  async playFromBlob(blob: Blob, callbacks: VoicePlaybackCallbacks = {}): Promise<void> {
    this.stopCurrent('interrupt');
    const playbackToken = this.playbackToken;

    const objectUrl = URL.createObjectURL(blob);
    this.activeObjectUrl = objectUrl;
    this.audioElement.src = objectUrl;
    this.audioElement.currentTime = 0;

    let started = false;
    const handleStarted = (event: 'play' | 'playing' | 'play-promise') => {
      if (this.playbackToken !== playbackToken || started) {
        this.debugLog('Skipped start event due to stale token', {
          event,
          playbackToken,
          activeToken: this.playbackToken,
        });
        return;
      }
      started = true;
      this.debugLog('Playback started', {
        event,
        playbackToken,
        activeToken: this.playbackToken,
      });
      callbacks.onStart?.();
    };
    const onPlay = () => {
      handleStarted('play');
    };
    const onPlaying = () => {
      handleStarted('playing');
    };
    const onEnded = () => {
      if (this.playbackToken !== playbackToken) {
        this.debugLog('Skipped ended event due to stale token', {
          playbackToken,
          activeToken: this.playbackToken,
        });
        return;
      }
      this.debugLog('Playback ended', {
        playbackToken,
        activeToken: this.playbackToken,
      });
      callbacks.onEnded?.();
      this.cleanupAfterPlayback(playbackToken);
    };
    const onError = () => {
      if (this.playbackToken !== playbackToken) {
        this.debugLog('Skipped error event due to stale token', {
          playbackToken,
          activeToken: this.playbackToken,
        });
        return;
      }
      this.debugLog('Playback error', {
        playbackToken,
        activeToken: this.playbackToken,
      });
      callbacks.onError?.();
      this.cleanupAfterPlayback(playbackToken);
    };

    this.audioElement.addEventListener('play', onPlay);
    this.audioElement.addEventListener('playing', onPlaying);
    this.audioElement.addEventListener('ended', onEnded);
    this.audioElement.addEventListener('error', onError);
    this.detachHandlers = () => {
      this.audioElement.removeEventListener('play', onPlay);
      this.audioElement.removeEventListener('playing', onPlaying);
      this.audioElement.removeEventListener('ended', onEnded);
      this.audioElement.removeEventListener('error', onError);
      this.detachHandlers = null;
    };

    try {
      await this.audioElement.play();
      if (!started && this.playbackToken === playbackToken) {
        handleStarted('play-promise');
      }
    } catch (error) {
      logger.debug('VoicePlayback', 'Playback rejected by play() promise:', error);
      if (this.playbackToken === playbackToken) {
        this.debugLog('Playback rejected by play() promise', {
          playbackToken,
          activeToken: this.playbackToken,
        });
        callbacks.onError?.();
        this.cleanupAfterPlayback(playbackToken);
      }
    }
  }

  stopCurrent(_reason: 'interrupt' | 'manual' = 'manual'): void {
    ++this.playbackToken;
    this.debugLog('Stop current playback', {
      reason: _reason,
      activeToken: this.playbackToken,
    });
    if (this.detachHandlers) {
      this.detachHandlers();
    }
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.releaseObjectUrl();
  }

  private cleanupAfterPlayback(playbackToken: number): void {
    if (this.playbackToken !== playbackToken) {
      return;
    }
    if (this.detachHandlers) {
      this.detachHandlers();
    }
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.releaseObjectUrl();
  }

  private releaseObjectUrl(): void {
    if (!this.activeObjectUrl) {
      return;
    }
    URL.revokeObjectURL(this.activeObjectUrl);
    this.activeObjectUrl = null;
    this.audioElement.removeAttribute('src');
    this.audioElement.load();
  }
}

const voicePlaybackService = new VoicePlaybackService();

export const audioContextUnlock = (): void => {
  voicePlaybackService.audioContextUnlock();
};

export const isAudioUnlocked = (): boolean => {
  return voicePlaybackService.getIsAudioUnlocked();
};

export const subscribeAudioUnlocked = (listener: AudioUnlockedListener): (() => void) => {
  return voicePlaybackService.subscribeAudioUnlocked(listener);
};

export const playFromBlob = (
  blob: Blob,
  callbacks?: VoicePlaybackCallbacks
): Promise<void> => {
  return voicePlaybackService.playFromBlob(blob, callbacks);
};

export const stopCurrent = (reason: 'interrupt' | 'manual' = 'manual'): void => {
  voicePlaybackService.stopCurrent(reason);
};

export default voicePlaybackService;
