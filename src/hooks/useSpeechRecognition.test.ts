import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;

  start() {
    if (this.onstart) this.onstart();
  }

  stop() {
    if (this.onend) this.onend();
  }

  abort() {
    if (this.onend) this.onend();
  }
}

// Mock window
const mockSpeechRecognition = {
  isSupported: true,
  SpeechRecognition: MockSpeechRecognition,
  webkitSpeechRecognition: MockSpeechRecognition,
};

Object.defineProperty(window, 'SpeechRecognition', {
  value: mockSpeechRecognition.SpeechRecognition,
  writable: true,
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: mockSpeechRecognition.webkitSpeechRecognition,
  writable: true,
});

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should export correct interface', async () => {
    const { useSpeechRecognition } = await import('./useSpeechRecognition');

    const {
      isListening,
      transcript,
      interimTranscript,
      startListening,
      stopListening,
      resetTranscript,
      isSupported,
      error
    } = useSpeechRecognition();

    expect(typeof isListening).toBe('boolean');
    expect(typeof transcript).toBe('string');
    expect(typeof interimTranscript).toBe('string');
    expect(typeof startListening).toBe('function');
    expect(typeof stopListening).toBe('function');
    expect(typeof resetTranscript).toBe('function');
    expect(typeof isSupported).toBe('boolean');
    expect(error).toBeNull();
  });
});
