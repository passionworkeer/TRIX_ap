import WebSocket from 'ws';
import { AttachmentStore } from '../attachments/AttachmentStore.js';
import type {
  AttachmentDescriptor,
  ClientEnvelope,
  MessageRecord,
  OutboundReplyPayloadLike,
  ResolvedPluginAccount,
} from '../types.js';
import { resolveOpenClawCompat } from './sdk.js';

type LogSink = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

function normalizeMediaList(attachments: AttachmentDescriptor[]): Array<{ path: string; contentType?: string }> {
  return attachments.map((entry) => ({
    path: entry.storagePath,
    contentType: entry.mimeType,
  }));
}

function buildAttachmentSummary(attachments: AttachmentDescriptor[]): string {
  if (attachments.length === 0) {
    return '';
  }

  return attachments.map((entry) => `[${entry.kind.toUpperCase()}: ${entry.fileName}]`).join('\n');
}

async function postReply(account: ResolvedPluginAccount, conversationId: string, payload: OutboundReplyPayloadLike): Promise<void> {
  const store = new AttachmentStore(account.storageDir);
  await store.ensure();

  const mediaUrls = payload.mediaUrls?.length ? payload.mediaUrls : payload.mediaUrl ? [payload.mediaUrl] : [];
  const attachments = [] as Array<{ kind?: string; mimeType: string; fileName: string; contentBase64: string }>;

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

  await fetch(`${account.serverUrl.replace(/\/$/, '')}/api/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-trix-admin-token': account.adminToken ?? '',
    },
    body: JSON.stringify({
      conversationId,
      direction: 'outbound',
      text: payload.text ?? '',
      senderId: `openclaw:${account.accountId}`,
      senderName: account.name,
      attachments,
      metadata: payload.replyToId ? { replyToId: payload.replyToId } : undefined,
    }),
  });
}

async function dispatchInboundMessage(params: {
  gatewayContext: Record<string, unknown>;
  account: ResolvedPluginAccount;
  message: MessageRecord;
}): Promise<void> {
  const { gatewayContext, account, message } = params;
  const log = (gatewayContext.log as LogSink | undefined) ?? {};
  const channelRuntime = gatewayContext.channelRuntime as Record<string, unknown> | undefined;
  if (!channelRuntime) {
    log.warn?.('channelRuntime unavailable, skipping inbound message dispatch');
    return;
  }

  const routing = channelRuntime.routing as Record<string, (...args: unknown[]) => unknown>;
  const reply = channelRuntime.reply as Record<string, (...args: unknown[]) => unknown>;
  const compat = await resolveOpenClawCompat();
  const buildAgentMediaPayload = compat.buildAgentMediaPayload as ((media: Array<{ path: string; contentType?: string }>) => Record<string, unknown>);

  const route = routing.resolveAgentRoute?.({
    cfg: gatewayContext.cfg,
    channel: 'trix-native',
    accountId: account.accountId,
    peer: {
      kind: 'direct',
      id: message.conversationId,
    },
  }) as { sessionKey: string; agentId: string; accountId?: string } | undefined;

  if (!route) {
    log.warn?.(`Failed to resolve route for conversation ${message.conversationId}`);
    return;
  }

  const mediaPayload = buildAgentMediaPayload(normalizeMediaList(message.attachments));
  const attachmentSummary = buildAttachmentSummary(message.attachments);
  const rawBody = [message.text, attachmentSummary].filter(Boolean).join('\n\n').trim();
  const finalized = (reply.finalizeInboundContext as (input: Record<string, unknown>) => Record<string, unknown>)({
    ...mediaPayload,
    Body: rawBody,
    BodyForAgent: rawBody,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `trix-native:${message.senderId}`,
    To: `conversation:${message.conversationId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId ?? account.accountId,
    ChatType: 'direct',
    SenderId: message.senderId,
    SenderName: message.senderName ?? message.senderId,
    Provider: 'trix-native',
    Surface: 'trix-native',
    MessageSid: message.id,
    Timestamp: message.createdAt,
    OriginatingChannel: 'trix-native',
    OriginatingTo: message.conversationId,
    WasMentioned: false,
  });

  await (reply.dispatchReplyWithBufferedBlockDispatcher as (params: Record<string, unknown>) => Promise<void>)({
    ctx: finalized,
    cfg: gatewayContext.cfg,
    dispatcherOptions: {
      deliver: async (payload: OutboundReplyPayloadLike) => {
        await postReply(account, message.conversationId, payload);
      },
      onError: (error: unknown, info: { kind?: string }) => {
        log.error?.(`TRIX Native ${info.kind ?? 'reply'} failed: ${String(error)}`);
      },
    },
    replyOptions: {},
  });
}

export async function startInboundMonitor(gatewayContext: Record<string, unknown>, account: ResolvedPluginAccount): Promise<void> {
  const log = (gatewayContext.log as LogSink | undefined) ?? {};
  const wsBase = account.serverUrl.replace(/^http/i, 'ws').replace(/\/$/, '');
  const wsUrl = `${wsBase}/ws?role=agent&adminToken=${encodeURIComponent(account.adminToken ?? '')}&accountId=${encodeURIComponent(account.accountId)}`;
  const socket = new WebSocket(wsUrl);
  const abortSignal = gatewayContext.abortSignal as AbortSignal | undefined;

  abortSignal?.addEventListener('abort', () => {
    socket.close(1000, 'plugin stop');
  });

  socket.on('message', async (data) => {
    try {
      const envelope = JSON.parse(data.toString()) as ClientEnvelope<{ message?: MessageRecord }>;
      if (envelope.type !== 'message.created' || !envelope.payload.message) {
        return;
      }
      if (envelope.payload.message.direction !== 'inbound') {
        return;
      }
      await dispatchInboundMessage({
        gatewayContext,
        account,
        message: envelope.payload.message,
      });
    } catch (error) {
      log.error?.(`TRIX Native inbound dispatch failed: ${String(error)}`);
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => {
      log.info?.(`TRIX Native agent websocket connected (${account.accountId})`);
      resolve();
    });
    socket.once('error', (error) => {
      reject(error);
    });
  });
}
