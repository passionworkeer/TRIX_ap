/**
 * Clawbot History Service
 *
 * Manages chat history with Clawbot (AI assistant) using localStorage.
 * Provides functions to load, save, and delete messages with automatic
 * normalization and validation.
 */

/**
 * Storage key prefix for Clawbot history
 */
const CLAWBOT_HISTORY_STORAGE_KEY_PREFIX = 'trix_clawbot_history';

/**
 * Maximum number of messages to keep in history
 */
const CLAWBOT_HISTORY_MAX_MESSAGES = 500;

/**
 * Represents a single message in Clawbot chat history
 */
export interface ClawbotHistoryMessage {
  /** Unique message identifier */
  id: string;
  /** Text content of the message */
  content: string;
  /** Type of content (text, image, video, file, or mixed) */
  contentType: 'text' | 'image' | 'video' | 'file' | 'mixed';
  /** URL for media attachments (optional) */
  mediaUrl?: string;
  /** MIME type of media attachment (optional) */
  mediaMimeType?: string;
  /** Attachment metadata (optional) */
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
    [key: string]: unknown;
  };
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Who sent the message */
  sender: 'user' | 'bot';
}

/**
 * Resolves the localStorage key for a user's Clawbot history
 * @param userId - The user's unique identifier
 * @returns The full storage key
 */
function resolveClawbotHistoryStorageKey(userId: string): string {
  return `${CLAWBOT_HISTORY_STORAGE_KEY_PREFIX}:${userId}`;
}

/**
 * Validates and normalizes a raw message object
 * @param raw - The raw message data to normalize
 * @returns Normalized message or null if invalid
 */
function normalizeClawbotHistoryMessage(raw: unknown): ClawbotHistoryMessage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const content = typeof obj.content === 'string' ? obj.content : '';
  const contentType = obj.contentType;
  const sender = obj.sender;
  const timestamp = Number(obj.timestamp);

  // Validate required fields
  if (!id || !Number.isFinite(timestamp)) {
    return null;
  }
  if (!['text', 'image', 'video', 'file', 'mixed'].includes(contentType as string)) {
    return null;
  }
  if (sender !== 'user' && sender !== 'bot') {
    return null;
  }

  return {
    id,
    content,
    contentType: contentType as 'text' | 'image' | 'video' | 'file' | 'mixed',
    mediaUrl: typeof obj.mediaUrl === 'string' ? obj.mediaUrl : undefined,
    mediaMimeType:
      typeof obj.mediaMimeType === 'string'
        ? obj.mediaMimeType
        : typeof obj.media_mime_type === 'string'
          ? obj.media_mime_type
          : undefined,
    mediaMetadata:
      obj.mediaMetadata && typeof obj.mediaMetadata === 'object'
        ? (obj.mediaMetadata as ClawbotHistoryMessage['mediaMetadata'])
        : obj.media_metadata && typeof obj.media_metadata === 'object'
          ? (obj.media_metadata as ClawbotHistoryMessage['mediaMetadata'])
          : {
              originalName:
                typeof obj.attachmentName === 'string'
                  ? obj.attachmentName
                  : typeof obj.attachment_name === 'string'
                    ? obj.attachment_name
                    : undefined,
              size:
                typeof obj.attachmentSize === 'number'
                  ? obj.attachmentSize
                  : typeof obj.attachment_size === 'number'
                    ? obj.attachment_size
                    : undefined,
            },
    timestamp,
    sender: sender as 'user' | 'bot',
  };
}

/**
 * Loads the Clawbot message history for a specific user
 * @param userId - The user's unique identifier
 * @returns Array of normalized messages sorted by timestamp
 */
export async function loadClawbotMessageHistory(userId: string): Promise<ClawbotHistoryMessage[]> {
  try {
    if (!userId) {
      return [];
    }

    const storageKey = resolveClawbotHistoryStorageKey(userId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeClawbotHistoryMessage)
      .filter((item): item is ClawbotHistoryMessage => item !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('加载 Clawbot 历史消息失败:', error);
    return [];
  }
}

/**
 * Saves a message to the Clawbot history
 * Automatically enforces the maximum message limit
 * @param userId - The user's unique identifier
 * @param message - The message to save
 */
export async function saveClawbotMessage(
  userId: string,
  message: ClawbotHistoryMessage
): Promise<void> {
  try {
    if (!userId) {
      return;
    }

    const normalized = normalizeClawbotHistoryMessage(message);
    if (!normalized) {
      return;
    }

    const storageKey = resolveClawbotHistoryStorageKey(userId);
    const existingMessages = await loadClawbotMessageHistory(userId);
    const withoutCurrent = existingMessages.filter((item) => item.id !== normalized.id);
    const merged = [...withoutCurrent, normalized]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-CLAWBOT_HISTORY_MAX_MESSAGES);

    localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch (error) {
    console.error('保存 Clawbot 消息失败:', error);
  }
}

/**
 * Deletes a specific message from the Clawbot history
 * @param userId - The user's unique identifier
 * @param messageId - The message ID to delete
 */
export async function deleteClawbotMessage(userId: string, messageId: string): Promise<void> {
  try {
    if (!userId || !messageId) {
      return;
    }

    const storageKey = resolveClawbotHistoryStorageKey(userId);
    const existingMessages = await loadClawbotMessageHistory(userId);
    const nextMessages = existingMessages.filter((message) => message.id !== messageId);
    localStorage.setItem(storageKey, JSON.stringify(nextMessages));
  } catch (error) {
    console.error('删除 Clawbot 消息失败:', error);
  }
}
