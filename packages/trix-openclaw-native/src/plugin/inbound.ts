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

// 防止重复启动的 Map
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

export async function startInboundMonitor(
  gatewayContext: Record<string, unknown>,
  account: ResolvedPluginAccount
): Promise<void> {
  const log = (gatewayContext.log as LogSink | undefined) ?? {};

  // 验证配置
  if (!account.serverUrl) {
    log.error?.(`[trix] account ${account.accountId} has NO serverUrl configured!`);
    throw new Error(`TRIX Native account ${account.accountId}: serverUrl is required`);
  }
  if (!account.adminToken) {
    log.error?.(`[trix] account ${account.accountId} has NO adminToken configured!`);
    throw new Error(`TRIX Native account ${account.accountId}: adminToken is required`);
  }
  log.info?.(`[trix] Starting inbound monitor for ${account.accountId} -> ${account.serverUrl}`);

  // 防止重复启动 - 但即使已在运行也清理后重新启动
  const key = account.accountId;
  if (activeMonitors.get(key)) {
    log.warn?.(`[trix] stale monitor key found for ${key}, clearing and restarting`);
    activeMonitors.delete(key);
    // 继续往下走，重新建连
  }
  activeMonitors.set(key, true);

  const abortSignal = gatewayContext.abortSignal as AbortSignal | undefined;
  const wsBase = account.serverUrl.replace(/^http/i, 'ws').replace(/\/$/, '');
  const wsUrl = `${wsBase}/ws?role=agent&adminToken=${encodeURIComponent(
    account.adminToken ?? ''
  )}&accountId=${encodeURIComponent(account.accountId)}`;
  log.info?.(`[trix] Connecting to WebSocket: ${wsUrl.substring(0, 80)}...`);

  // 清理函数
  const cleanup = () => {
    activeMonitors.delete(key);
  };

  abortSignal?.addEventListener('abort', () => {
    cleanup();
  });

  // stopped = true 时不再重连，也不处理任何消息
  let stopped = false;
  // 当前活跃的 socket，用于 abort 时主动关闭
  let currentSocket: WebSocket | null = null;

  // abort 信号：标记停止，关闭当前 socket
  abortSignal?.addEventListener('abort', () => {
    stopped = true;
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  });

  async function connect(): Promise<void> {
    if (stopped) return;

    const socket = new WebSocket(wsUrl);
    currentSocket = socket;

    // 消息处理
    socket.on('message', async (data) => {
      if (stopped) return;
      try {
        const envelope = JSON.parse(data.toString()) as ClientEnvelope<{
          message?: MessageRecord;
        }>;
        if (envelope.type !== 'message.created' || !envelope.payload.message) return;
        if (envelope.payload.message.direction !== 'inbound') return;
        await dispatchInboundMessage({
          gatewayContext,
          account,
          message: envelope.payload.message,
        });
      } catch (error) {
        log.error?.(`TRIX Native inbound dispatch failed: ${String(error)}`);
      }
    });

    // 关闭处理：code 1000 是主动关闭，不重连
    // 其他 code 是异常断开，5 秒后重连一次
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

    // 运行时错误只记录，不抛出（避免崩溃 gateway）
    socket.on('error', (err) => {
      log.error?.(`TRIX Native websocket error (${account.accountId}): ${String(err)}`);
    });

    // 等待初始连接建立
    // 用互相清理的方式避免 open/error 竞争条件
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
      socket.once('open', () => {
        onOpen();
        // 每 30 秒发一次心跳，防止服务器超时断开
        const heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.ping();
          } else {
            clearInterval(heartbeat);
          }
        }, 30000);
        socket.once('close', () => clearInterval(heartbeat));
      });
      socket.once('error', onError);
    });
  }

  // 首次连接失败直接抛出，让 gateway 知道启动失败
  try {
    await connect();
    log.info?.(`[trix] Inbound monitor started successfully for ${account.accountId}`);
  } catch (err) {
    log.error?.(`[trix] Inbound monitor failed to start for ${account.accountId}: ${String(err)}`);
    activeMonitors.delete(key);
    throw err;
  }
}
