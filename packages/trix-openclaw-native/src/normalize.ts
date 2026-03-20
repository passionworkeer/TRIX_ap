export type TrixInboundAttachment = {
  id: string;
  kind?: string;
  mimeType?: string;
  fileName?: string;
  url?: string;
  sizeBytes?: number;
};

export type TrixInboundEvent = {
  type: 'message.created';
  payload: {
    accountId?: string;
    conversationId: string;
    chatType?: 'direct' | 'channel';
    peer: {
      id: string;
      displayName?: string;
    };
    message: {
      id: string;
      text?: string;
      replyToMessageId?: string | null;
      attachments?: TrixInboundAttachment[];
      timestamp?: number;
    };
  };
};

export type NormalizedTrixInboundEvent = {
  accountId: string;
  conversationId: string;
  chatType: 'direct' | 'channel';
  peerId: string;
  peerDisplayName?: string;
  message: {
    id: string;
    text: string;
    replyToMessageId?: string | null;
    attachments: TrixInboundAttachment[];
    timestamp: number;
  };
};

export function normalizeInboundEvent(input: unknown): NormalizedTrixInboundEvent | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const event = input as Partial<TrixInboundEvent>;
  if (event.type !== 'message.created') {
    return null;
  }

  const payload = event.payload;
  const peer = payload?.peer;
  const message = payload?.message;
  if (!payload?.conversationId || !peer?.id || !message?.id) {
    return null;
  }

  return {
    accountId: payload.accountId ?? 'default',
    conversationId: payload.conversationId,
    chatType: payload.chatType ?? 'direct',
    peerId: peer.id,
    peerDisplayName: peer.displayName,
    message: {
      id: message.id,
      text: message.text ?? '',
      replyToMessageId: message.replyToMessageId ?? null,
      attachments: message.attachments ?? [],
      timestamp: message.timestamp ?? Date.now(),
    },
  };
}

export function summarizeInboundAttachments(attachments: TrixInboundAttachment[]): string {
  if (attachments.length === 0) {
    return '';
  }
  return attachments
    .map((attachment) => {
      const label = `[${String(attachment.kind ?? 'file').toUpperCase()}: ${attachment.fileName ?? attachment.id}]`;
      return attachment.url ? `${label} ${attachment.url}` : label;
    })
    .join('\n');
}
