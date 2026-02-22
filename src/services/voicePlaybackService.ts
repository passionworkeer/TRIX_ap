export type VoicePlaybackCallbacks = {
  onStart?: () => void;
  onEnded?: () => void;
  onError?: () => void;
};

const SILENT_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';

class VoicePlaybackService {
  private audioElement: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private isUnlocked = false;
  private playbackToken = 0;
  private activeObjectUrl: string | null = null;
  private detachHandlers: (() => void) | null = null;

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.playsInline = true;
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
      void this.audioContext.resume().catch(() => undefined);

      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      source.stop(0);
    }

    const previousSrc = this.audioElement.src;
    this.audioElement.muted = true;
    this.audioElement.src = SILENT_DATA_URI;
    const unlockPromise = this.audioElement.play();

    if (unlockPromise) {
      void unlockPromise.finally(() => {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.audioElement.src = previousSrc;
        this.audioElement.muted = false;
        this.isUnlocked = true;
      });
      return;
    }

    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.audioElement.src = previousSrc;
    this.audioElement.muted = false;
    this.isUnlocked = true;
  }

  async playFromBlob(blob: Blob, callbacks: VoicePlaybackCallbacks = {}): Promise<void> {
    const playbackToken = ++this.playbackToken;
    this.stopCurrent('interrupt');

    const objectUrl = URL.createObjectURL(blob);
    this.activeObjectUrl = objectUrl;
    this.audioElement.src = objectUrl;
    this.audioElement.currentTime = 0;

    let started = false;
    const onPlay = () => {
      if (this.playbackToken !== playbackToken || started) {
        return;
      }
      started = true;
      callbacks.onStart?.();
    };
    const onEnded = () => {
      if (this.playbackToken !== playbackToken) {
        return;
      }
      callbacks.onEnded?.();
      this.cleanupAfterPlayback(playbackToken);
    };
    const onError = () => {
      if (this.playbackToken !== playbackToken) {
        return;
      }
      callbacks.onError?.();
      this.cleanupAfterPlayback(playbackToken);
    };

    this.audioElement.addEventListener('play', onPlay);
    this.audioElement.addEventListener('ended', onEnded);
    this.audioElement.addEventListener('error', onError);
    this.detachHandlers = () => {
      this.audioElement.removeEventListener('play', onPlay);
      this.audioElement.removeEventListener('ended', onEnded);
      this.audioElement.removeEventListener('error', onError);
      this.detachHandlers = null;
    };

    try {
      await this.audioElement.play();
      if (!started && this.playbackToken === playbackToken) {
        started = true;
        callbacks.onStart?.();
      }
    } catch {
      if (this.playbackToken === playbackToken) {
        callbacks.onError?.();
        this.cleanupAfterPlayback(playbackToken);
      }
    }
  }

  stopCurrent(_reason: 'interrupt' | 'manual' = 'manual'): void {
    ++this.playbackToken;
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
