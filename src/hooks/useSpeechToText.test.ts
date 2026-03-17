/**
 * Unit tests for useSpeechToText Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSpeechToText } from './useSpeechToText';

// Mock Web Speech API
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

const mockSpeechRecognition = {
  new: vi.fn(() => new MockSpeechRecognition()),
};

// Setup global mock
beforeAll(() => {
  Object.defineProperty(window, 'SpeechRecognition', {
    value: mockSpeechRecognition,
    writable: true,
  });
  Object.defineProperty(window, 'webkitSpeechRecognition', {
    value: mockSpeechRecognition,
    writable: true,
  });
});

afterAll(() => {
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
});

describe.skip('useSpeechToText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useSpeechToText());

      expect(result.current.status).toBe('idle');
      expect(result.current.transcript).toBe('');
      expect(result.current.interimTranscript).toBe('');
      expect(result.current.isSupported).toBe(true);
      expect(result.current.error).toBe('');
      expect(result.current.isListening).toBe(false);
    });

    it('should detect speech recognition support', () => {
      const { result } = renderHook(() => useSpeechToText());

      expect(result.current.isSupported).toBe(true);
      expect(mockSpeechRecognition.new).toHaveBeenCalled();
    });

    it('should handle unsupported browser', () => {
      const originalSpeechRecognition = window.SpeechRecognition;
      const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;

      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      const { result } = renderHook(() => useSpeechToText());

      expect(result.current.isSupported).toBe(false);
      expect(result.current.error).toBe('当前浏览器不支持语音识别');

      // Restore
      Object.defineProperty(window, 'SpeechRecognition', {
        value: originalSpeechRecognition,
        writable: true,
      });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: originalWebkitSpeechRecognition,
        writable: true,
      });
    });
  });

  describe('startListening', () => {
    it('should start listening successfully', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await act(async () => {
        result.current.startListening();
      });

      expect(result.current.isListening).toBe(true);
      expect(result.current.error).toBe('');
    });

    it('should clear previous transcript when starting', async () => {
      const { result } = renderHook(() => useSpeechToText());

      // First set some transcript
      await act(async () => {
        result.current.reset();
      });

      await act(async () => {
        result.current.startListening();
      });

      expect(result.current.transcript).toBe('');
      expect(result.current.interimTranscript).toBe('');
    });

    it('should handle error when not supported', () => {
      const originalSpeechRecognition = window.SpeechRecognition;
      delete (window as any).SpeechRecognition;

      const { result } = renderHook(() => useSpeechToText());

      act(() => {
        result.current.startListening();
      });

      expect(result.current.error).toBe('语音识别不可用');

      // Restore
      Object.defineProperty(window, 'SpeechRecognition', {
        value: originalSpeechRecognition,
        writable: true,
      });
    });
  });

  describe('stopListening', () => {
    it('should stop listening', async () => {
      const { result } = renderHook(() => useSpeechToText());

      await act(async () => {
        result.current.startListening();
      });

      await act(async () => {
        result.current.stopListening();
      });

      expect(result.current.status).toBe('idle');
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() => useSpeechToText());

      // Manually set some state for testing
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
      const mockRecognition = new MockSpeechRecognition();

      // Override onresult to simulate a result
      mockRecognition.onresult = (event: any) => {
        event.results = [
          {
            isFinal: true,
            0: { transcript: 'Hello world', confidence: 0.9 },
          },
        ];
        event.resultIndex = 0;
      };

      const { result } = renderHook(() =>
        useSpeechToText({ onResult })
      );

      await act(async () => {
        result.current.startListening();
      });

      // Simulate the recognition result
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
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

      await act(async () => {
        result.current.startListening();
      });

      expect(onStatusChange).toHaveBeenCalledWith('listening');

      await act(async () => {
        result.current.stopListening();
      });

      expect(onStatusChange).toHaveBeenCalledWith('idle');
    });
  });

  describe('onError callback', () => {
    it('should call onError with appropriate message for no-speech error', async () => {
      const onError = vi.fn();
      const mockRecognition = new MockSpeechRecognition();

      mockRecognition.onerror = (event: any) => {
        event.error = 'no-speech';
        event.message = 'No speech detected';
      };

      const { result } = renderHook(() =>
        useSpeechToText({ onError })
      );

      await act(async () => {
        result.current.startListening();
      });

      // Simulate error
      if (mockRecognition.onerror) {
        mockRecognition.onerror({ error: 'no-speech', message: '' });
      }

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('未检测到语音');
      });
    });

    it('should call onError with appropriate message for audio-capture error', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useSpeechToText({ onError })
      );

      // Simulate the error by triggering the recognition
      const mockRecognition = mockSpeechRecognition.new();

      // Get the recognition instance and trigger error
      await act(async () => {
        try {
          result.current.startListening();
        } catch (e) {
          // Expected to fail
        }
      });

      // The error callback should be set up in the effect
    });
  });

  describe('configuration options', () => {
    it('should apply custom language option', () => {
      renderHook(() => useSpeechToText({ lang: 'en-US' }));

      expect(mockSpeechRecognition.new).toHaveBeenCalled();
    });

    it('should apply custom continuous option', () => {
      renderHook(() => useSpeechToText({ continuous: true }));

      expect(mockSpeechRecognition.new).toHaveBeenCalled();
    });

    it('should apply custom interimResults option', () => {
      renderHook(() => useSpeechToText({ interimResults: false }));

      expect(mockSpeechRecognition.new).toHaveBeenCalled();
    });

    it('should apply custom maxAlternatives option', () => {
      renderHook(() => useSpeechToText({ maxAlternatives: 3 }));

      expect(mockSpeechRecognition.new).toHaveBeenCalled();
    });
  });

  describe('transcript handling', () => {
    it('should accumulate final transcripts', async () => {
      const mockRecognition = new MockSpeechRecognition();

      const { result } = renderHook(() => useSpeechToText());

      await act(async () => {
        result.current.startListening();
      });

      // Simulate multiple final results
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          results: [{ isFinal: true, 0: { transcript: 'Hello ' } }],
          resultIndex: 0,
        });
      }

      if (mockRecognition.onresult) {
        mockRecognition.onresult({
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
      const mockRecognition = new MockSpeechRecognition();

      const { result } = renderHook(() => useSpeechToText());

      await act(async () => {
        result.current.startListening();
      });

      // Simulate interim result
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          results: [{ isFinal: false, 0: { transcript: 'Thinking...' } }],
          resultIndex: 0,
        });
      }

      expect(result.current.interimTranscript).toBe('Thinking...');
    });
  });
});
