/**
 * Unit tests for useSpeechToText Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeechToText } from './useSpeechToText';

// Mock Web Speech API classes
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'zh-CN';
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onstart: ((event: any) => void) | null = null;
  onend: ((event: any) => void) | null = null;

  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

describe('useSpeechToText', () => {
  let mockInstance: MockSpeechRecognition;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInstance = new MockSpeechRecognition();

    // Properly mock SpeechRecognition using vi.stubGlobal
    vi.stubGlobal('SpeechRecognition', vi.fn(() => mockInstance));
    vi.stubGlobal('webkitSpeechRecognition', vi.fn(() => mockInstance));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('should have correct initial state', async () => {
      const { result } = renderHook(() => useSpeechToText());

      // Wait for useEffect to run
      await waitFor(() => {
        expect(result.current.status).toBe('idle');
      });
      expect(result.current.transcript).toBe('');
      expect(result.current.interimTranscript).toBe('');
      expect(result.current.isSupported).toBe(true);
      expect(result.current.error).toBe('');
    });

    it('should detect speech recognition support', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });
    });

    it('should handle unsupported browser', async () => {
      // Remove mocks to simulate unsupported browser
      vi.stubGlobal('SpeechRecognition', undefined);
      vi.stubGlobal('webkitSpeechRecognition', undefined);

      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(false);
        expect(result.current.error).toBe('当前浏览器不支持语音识别');
      });
    });
  });

  describe('startListening', () => {
    it('should start listening successfully', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      expect(mockInstance.start).toHaveBeenCalled();
    });

    it('should clear previous transcript when starting', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      // After starting, transcript should be empty
      expect(result.current.transcript).toBe('');
    });

    it('should handle error when not supported', async () => {
      vi.stubGlobal('SpeechRecognition', undefined);
      vi.stubGlobal('webkitSpeechRecognition', undefined);

      const { result } = renderHook(() => useSpeechToText());

      await act(async () => {
        await result.current.startListening();
      });

      expect(result.current.error).toBe('语音识别不可用');
    });
  });

  describe('stopListening', () => {
    it('should stop listening', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      await act(async () => {
        await result.current.stopListening();
      });

      expect(mockInstance.stop).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await act(async () => {
        result.current.reset();
      });

      expect(result.current.transcript).toBe('');
      expect(result.current.interimTranscript).toBe('');
      expect(result.current.error).toBe('');
      expect(result.current.status).toBe('idle');
    });
  });

  describe('onResult callback', () => {
    it('should call onResult callback when result is final', async () => {
      const onResult = vi.fn();

      const { result } = renderHook(() =>
        useSpeechToText({ onResult })
      );

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      // Simulate recognition result
      if (mockInstance.onresult) {
        mockInstance.onresult({
          results: [
            {
              isFinal: true,
              0: { transcript: 'Hello world', confidence: 0.9 },
            },
          ],
          resultIndex: 0,
        });
      }

      await waitFor(() => {
        expect(onResult).toHaveBeenCalledWith('Hello world');
      });
    });
  });

  describe('onStatusChange callback', () => {
    it('should call onStatusChange when status changes', async () => {
      const onStatusChange = vi.fn();

      const { result } = renderHook(() =>
        useSpeechToText({ onStatusChange })
      );

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      // Manually trigger onstart since mock.start() doesn't call it
      if (mockInstance.onstart) {
        mockInstance.onstart({} as Event);
      }

      expect(onStatusChange).toHaveBeenCalledWith('listening');

      await act(async () => {
        await result.current.stopListening();
      });

      // Manually trigger onend
      if (mockInstance.onend) {
        mockInstance.onend({} as Event);
      }

      expect(onStatusChange).toHaveBeenCalledWith('idle');
    });
  });

  describe('onError callback', () => {
    it('should call onError with appropriate message for no-speech error', async () => {
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useSpeechToText({ onError })
      );

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      // Simulate error
      if (mockInstance.onerror) {
        mockInstance.onerror({ error: 'no-speech', message: '' });
      }

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('未检测到语音');
      });
    });
  });

  describe('configuration options', () => {
    it('should apply custom language option', async () => {
      renderHook(() => useSpeechToText({ lang: 'en-US' }));

      await waitFor(() => {
        expect(mockInstance.lang).toBe('en-US');
      });
    });

    it('should apply custom continuous option', async () => {
      renderHook(() => useSpeechToText({ continuous: true }));

      await waitFor(() => {
        expect(mockInstance.continuous).toBe(true);
      });
    });

    it('should apply custom interimResults option', async () => {
      renderHook(() => useSpeechToText({ interimResults: false }));

      await waitFor(() => {
        expect(mockInstance.interimResults).toBe(false);
      });
    });

    it('should apply custom maxAlternatives option', async () => {
      renderHook(() => useSpeechToText({ maxAlternatives: 3 }));

      await waitFor(() => {
        expect(mockInstance.maxAlternatives).toBe(3);
      });
    });
  });

  describe('transcript handling', () => {
    it('should accumulate final transcripts', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      // Simulate multiple final results
      if (mockInstance.onresult) {
        mockInstance.onresult({
          results: [{ isFinal: true, 0: { transcript: 'Hello ' } }],
          resultIndex: 0,
        });
      }

      if (mockInstance.onresult) {
        mockInstance.onresult({
          results: [{ isFinal: true, 0: { transcript: 'world' } }],
          resultIndex: 0,
        });
      }

      await waitFor(() => {
        expect(result.current.transcript).toContain('Hello ');
        expect(result.current.transcript).toContain('world');
      });
    });

    it('should handle interim transcripts', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startListening();
      });

      // Simulate interim result
      if (mockInstance.onresult) {
        mockInstance.onresult({
          results: [{ isFinal: false, 0: { transcript: 'Thinking...' } }],
          resultIndex: 0,
        });
      }

      await waitFor(() => {
        expect(result.current.interimTranscript).toBe('Thinking...');
      });
    });
  });
});
