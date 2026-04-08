/**
 * Message Queue Service
 *
 * Provides offline-safe message sending with automatic retry.
 * Integrates the domain message queue use cases into the application layer.
 */

import {
  QueueMessageUseCase,
  RetryPendingMessagesUseCase,
  GetMessageQueueStatusUseCase,
  ClearMessageQueueUseCase,
  type QueueMessageInput,
  type MessageQueueStatus,
} from '../domain/messageQueue';
import { localStorageMessageQueue } from '../infrastructure/messageQueue/localStorageRepository';
import { createSupabaseMessageSendFn, createNativeChannelSendFn } from '../infrastructure/messageQueue/chatAdapter';
import { logger } from '../utils/logger';

/** Chat type for routing messages */
export type ChatType = 'supabase' | 'native';

interface MessageQueueServiceConfig {
  /** Auto-retry interval in ms (default: 30 seconds) */
  autoRetryInterval?: number;
  /** Maximum concurrent retries (default: 5) */
  maxConcurrentRetries?: number;
}

interface NativeChannelMessageClient {
  isConnected: () => boolean;
  sendMessage: (params: {
    text: string;
    contentType?: string;
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaMetadata?: Record<string, unknown>;
  }) => Promise<string>;
}

class MessageQueueServiceImpl {
  private supabaseQueueUseCase: QueueMessageUseCase;
  private supabaseRetryUseCase: RetryPendingMessagesUseCase;
  private supabaseStatusUseCase: GetMessageQueueStatusUseCase;
  private supabaseClearUseCase: ClearMessageQueueUseCase;

  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners = new Set<(status: MessageQueueStatus) => void>();

  constructor() {
    const sendFn = createSupabaseMessageSendFn();

    this.supabaseQueueUseCase = new QueueMessageUseCase(
      localStorageMessageQueue,
      sendFn,
    );
    this.supabaseRetryUseCase = new RetryPendingMessagesUseCase(
      localStorageMessageQueue,
      sendFn,
    );
    this.supabaseStatusUseCase = new GetMessageQueueStatusUseCase(
      localStorageMessageQueue,
    );
    this.supabaseClearUseCase = new ClearMessageQueueUseCase(
      localStorageMessageQueue,
    );

    this.setupOnlineListener();
  }

  private setupOnlineListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      logger.chat.info('MessageQueue: Back online, retrying pending messages');
      this.isOnline = true;
      void this.retryPending();
    });

    window.addEventListener('offline', () => {
      logger.chat.info('MessageQueue: Gone offline');
      this.isOnline = false;
    });
  }

  /**
   * Start auto-retry timer.
   * Call this when the app becomes active.
   */
  startAutoRetry(config: MessageQueueServiceConfig = {}): void {
    const interval = config.autoRetryInterval ?? 30000;

    this.stopAutoRetry();

    this.retryTimer = setInterval(() => {
      if (this.isOnline) {
        void this.retryPending();
      }
    }, interval);

    // Also retry immediately when starting
    void this.retryPending();
  }

  /**
   * Stop auto-retry timer.
   * Call this when the app goes to background.
   */
  stopAutoRetry(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Queue a message for sending via Supabase (friend chat).
   * If online, sends immediately. If offline, queues for later retry.
   *
   * @returns The queued message with its status
   */
  async queueMessage(input: QueueMessageInput): Promise<{ sentImmediately: boolean; messageId: string }> {
    if (!this.isOnline) {
      logger.chat.info('MessageQueue: Offline, queuing message', { id: input.id });
    }

    const result = await this.supabaseQueueUseCase.execute(input);

    // Notify listeners
    void this.notifyStatusChange();

    return {
      sentImmediately: result.sentImmediately,
      messageId: result.message.id,
    };
  }

  /**
   * Queue a message for sending via TrixNativeChannel (AI companion chat).
   *
   * @param input - Message to queue
   * @param channelClient - The native channel client instance
   */
  async queueNativeChannelMessage(
    input: QueueMessageInput,
    channelClient: NativeChannelMessageClient,
  ): Promise<{ sentImmediately: boolean; messageId: string }> {
    const sendFn = createNativeChannelSendFn(channelClient);
    const queueUseCase = new QueueMessageUseCase(localStorageMessageQueue, sendFn);

    if (!this.isOnline || !channelClient.isConnected()) {
      logger.chat.info('MessageQueue: Offline or not connected, queuing message', { id: input.id });
    }

    const result = await queueUseCase.execute(input);
    void this.notifyStatusChange();

    return {
      sentImmediately: result.sentImmediately,
      messageId: result.message.id,
    };
  }

  /**
   * Retry all pending messages.
   * Called automatically by the auto-retry timer.
   */
  async retryPending(): Promise<{ retried: number; succeeded: number; failed: number }> {
    if (!this.isOnline) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    const result = await this.supabaseRetryUseCase.execute();
    logger.chat.info('MessageQueue: Retry completed', result);

    // Notify listeners
    void this.notifyStatusChange();

    return result;
  }

  /**
   * Get the current queue status.
   */
  async getStatus(): Promise<MessageQueueStatus> {
    return this.supabaseStatusUseCase.execute();
  }

  /**
   * Clear all queued messages (e.g., on logout).
   */
  async clearQueue(): Promise<void> {
    await this.supabaseClearUseCase.execute();
    void this.notifyStatusChange();
  }

  /**
   * Subscribe to queue status changes.
   */
  subscribe(listener: (status: MessageQueueStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Check if there are pending messages.
   */
  async hasPendingMessages(): Promise<boolean> {
    const status = await this.getStatus();
    return status.pendingCount > 0 || status.sendingCount > 0;
  }

  private async notifyStatusChange(): Promise<void> {
    const status = await this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (error) {
        logger.chat.error('MessageQueue: Listener error', error);
      }
    }
  }
}

/** Singleton instance */
export const messageQueueService = new MessageQueueServiceImpl();
