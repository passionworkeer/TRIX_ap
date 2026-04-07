/**
 * Message Queue Domain - Barrel Export
 */

export type { PendingMessage, MessageSendStatus, RetryPolicy } from './entities';
export {
  createPendingMessage,
  calculateNextRetryDelay,
  canRetry,
  markMessageSent,
  markMessageFailed,
  markMessageSending,
  DEFAULT_RETRY_POLICY,
} from './entities';

export type { PendingMessageRepository } from './repository';

export type {
  QueueMessageInput,
  QueueMessageResult,
  MessageQueueStatus,
  MessageSendFn,
} from './useCases';
export {
  QueueMessageUseCase,
  RetryPendingMessagesUseCase,
  GetMessageQueueStatusUseCase,
  ClearMessageQueueUseCase,
} from './useCases';
