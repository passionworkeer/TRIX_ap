/**
 * Message Queue Domain - DDD Entities & Value Objects
 *
 * Defines the core domain model for the offline message queue:
 * - PendingMessage: entity representing a message awaiting delivery
 * - MessageSendStatus: value object for message lifecycle states
 * - RetryPolicy: value object for retry configuration
 */

/** Message send status in the offline queue lifecycle */
export type MessageSendStatus = 'pending' | 'sending' | 'sent' | 'failed';

/** Retry policy configuration for message delivery */
export interface RetryPolicy {
  maxRetries: number;
  /** Base delay in ms for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay cap in ms */
  maxDelayMs: number;
}

/** Default retry policy: 5 retries, exponential backoff from 1s to 30s */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/** Pending message entity - represents a message awaiting delivery */
export interface PendingMessage {
  /** Unique identifier for this queued message */
  id: string;
  /** Target conversation or friend ID */
  conversationId: string;
  /** Message text content */
  text: string;
  /** Optional media URI (image, voice, file) */
  mediaUri?: string;
  /** Optional media type (image, video, audio, file) */
  mediaType?: string;
  /** Optional media size in bytes */
  mediaSize?: number;
  /** Optional media metadata */
  mediaMetadata?: Record<string, unknown>;
  /** Message type: text | image | video | file | voice | mixed */
  messageType: 'text' | 'image' | 'video' | 'file' | 'voice' | 'mixed';
  /** Current delivery status */
  status: MessageSendStatus;
  /** Number of send attempts */
  retryCount: number;
  /** Last error message from failed attempt */
  lastError?: string;
  /** When the message was first queued */
  createdAt: string;
  /** When the last send attempt was made */
  lastAttemptAt?: string;
  /** When the next retry should occur */
  nextRetryAt?: string;
  /** Server-assigned message ID after successful send */
  serverMessageId?: string;
}

/** Create a new pending message with default values */
export function createPendingMessage(input: {
  id: string;
  conversationId: string;
  text: string;
  messageType?: 'text' | 'image' | 'video' | 'file' | 'voice' | 'mixed';
  mediaUri?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaMetadata?: Record<string, unknown>;
}): PendingMessage {
  const now = new Date().toISOString();
  return {
    id: input.id,
    conversationId: input.conversationId,
    text: input.text,
    mediaUri: input.mediaUri,
    mediaType: input.mediaType,
    mediaSize: input.mediaSize,
    mediaMetadata: input.mediaMetadata,
    messageType: input.messageType ?? 'text',
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    lastAttemptAt: undefined,
    nextRetryAt: undefined,
    lastError: undefined,
    serverMessageId: undefined,
  };
}

/** Calculate the next retry delay using exponential backoff with jitter */
export function calculateNextRetryDelay(policy: RetryPolicy, retryCount: number): number {
  const exponentialDelay = policy.baseDelayMs * Math.pow(2, retryCount);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
  // Add jitter: ±25% random variation to avoid thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}

/** Check if a message is eligible for retry based on policy */
export function canRetry(message: PendingMessage, policy: RetryPolicy): boolean {
  if (message.status === 'sent') return false;
  if (message.retryCount >= policy.maxRetries) return false;

  if (message.nextRetryAt) {
    const now = new Date().getTime();
    const nextRetry = new Date(message.nextRetryAt).getTime();
    if (now < nextRetry) return false;
  }

  return true;
}

/** Mark a pending message as sent with server-assigned ID */
export function markMessageSent(message: PendingMessage, serverMessageId: string): PendingMessage {
  return {
    ...message,
    status: 'sent',
    serverMessageId,
    lastAttemptAt: new Date().toISOString(),
  };
}

/** Mark a pending message as failed with error info and schedule next retry */
export function markMessageFailed(message: PendingMessage, error: string, policy: RetryPolicy): PendingMessage {
  const newRetryCount = message.retryCount + 1;
  const delayMs = calculateNextRetryDelay(policy, newRetryCount);
  const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

  return {
    ...message,
    status: newRetryCount >= policy.maxRetries ? 'failed' : 'pending',
    retryCount: newRetryCount,
    lastError: error,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: newRetryCount >= policy.maxRetries ? undefined : nextRetryAt,
  };
}

/** Mark a pending message as currently being sent */
export function markMessageSending(message: PendingMessage): PendingMessage {
  return {
    ...message,
    status: 'sending',
    lastAttemptAt: new Date().toISOString(),
  };
}
