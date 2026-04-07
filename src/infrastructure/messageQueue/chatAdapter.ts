/**
 * Message Queue Infrastructure - Chat Service Adapter
 *
 * Bridges the domain use cases with the actual Supabase chat service.
 * Provides the MessageSendFn implementation.
 */

import * as chatService from '../../services/chatService';
import type { MessageSendFn } from '../../domain/messageQueue';

/**
 * Create a MessageSendFn that delegates to the Supabase chat service.
 * This adapter translates domain parameters to the chat service API.
 */
export function createSupabaseMessageSendFn(): MessageSendFn {
  return async (params) => {
    const { conversationId, text, messageType, mediaUri, mediaType, mediaSize, mediaMetadata } = params;

    // Extract friendId from conversationId (format: "userId_friendId" or "friendId_userId")
    // We need the friendId for the chatService API
    const parts = conversationId.split('_');
    const friendId = parts.length >= 2 ? (parts[1] as string) : conversationId;

    if (messageType !== 'text' && mediaUri) {
      const resolvedMediaType = mediaType || 'application/octet-stream';
      const resolvedMediaSize = mediaSize || 0;
      const category = resolvedMediaType.startsWith('image/') ? 'image' : resolvedMediaType.startsWith('video/') ? 'video' : resolvedMediaType.startsWith('audio/') ? 'audio' : 'file';

      const result = await chatService.sendMessageWithMedia(
        friendId,
        'user',
        text,
        {
          uri: mediaUri,
          type: resolvedMediaType,
          size: resolvedMediaSize,
          category: category as 'image' | 'video' | 'audio' | 'file',
          metadata: mediaMetadata,
        },
        messageType as 'image' | 'video' | 'file' | 'mixed' | 'voice',
      );

      if (!result) {
        throw new Error('发送媒体消息失败');
      }
      return result;
    }

    const result = await chatService.sendMessage(friendId, 'user', text);
    if (!result) {
      throw new Error('发送消息失败');
    }
    return result;
  };
}

/**
 * Create a MessageSendFn for the TrixNativeChannel (WebSocket-based).
 * Used for the AI companion chat, not friend chat.
 */
export function createNativeChannelSendFn(client: {
  sendMessage: (params: {
    text: string;
    contentType?: string;
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaMetadata?: Record<string, unknown>;
  }) => Promise<string>;
}): MessageSendFn {
  return async (params) => {
    const result = await client.sendMessage({
      text: params.text,
      contentType: params.messageType,
      mediaUrl: params.mediaUri,
      mediaMimeType: params.mediaType,
      mediaMetadata: params.mediaMetadata,
    });
    return result;
  };
}
