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

// 追踪活跃的 inbound monitors
const activeMonitors = new Map<string, boolean>();

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
  console.log(`[trix-native] POST REPLY to conv=${conversationId} text="${payload.text?.slice(0, 50)}"`);
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

  const serviceToken = (account as unknown as Record<string, unknown>).serviceToken as string | undefined
    ?? account.adminToken;

  await fetch(`${account.serverUrl.replace(/\/$/, '')}/api/messages/service/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${serviceToken}`,
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
    console.log(`[trix-native] NO ROUTE for conv=${message.conversationId}`);
    return;
  }
  console.log(`[trix-native] Route resolved: agent=${route.agentId} session=${route.sessionKey}`);

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

export async function startInboundMonitor(
  gatewayContext: Record<string, unknown>,
  account: ResolvedPluginAccount
): Promise<void> {
  const key = account.accountId;
  const log = (gatewayContext.log as LogSink | undefined) ?? {};
  const abortSignal = gatewayContext.abortSignal as AbortSignal | undefined;

  // 检查是否已经有活跃的 monitor
  if (activeMonitors.get(key)) {
    log.warn?.(`Inbound monitor already running for ${key}, skipping`);
    // 返回一个永不就结的 promise，让 gateway 等待 abort
    return new Promise<void>(() => {});
  }
  activeMonitors.set(key, true);

  const serviceToken = (account as unknown as Record<string, unknown>).serviceToken as string | undefined
    ?? account.adminToken;

  const wsBase = account.serverUrl.replace(/^http/i, 'ws').replace(/\/$/, '');
  const wsUrl = `${wsBase}/ws?role=agent`
    + `&accountId=${encodeURIComponent(account.accountId)}`
    + `&serviceToken=${encodeURIComponent(serviceToken ?? '')}`;

  // stopped = true 时不再重连，也不处理任何消息
  let stopped = false;
  // 当前活跃的 socket，用于 abort 时主动关闭
  let currentSocket: WebSocket | null = null;
  // 追踪最后处理的消息 ID，避免重复处理
  let lastProcessedMessageId: string | null = null;

  // abort 信号：标记停止，关闭当前 socket，并清理 Map
  abortSignal?.addEventListener('abort', () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
    log.info?.(`[trix-native] Inbound monitor aborted for ${key}`);
  }, { once: true });

  async function connect(): Promise<void> {
    if (stopped) return;

    const socket = new WebSocket(wsUrl);
    currentSocket = socket;

    socket.on('message', async (data) => {
      if (stopped) return;
      try {
        const envelope = JSON.parse(data.toString()) as ClientEnvelope<{
          message?: MessageRecord;
        }>;
        if (envelope.type !== 'message.created' || !envelope.payload.message) return;

        const message = envelope.payload.message;

        // Only accept inbound (phone -> agent) messages
        if (message.direction !== 'inbound') return;

        // 避免重复处理
        if (message.id === lastProcessedMessageId) return;
        lastProcessedMessageId = message.id;

        console.log(`[trix-native] WS received msg ${message.id} dir=${message.direction} conv=${message.conversationId}`);
        await dispatchInboundMessage({
          gatewayContext,
          account,
          message,
        });
      } catch (error) {
        log.error?.(`TRIX Native inbound dispatch failed: ${String(error)}`);
      }
    });

    socket.on('close', (code) => {
      if (currentSocket === socket) currentSocket = null;
      if (stopped || code === 1000) {
        log.info?.(`TRIX Native websocket closed normally (${account.accountId})`);
        return;
      }
      log.warn?.(
        `TRIX Native websocket closed unexpectedly (code=${code}), ` +
        `reconnecting in 5s... (${account.accountId})`
      );
      setTimeout(() => {
        connect().catch((err) => {
          log.error?.(`TRIX Native reconnect failed: ${String(err)}`);
        });
      }, 5000);
    });

    socket.on('error', (err) => {
      log.error?.(`TRIX Native websocket error (${account.accountId}): ${String(err)}`);
    });

    await new Promise<void>((resolve, reject) => {
      function onOpen() {
        socket.removeListener('error', onError);
        log.info?.(`TRIX Native agent websocket connected (${account.accountId})`);
        resolve();
      }
      function onError(err: Error) {
        socket.removeListener('open', onOpen);
        currentSocket = null;
        reject(err);
      }
      socket.once('open', onOpen);
      socket.once('error', onError);
    });
  }

  // 首次连接失败直接抛出，让 gateway 知道启动失败
  await connect();

  // 返回 promise 直到 abortSignal 触发 → gateway framework 会跟踪此 promise
  return new Promise<void>((resolve) => {
    abortSignal?.addEventListener('abort', () => {
      stopped = true;
      activeMonitors.delete(key);
      currentSocket?.close(1000, 'plugin stop');
      currentSocket = null;
      log.info?.(`[trix-native] Inbound monitor aborted for ${key}`);
      resolve();
    }, { once: true });
  });
}
