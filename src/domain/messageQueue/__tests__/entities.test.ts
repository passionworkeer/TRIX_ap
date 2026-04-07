import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPendingMessage,
  markMessageSent,
  markMessageFailed,
  markMessageSending,
  calculateNextRetryDelay,
  canRetry,
  DEFAULT_RETRY_POLICY,
} from '../entities';
import type { PendingMessage } from '../entities';

describe('Message Queue Domain - Entities', () => {
  describe('createPendingMessage', () => {
    it('creates a pending message with default values', () => {
      const msg = createPendingMessage({
        id: 'msg-1',
        conversationId: 'conv-abc',
        text: 'Hello',
      });

      expect(msg.id).toBe('msg-1');
      expect(msg.conversationId).toBe('conv-abc');
      expect(msg.text).toBe('Hello');
      expect(msg.messageType).toBe('text');
      expect(msg.status).toBe('pending');
      expect(msg.retryCount).toBe(0);
      expect(msg.createdAt).toBeDefined();
      expect(msg.lastAttemptAt).toBeUndefined();
      expect(msg.nextRetryAt).toBeUndefined();
      expect(msg.lastError).toBeUndefined();
      expect(msg.serverMessageId).toBeUndefined();
    });

    it('creates a media message with optional fields', () => {
      const msg = createPendingMessage({
        id: 'msg-2',
        conversationId: 'conv-abc',
        text: 'Check this out',
        messageType: 'image',
        mediaUri: 'https://example.com/img.png',
        mediaType: 'image/png',
        mediaSize: 1024,
        mediaMetadata: { width: 800, height: 600 },
      });

      expect(msg.messageType).toBe('image');
      expect(msg.mediaUri).toBe('https://example.com/img.png');
      expect(msg.mediaType).toBe('image/png');
      expect(msg.mediaSize).toBe(1024);
      expect(msg.mediaMetadata).toEqual({ width: 800, height: 600 });
    });
  });

  describe('markMessageSent', () => {
    it('marks message as sent with server ID', () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' });
      const sent = markMessageSent(msg, 'server-123');

      expect(sent.status).toBe('sent');
      expect(sent.serverMessageId).toBe('server-123');
      expect(sent.lastAttemptAt).toBeDefined();
    });
  });

  describe('markMessageSending', () => {
    it('marks message as sending', () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' });
      const sending = markMessageSending(msg);

      expect(sending.status).toBe('sending');
      expect(sending.lastAttemptAt).toBeDefined();
    });
  });

  describe('markMessageFailed', () => {
    it('marks message as failed and schedules next retry', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' });
      const failed = markMessageFailed(msg, 'Network error', DEFAULT_RETRY_POLICY);

      expect(failed.status).toBe('pending'); // still retryable
      expect(failed.retryCount).toBe(1);
      expect(failed.lastError).toBe('Network error');
      expect(failed.lastAttemptAt).toBe('2026-01-01T00:00:00.000Z');
      expect(failed.nextRetryAt).toBeDefined();

      vi.useRealTimers();
    });

    it('marks as permanently failed after max retries', () => {
      const msg: PendingMessage = {
        ...createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' }),
        retryCount: 4,
      };

      const failed = markMessageFailed(msg, 'Final error', DEFAULT_RETRY_POLICY);

      expect(failed.status).toBe('failed');
      expect(failed.retryCount).toBe(5);
      expect(failed.nextRetryAt).toBeUndefined();
    });
  });

  describe('calculateNextRetryDelay', () => {
    it('calculates exponential backoff with jitter', () => {
      const policy: typeof DEFAULT_RETRY_POLICY = {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      };

      // First retry: ~1000ms ± 250ms
      const delay1 = calculateNextRetryDelay(policy, 0);
      expect(delay1).toBeGreaterThanOrEqual(750);
      expect(delay1).toBeLessThanOrEqual(1250);

      // Second retry: ~2000ms ± 500ms
      const delay2 = calculateNextRetryDelay(policy, 1);
      expect(delay2).toBeGreaterThanOrEqual(1500);
      expect(delay2).toBeLessThanOrEqual(2500);

      // Third retry: ~4000ms ± 1000ms
      const delay3 = calculateNextRetryDelay(policy, 2);
      expect(delay3).toBeGreaterThanOrEqual(3000);
      expect(delay3).toBeLessThanOrEqual(5000);
    });

    it('caps delay at maxDelayMs', () => {
      const policy: typeof DEFAULT_RETRY_POLICY = {
        maxRetries: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
      };

      // 2^10 * 1000 = 1024000, should cap at 5000 ± 1250
      const delay = calculateNextRetryDelay(policy, 10);
      expect(delay).toBeGreaterThanOrEqual(3750);
      expect(delay).toBeLessThanOrEqual(6250);
    });
  });

  describe('canRetry', () => {
    it('returns true for pending message within retry limits', () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' });
      expect(canRetry(msg, DEFAULT_RETRY_POLICY)).toBe(true);
    });

    it('returns false for sent message', () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' });
      const sent = markMessageSent(msg, 'srv-1');
      expect(canRetry(sent, DEFAULT_RETRY_POLICY)).toBe(false);
    });

    it('returns false when retry count exceeds max', () => {
      const msg: PendingMessage = {
        ...createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' }),
        retryCount: 5,
      };
      expect(canRetry(msg, DEFAULT_RETRY_POLICY)).toBe(false);
    });

    it('returns false when nextRetryAt is in the future', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      const msg: PendingMessage = {
        ...createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' }),
        nextRetryAt: future,
      };
      expect(canRetry(msg, DEFAULT_RETRY_POLICY)).toBe(false);
    });

    it('returns true when nextRetryAt has passed', () => {
      const past = new Date(Date.now() - 1000).toISOString();
      const msg: PendingMessage = {
        ...createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' }),
        nextRetryAt: past,
      };
      expect(canRetry(msg, DEFAULT_RETRY_POLICY)).toBe(true);
    });
  });
});
