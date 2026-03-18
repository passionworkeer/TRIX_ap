import { AttachmentStore } from '../attachments/AttachmentStore.js';
import type { OutboundReplyPayloadLike, ResolvedPluginAccount } from '../types.js';

function buildResult(channel: string, ok: boolean, messageId?: string, error?: unknown) {
  return {
    channel,
    ok,
    messageId: messageId ?? '',
    error: error instanceof Error ? error : error ? new Error(String(error)) : undefined,
  };
}

async function postJson<T>(account: ResolvedPluginAccount, pathname: string, payload: unknown): Promise<T> {
  const serviceToken = (account as unknown as Record<string, unknown>).serviceToken as string | undefined
    ?? account.adminToken;
  const response = await fetch(`${account.serverUrl.replace(/\/$/, '')}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${serviceToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Server request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export function createOutboundAdapter() {
  return {
    deliveryMode: 'direct' as const,
    sendText: async (ctx: { cfg: Record<string, unknown>; to: string; text: string; accountId?: string | null }) => {
      try {
        const { resolveAccount } = await import('./accounts.js');
        const account = resolveAccount(ctx.cfg, ctx.accountId ?? undefined);
        const response = await postJson<{ message: { id: string } }>(account, '/api/messages/service/messages', {
          conversationId: ctx.to,
          direction: 'outbound',
          text: ctx.text,
          senderId: `openclaw:${account.accountId}`,
          senderName: account.name,
        });
        return buildResult('trix-native', true, response.message.id);
      } catch (error) {
        return buildResult('trix-native', false, undefined, error);
      }
    },
    sendMedia: async (ctx: {
      cfg: Record<string, unknown>;
      to: string;
      text: string;
      mediaUrl?: string;
      accountId?: string | null;
    }) => {
      try {
        if (!ctx.mediaUrl) {
          return buildResult('trix-native', true, '');
        }
        const { resolveAccount } = await import('./accounts.js');
        const account = resolveAccount(ctx.cfg, ctx.accountId ?? undefined);
        const store = new AttachmentStore(account.storageDir);
        await store.ensure();
        const attachment = await store.loadReplyMedia(ctx.mediaUrl);
        const payload = {
          conversationId: ctx.to,
          direction: 'outbound',
          text: ctx.text,
          senderId: `openclaw:${account.accountId}`,
          senderName: account.name,
          attachments: [
            {
              kind: attachment.kind,
              mimeType: attachment.mimeType,
              fileName: attachment.fileName,
              contentBase64: (await store.readAttachment(attachment)).contentBase64,
            },
          ],
        };
        const response = await postJson<{ message: { id: string } }>(account, '/api/messages/service/messages', payload);
        return buildResult('trix-native', true, response.message.id);
      } catch (error) {
        return buildResult('trix-native', false, undefined, error);
      }
    },
    sendPayload: async (ctx: {
      cfg: Record<string, unknown>;
      to: string;
      payload: OutboundReplyPayloadLike;
      accountId?: string | null;
      text: string;
    }) => {
      const mediaUrls = ctx.payload.mediaUrls?.length
        ? ctx.payload.mediaUrls
        : ctx.payload.mediaUrl
          ? [ctx.payload.mediaUrl]
          : [];

      let lastResult = buildResult('trix-native', true, '');
      const adapter = createOutboundAdapter();

      if (ctx.payload.text?.trim() && mediaUrls.length === 0) {
        lastResult = await adapter.sendText({
          cfg: ctx.cfg,
          to: ctx.to,
          text: ctx.payload.text,
          accountId: ctx.accountId,
        });
      }

      for (const mediaUrl of mediaUrls) {
        lastResult = await adapter.sendMedia({
          cfg: ctx.cfg,
          to: ctx.to,
          text: mediaUrl === mediaUrls[0] ? (ctx.payload.text ?? '') : '',
          mediaUrl,
          accountId: ctx.accountId,
        });
      }

      return lastResult;
    },
  };
}
