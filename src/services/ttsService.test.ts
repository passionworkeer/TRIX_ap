/**
 * Unit tests for TTS service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock clawbotEndpoints
vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn(() => ({
    nativeServerUrl: 'http://test-native:8788',
    nativePublicUrl: 'https://chat.example.com',
  })),
}));

vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'test-access-token',
          },
        },
      })),
    },
  },
}));

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    DEV: true,
    PROD: false,
    VITE_TTS_PROXY_URL: '',
  },
});

describe('ttsService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    (window as Window & { __PROD_UPLOAD_URL__?: string }).__PROD_UPLOAD_URL__ = '';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as Window & { __PROD_UPLOAD_URL__?: string }).__PROD_UPLOAD_URL__;
  });

  describe('synthesizeSpeech', () => {
    it('should make POST request to /api/tts/synthesize', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Dynamic import to use mocked modules
      const { synthesizeSpeech } = await import('../../src/services/ttsService');

      const result = await synthesizeSpeech('Hello', 'bot_reply');

      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(String(url)).toContain('/api/tts/synthesize');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers.authorization).toBe('Bearer test-access-token');

      const body = JSON.parse(options.body);
      expect(body.text).toBe('Hello');
      expect(body.scene).toBe('bot_reply');

      expect(result).toBeInstanceOf(Blob);
    });

    it('should pass messageId in request body', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { synthesizeSpeech } = await import('../../src/services/ttsService');

      await synthesizeSpeech('Hello', 'bot_reply', 'msg-123');

      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(options.body);
      expect(body.messageId).toBe('msg-123');
    });

    it('omits authorization header when no authenticated session exists', async () => {
      const { supabase } = await import('../../src/config/supabase');
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: {
          session: null,
        },
      } as Awaited<ReturnType<typeof supabase.auth.getSession>>);

      const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { synthesizeSpeech } = await import('../../src/services/ttsService');
      await synthesizeSpeech('Hello', 'bot_reply');

      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.headers.authorization).toBeUndefined();
    });

    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { synthesizeSpeech } = await import('../../src/services/ttsService');

      await expect(synthesizeSpeech('Hello', 'bot_reply'))
        .rejects.toThrow();
    });

    it('should throw error on empty audio blob', async () => {
      const emptyBlob = new Blob([], { type: 'audio/mpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(emptyBlob),
      });

      const { synthesizeSpeech } = await import('../../src/services/ttsService');

      await expect(synthesizeSpeech('Hello', 'bot_reply'))
        .rejects.toThrow('empty TTS audio blob');
    });

    it('should support AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const { synthesizeSpeech } = await import('../../src/services/ttsService');

      await expect(synthesizeSpeech('Hello', 'bot_reply', undefined, controller.signal))
        .rejects.toThrow();
    });

    it('should fallback to next URL on certain errors in dev mode', async () => {
      // First attempt returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      // Second attempt succeeds
      const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const { synthesizeSpeech } = await import('../../src/services/ttsService');

      const result = await synthesizeSpeech('Hello', 'bot_reply');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toBeInstanceOf(Blob);
    });
  });
});
