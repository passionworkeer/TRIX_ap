/**
 * Message Queue Infrastructure - LocalStorage Repository
 *
 * Implements the PendingMessageRepository port using localStorage.
 * This is the adapter that persists pending messages between sessions.
 */

import type { PendingMessage, PendingMessageRepository } from '../../domain/messageQueue';

const STORAGE_KEY = 'trix_message_queue';
const SENT_CLEANUP_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Raw storage format - array of serialized messages */
interface StoragePayload {
  messages: PendingMessage[];
  version: 1;
}

export class LocalStorageMessageQueueRepository implements PendingMessageRepository {
  private messages: PendingMessage[] = [];
  private initialized = false;

  private load(): void {
    if (this.initialized) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const payload: StoragePayload = JSON.parse(raw);
        this.messages = payload.messages ?? [];
      }
    } catch {
      this.messages = [];
    }
    this.initialized = true;
  }

  private persist(): void {
    try {
      const payload: StoragePayload = { messages: this.messages, version: 1 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded - cleanup sent messages and retry once
      this.messages = this.messages.filter((m) => m.status !== 'sent');
      try {
        const payload: StoragePayload = { messages: this.messages, version: 1 };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Still failing - silently drop, messages will be lost
      }
    }
  }

  async save(message: PendingMessage): Promise<void> {
    this.load();
    const index = this.messages.findIndex((m) => m.id === message.id);
    if (index >= 0) {
      this.messages[index] = message;
    } else {
      this.messages.push(message);
    }
    this.persist();
  }

  async findById(id: string): Promise<PendingMessage | null> {
    this.load();
    return this.messages.find((m) => m.id === id) ?? null;
  }

  async findByConversationId(conversationId: string): Promise<PendingMessage[]> {
    this.load();
    return this.messages.filter(
      (m) => m.conversationId === conversationId && m.status !== 'sent',
    );
  }

  async findRetryable(): Promise<PendingMessage[]> {
    this.load();
    return this.messages.filter(
      (m) =>
        (m.status === 'pending' || m.status === 'failed') &&
        m.retryCount < 5, // hard cap
    );
  }

  async findByStatus(status: PendingMessage['status']): Promise<PendingMessage[]> {
    this.load();
    return this.messages.filter((m) => m.status === status);
  }

  async delete(id: string): Promise<void> {
    this.load();
    this.messages = this.messages.filter((m) => m.id !== id);
    this.persist();
  }

  async cleanupSent(maxAgeMs?: number): Promise<number> {
    this.load();
    const ageMs = maxAgeMs ?? SENT_CLEANUP_AGE_MS;
    const cutoff = Date.now() - ageMs;
    const before = this.messages.length;
    this.messages = this.messages.filter((m) => {
      if (m.status !== 'sent') return true;
      const sentAt = m.lastAttemptAt ? new Date(m.lastAttemptAt).getTime() : 0;
      return sentAt > cutoff;
    });
    const removed = before - this.messages.length;
    if (removed > 0) this.persist();
    return removed;
  }

  async countPending(): Promise<number> {
    this.load();
    return this.messages.filter((m) => m.status !== 'sent').length;
  }
}

/** Singleton instance */
export const localStorageMessageQueue = new LocalStorageMessageQueueRepository();
