import { randomUUID } from 'node:crypto';
import { AttachmentStore } from './attachments/AttachmentStore.js';
import { parseTrixTarget } from './bindings.js';
import { resolveTrixAccount } from './account.js';
import { fetchWithTimeout } from './http.js';
import type { OutboundReplyPayloadLike, ResolvedPluginAccount } from './types.js';

const SERVICE_POST_MAX_ATTEMPTS = 3;
const SERVICE_POST_RETRY_BASE_DELAY_MS = 400;

function buildResult(channel: string, ok: boolean, messageId?: string, error?: unknown) {
  return {
    channel,
    ok,
    messageId: messageId ?? '',
    error: error instanceof Error ? error : error ? new Error(String(error)) : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientServicePostError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const networkCode = (error as Error & { cause?: { code?: string }; code?: string }).cause?.code
    ?? (error as Error & { code?: string }).code;
  if (typeof networkCode === 'string' && [
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ETIMEDOUT',
    'UND_ERR_CONNECT_TIMEOUT',
    'UND_ERR_HEADERS_TIMEOUT',
    'UND_ERR_SOCKET',
  ].includes(networkCode)) {
    return true;
  }

  return /fetch failed|timed out|network/i.test(error.message);
}

async function resolveConversationId(params: {
  account: ResolvedPluginAccount;
  to?: string;
  conversationId?: string;
}): Promise<string> {
  if (params.conversationId) {
    return params.conversationId;
  }

  if (!params.to) {
    throw new Error('Missing outbound target');
  }

  const target = parseTrixTarget(params.to);
  if (!target) {
    return params.to;
  }
  if (target.kind === 'conversation') {
    return target.conversationId;
  }

  const response = await fetchWithTimeout(
    `${params.account.serviceUrl.replace(/\/$/, '')}/api/service/conversations/by-peer/${encodeURIComponent(target.peerId)}?accountId=${encodeURIComponent(params.account.accountId)}`,
    {
      headers: {
        authorization: `Bearer ${params.account.serviceToken ?? ''}`,
      },
    },
    8_000,
  );
  if (!response.ok) {
    throw new Error(`Failed to resolve conversation for ${target.peerId}: ${response.status}`);
  }
  const payload = await response.json() as { conversation?: { id?: string } };
  if (!payload.conversation?.id) {
    throw new Error(`No active conversation for peer ${target.peerId}`);
  }
  return payload.conversation.id;
}

async function postServiceMessage(params: {
  account: ResolvedPluginAccount;
  conversationId: string;
  text?: string;
  replyToMessageId?: string | null;
  attachments?: Array<{
    kind?: string;
    mimeType: string;
    fileName: string;
    contentBase64: string;
  }>;
  idempotencyKey?: string;
}) {
  const idempotencyKey = params.idempotencyKey ?? randomUUID();
  let lastError: unknown;

  for (let attempt = 1; attempt <= SERVICE_POST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${params.account.serviceUrl.replace(/\/$/, '')}/api/service/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${params.account.serviceToken ?? ''}`,
        },
        body: JSON.stringify({
          accountId: params.account.accountId,
          conversationId: params.conversationId,
          message: {
            idempotencyKey,
            text: params.text ?? '',
            replyToMessageId: params.replyToMessageId ?? null,
            attachments: params.attachments ?? [],
          },
        }),
      }, 15_000);

      if (!response.ok) {
        if (attempt < SERVICE_POST_MAX_ATTEMPTS && response.status >= 500) {
          lastError = new Error(`Service request failed: ${response.status} ${response.statusText}`);
          await sleep(SERVICE_POST_RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
        throw new Error(`Service request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as { message: { id: string } };
    } catch (error) {
      lastError = error;
      if (attempt >= SERVICE_POST_MAX_ATTEMPTS || !isTransientServicePostError(error)) {
        throw error;
      }
      await sleep(SERVICE_POST_RETRY_BASE_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Service request failed');
}

async function resolvePayloadAttachments(params: {
  account: ResolvedPluginAccount;
  payload: OutboundReplyPayloadLike;
}): Promise<Array<{
  kind?: string;
  mimeType: string;
  fileName: string;
  contentBase64: string;
}>> {
  const mediaUrls = params.payload.mediaUrls?.length
    ? params.payload.mediaUrls
    : params.payload.mediaUrl
      ? [params.payload.mediaUrl]
      : [];

  if (mediaUrls.length === 0) {
    return [];
  }

  const store = new AttachmentStore(params.account.storageDir);
  await store.ensure();

  const attachments = [] as Array<{
    kind?: string;
    mimeType: string;
    fileName: string;
    contentBase64: string;
  }>;

  for (const mediaUrl of mediaUrls) {
    const attachment = await store.loadReplyMedia(mediaUrl);
    const persisted = await store.readAttachment(attachment);
    attachments.push({
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      contentBase64: persisted.contentBase64,
    });
  }

  return attachments;
}

export async function sendPayloadTrix(params: {
  cfg: Record<string, unknown>;
  accountId?: string | null;
  to?: string;
  conversationId?: string;
  payload: OutboundReplyPayloadLike;
}) {
  const account = resolveTrixAccount({ cfg: params.cfg, accountId: params.accountId ?? undefined });
  const conversationId = await resolveConversationId({
    account,
    to: params.to,
    conversationId: params.conversationId,
  });
  const attachments = await resolvePayloadAttachments({
    account,
    payload: params.payload,
  });
  const response = await postServiceMessage({
    account,
    conversationId,
    text: params.payload.text ?? '',
    replyToMessageId: params.payload.replyToId ?? null,
    attachments,
  });
  return buildResult('trix-native', true, response.message.id);
}

export const trixOutbound = {
  deliveryMode: 'direct' as const,
  textChunkLimit: 4000,
  sendText: async (ctx: { cfg: Record<string, unknown>; to: string; text: string; accountId?: string | null }) => {
    try {
      return await sendPayloadTrix({
        cfg: ctx.cfg,
        accountId: ctx.accountId,
        to: ctx.to,
        payload: { text: ctx.text },
      });
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
      return await sendPayloadTrix({
        cfg: ctx.cfg,
        accountId: ctx.accountId,
        to: ctx.to,
        payload: {
          text: ctx.text,
          mediaUrl: ctx.mediaUrl,
        },
      });
    } catch (error) {
      return buildResult('trix-native', false, undefined, error);
    }
  },
  sendPayload: async (ctx: {
    cfg: Record<string, unknown>;
    to: string;
    payload: OutboundReplyPayloadLike;
    accountId?: string | null;
  }) => {
    try {
      return await sendPayloadTrix({
        cfg: ctx.cfg,
        accountId: ctx.accountId,
        to: ctx.to,
        payload: ctx.payload,
      });
    } catch (error) {
      return buildResult('trix-native', false, undefined, error);
    }
  },
};
