/**
 * Message Queue Domain - Repository Interface
 *
 * Defines the port (interface) for the pending message repository.
 * Infrastructure layer will implement this for localStorage persistence.
 */

import type { PendingMessage } from './entities';

/** Repository interface for pending message persistence */
export interface PendingMessageRepository {
  /** Save or update a pending message */
  save(message: PendingMessage): Promise<void>;

  /** Get a single pending message by ID */
  findById(id: string): Promise<PendingMessage | null>;

  /** Get all pending messages for a conversation */
  findByConversationId(conversationId: string): Promise<PendingMessage[]>;

  /** Get all messages that are eligible for retry */
  findRetryable(): Promise<PendingMessage[]>;

  /** Get all messages with a specific status */
  findByStatus(status: PendingMessage['status']): Promise<PendingMessage[]>;

  /** Delete a message from the queue */
  delete(id: string): Promise<void>;

  /** Delete all sent messages (cleanup) */
  cleanupSent(maxAgeMs?: number): Promise<number>;

  /** Get total count of pending/sending messages */
  countPending(): Promise<number>;
}
