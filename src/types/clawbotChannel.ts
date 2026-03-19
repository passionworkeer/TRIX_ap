export interface ClawbotChannelAttachment {
  id?: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ClawbotChannelMessage {
  id?: string;
  content: string;
  contentType: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice';
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
    [key: string]: unknown;
  };
  attachments?: ClawbotChannelAttachment[];
  metadata?: Record<string, unknown>;
  timestamp: number;
  sender: 'user' | 'bot';
}

export interface ErrorPayload {
  code?: string;
  message: string;
}
