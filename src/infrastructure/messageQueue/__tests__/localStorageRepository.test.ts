import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageMessageQueueRepository } from '../../infrastructure/messageQueue/localStorageRepository';
import { createPendingMessage, DEFAULT_RETRY_POLICY, markMessageSent } from '../../domain/messageQueue/entities';

describe('Message Queue Infrastructure - LocalStorageRepository', () => {
  let repo: LocalStorageMessageQueueRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageMessageQueueRepository();
  });

  describe('save and findById', () => {
    it('saves and retrieves a message', async () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv-abc', text: 'Hello' });
      await repo.save(msg);

      const found = await repo.findById('msg-1');
      expect(found).not.toBeNull();
      expect(found!.text).toBe('Hello');
      expect(found!.conversationId).toBe('conv-abc');
    });

    it('updates an existing message', async () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv-abc', text: 'Hello' });
      await repo.save(msg);

      const updated = { ...msg, text: 'Updated' };
      await repo.save(updated);

      const found = await repo.findById('msg-1');
      expect(found!.text).toBe('Updated');
    });

    it('returns null for non-existent message', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByConversationId', () => {
    it('returns only messages for the given conversation', async () => {
      await repo.save(createPendingMessage({ id: 'msg-1', conversationId: 'conv-a', text: 'A1' }));
      await repo.save(createPendingMessage({ id: 'msg-2', conversationId: 'conv-a', text: 'A2' }));
      await repo.save(createPendingMessage({ id: 'msg-3', conversationId: 'conv-b', text: 'B1' }));

      const results = await repo.findByConversationId('conv-a');
      expect(results).toHaveLength(2);
      expect(results.map((m) => m.id)).toContain('msg-1');
      expect(results.map((m) => m.id)).toContain('msg-2');
    });

    it('excludes sent messages', async () => {
      const msg = createPendingMessage({ id: 'msg-1', conversationId: 'conv-a', text: 'A1' });
      const sent = markMessageSent(msg, 'srv-1');
      await repo.save(sent);
      await repo.save(createPendingMessage({ id: 'msg-2', conversationId: 'conv-a', text: 'A2' }));

      const results = await repo.findByConversationId('conv-a');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-2');
    });
  });

  describe('findRetryable', () => {
    it('returns pending and failed messages within retry limits', async () => {
      await repo.save(createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Pending' }));
      const failed = createPendingMessage({ id: 'msg-2', conversationId: 'conv', text: 'Failed' });
      await repo.save({ ...failed, status: 'failed', retryCount: 2 });
      const sent = markMessageSent(createPendingMessage({ id: 'msg-3', conversationId: 'conv', text: 'Sent' }), 'srv');
      await repo.save(sent);

      const results = await repo.findRetryable();
      expect(results).toHaveLength(2);
    });
  });

  describe('findByStatus', () => {
    it('returns messages matching the status', async () => {
      await repo.save(createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'A' }));
      await repo.save(createPendingMessage({ id: 'msg-2', conversationId: 'conv', text: 'B' }));
      const failed = createPendingMessage({ id: 'msg-3', conversationId: 'conv', text: 'C' });
      await repo.save({ ...failed, status: 'failed' });

      const pending = await repo.findByStatus('pending');
      expect(pending).toHaveLength(2);

      const failedResults = await repo.findByStatus('failed');
      expect(failedResults).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('removes a message', async () => {
      await repo.save(createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Hi' }));
      await repo.delete('msg-1');

      const found = await repo.findById('msg-1');
      expect(found).toBeNull();
    });
  });

  describe('cleanupSent', () => {
    it('removes old sent messages', async () => {
      const oldSent = markMessageSent(createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Old' }), 'srv-1');
      const oldSentWithTime = { ...oldSent, lastAttemptAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() };
      await repo.save(oldSentWithTime);

      const recentSent = markMessageSent(createPendingMessage({ id: 'msg-2', conversationId: 'conv', text: 'New' }), 'srv-2');
      await repo.save(recentSent);

      await repo.save(createPendingMessage({ id: 'msg-3', conversationId: 'conv', text: 'Pending' }));

      const removed = await repo.cleanupSent();
      expect(removed).toBe(1);

      const remaining = await repo.findById('msg-1');
      expect(remaining).toBeNull();
    });
  });

  describe('countPending', () => {
    it('counts non-sent messages', async () => {
      await repo.save(createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'A' }));
      await repo.save(createPendingMessage({ id: 'msg-2', conversationId: 'conv', text: 'B' }));
      const sent = markMessageSent(createPendingMessage({ id: 'msg-3', conversationId: 'conv', text: 'C' }), 'srv');
      await repo.save(sent);

      const count = await repo.countPending();
      expect(count).toBe(2);
    });
  });

  describe('persistence across instances', () => {
    it('persists data between repository instances', async () => {
      const repo1 = new LocalStorageMessageQueueRepository();
      await repo1.save(createPendingMessage({ id: 'msg-1', conversationId: 'conv', text: 'Persisted' }));

      const repo2 = new LocalStorageMessageQueueRepository();
      const found = await repo2.findById('msg-1');
      expect(found).not.toBeNull();
      expect(found!.text).toBe('Persisted');
    });
  });
});
