/**
 * Message Queue Domain - Use Cases (Application Layer)
 *
 * Application services that orchestrate the message queue workflow:
 * - QueueMessageUseCase: enqueue a new message for offline delivery
 * - RetryPendingMessagesUseCase: process and retry all eligible messages
 * - GetMessageQueueStatusUseCase: query queue state for UI display
 */

import type { PendingMessage, RetryPolicy } from './entities';
import {
  createPendingMessage,
  markMessageSent,
  markMessageFailed,
  markMessageSending,
  DEFAULT_RETRY_POLICY,
  canRetry,
} from './entities';
import type { PendingMessageRepository } from './repository';

/** Input for queuing a new message */
export interface QueueMessageInput {
  id: string;
  conversationId: string;
  text: string;
  messageType?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'mixed';
  mediaUri?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaMetadata?: Record<string, unknown>;
}

/** Send function interface - abstracts the actual sending mechanism */
export type MessageSendFn = (params: {
  conversationId: string;
  text: string;
  messageType: string;
  mediaUri?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaMetadata?: Record<string, unknown>;
}) => Promise<string>;

/** Result of queuing a message */
export interface QueueMessageResult {
  message: PendingMessage;
  /** Whether the message was sent immediately (online) or queued (offline) */
  sentImmediately: boolean;
}

/** Status summary of the message queue for UI display */
export interface MessageQueueStatus {
  pendingCount: number;
  failedCount: number;
  sendingCount: number;
  /** Messages that failed all retries and need manual intervention */
  permanentlyFailed: PendingMessage[];
}

/**
 * Use Case: Queue a message for offline-safe delivery.
 * If online, sends immediately. If offline, persists to queue.
 */
export class QueueMessageUseCase {
  constructor(
    private repository: PendingMessageRepository,
    private sendFn: MessageSendFn,
    private retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {}

  async execute(input: QueueMessageInput): Promise<QueueMessageResult> {
    const pendingMessage = createPendingMessage({
      id: input.id,
      conversationId: input.conversationId,
      text: input.text,
      messageType: input.messageType,
      mediaUri: input.mediaUri,
      mediaType: input.mediaType,
      mediaSize: input.mediaSize,
      mediaMetadata: input.mediaMetadata,
    });

    // Try to send immediately
    try {
      const sendingMsg = markMessageSending(pendingMessage);
      await this.repository.save(sendingMsg);

      const serverMessageId = await this.sendFn({
        conversationId: input.conversationId,
        text: input.text,
        messageType: input.messageType ?? 'text',
        mediaUri: input.mediaUri,
        mediaType: input.mediaType,
        mediaSize: input.mediaSize,
        mediaMetadata: input.mediaMetadata,
      });

      const sentMsg = markMessageSent(sendingMsg, serverMessageId);
      await this.repository.save(sentMsg);

      return { message: sentMsg, sentImmediately: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const failedMsg = markMessageFailed(pendingMessage, errorMsg, this.retryPolicy);
      await this.repository.save(failedMsg);

      return { message: failedMsg, sentImmediately: false };
    }
  }
}

/**
 * Use Case: Retry all eligible pending messages.
 * Processes messages one by one with exponential backoff.
 */
export class RetryPendingMessagesUseCase {
  constructor(
    private repository: PendingMessageRepository,
    private sendFn: MessageSendFn,
    private retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {}

  async execute(): Promise<{ retried: number; succeeded: number; failed: number }> {
    const messages = await this.repository.findRetryable();
    let succeeded = 0;
    let failed = 0;

    for (const msg of messages) {
      if (!canRetry(msg, this.retryPolicy)) continue;

      try {
        const sendingMsg = markMessageSending(msg);
        await this.repository.save(sendingMsg);

        const serverMessageId = await this.sendFn({
          conversationId: msg.conversationId,
          text: msg.text,
          messageType: msg.messageType,
          mediaUri: msg.mediaUri,
          mediaType: msg.mediaType,
          mediaSize: msg.mediaSize,
          mediaMetadata: msg.mediaMetadata,
        });

        const sentMsg = markMessageSent(sendingMsg, serverMessageId);
        await this.repository.save(sentMsg);
        succeeded++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const failedMsg = markMessageFailed(msg, errorMsg, this.retryPolicy);
        await this.repository.save(failedMsg);
        failed++;
      }
    }

    return { retried: messages.length, succeeded, failed };
  }
}

/**
 * Use Case: Get the current status of the message queue.
 * Used by UI to show offline indicators and failed message badges.
 */
export class GetMessageQueueStatusUseCase {
  constructor(private repository: PendingMessageRepository) {}

  async execute(): Promise<MessageQueueStatus> {
    const pendingCount = await this.repository.countPending();
    const sendingMessages = await this.repository.findByStatus('sending');
    const failedMessages = await this.repository.findByStatus('failed');

    return {
      pendingCount,
      failedCount: failedMessages.length,
      sendingCount: sendingMessages.length,
      permanentlyFailed: failedMessages,
    };
  }
}

/**
 * Use Case: Clear the message queue (e.g., on logout).
 */
export class ClearMessageQueueUseCase {
  constructor(private repository: PendingMessageRepository) {}

  async execute(): Promise<void> {
    const pending = await this.repository.findByStatus('pending');
    const failed = await this.repository.findByStatus('failed');
    const sending = await this.repository.findByStatus('sending');

    for (const msg of [...pending, ...failed, ...sending]) {
      await this.repository.delete(msg.id);
    }
  }
}
