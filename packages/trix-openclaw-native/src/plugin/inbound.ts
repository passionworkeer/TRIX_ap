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

export async function startInboundMonitor(
  gatewayContext: Record<string, unknown>,
  account: ResolvedPluginAccount
): Promise<void> {
  const log = (gatewayContext.log as LogSink | undefined) ?? {};
  const abortSignal = gatewayContext.abortSignal as AbortSignal | undefined;
  const wsBase = account.serverUrl.replace(/^http/i, 'ws').replace(/\/$/, '');
  const wsUrl = `${wsBase}/ws?role=agent&adminToken=${encodeURIComponent(
    account.adminToken ?? ''
  )}&accountId=${encodeURIComponent(account.accountId)}`;

  // stopped = true 时不再重连，也不处理任何消息
  let stopped = false;
  // 当前活跃的 socket，用于 abort 时主动关闭
  let currentSocket: WebSocket | null = null;

  // 追踪最后处理的消息 ID，避免重复处理
  let lastProcessedMessageId: string | null = null;

  // abort 信号：标记停止，关闭当前 socket
  abortSignal?.addEventListener('abort', () => {
    stopped = true;
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  });

  // 轮询服务器获取新消息（作为 WebSocket 的备份/补充）
  async function pollMessages(): Promise<void> {
    if (stopped) return;

    try {
      // 从服务器获取已知的会话列表
      // 远程服务器使用 /api/messages/:conversationId
      // 这里简化为轮询单个已知会话，实际应该跟踪所有活跃会话
      // 首先尝试获取配对信息来找到会话

      const pairingsResponse = await fetch(`${account.serverUrl.replace(/\/$/, '')}/api/pairings`, {
        headers: {
          'x-trix-admin-token': account.adminToken ?? '',
        },
      });

      if (!pairingsResponse.ok) {
        log.warn?.(`Failed to fetch pairings: ${pairingsResponse.status}`);
        return;
      }

      const pairingsData = await pairingsResponse.json() as Array<{ code: string; status: string; deviceId?: string; conversationId?: string }>;
      const pairedDevices = pairingsData.filter((p) => p.status === 'paired' && p.deviceId);

      for (const pairing of pairedDevices) {
        // 尝试获取该设备的消息
        // 远程服务器的 API: /api/messages/:conversationId
        const conversationId = pairing.conversationId || `device_${pairing.deviceId}`;

        const messagesResponse = await fetch(
          `${account.serverUrl.replace(/\/$/, '')}/api/messages/${encodeURIComponent(conversationId)}`,
          {
            headers: {
              'x-trix-admin-token': account.adminToken ?? '',
            },
          }
        );

        if (!messagesResponse.ok) continue;

        const messagesData = await messagesResponse.json() as { messages?: MessageRecord[] };
        const messages = messagesData.messages ?? [];

        // 处理新消息（direction = outbound 表示客户端发出的消息）
        for (const message of messages) {
          // 跳过已处理的
          if (message.id === lastProcessedMessageId) continue;

          // 接受 outbound（客户端发出）、inbound 或 phone
          if (message.direction !== 'outbound' && message.direction !== 'inbound' && message.direction !== 'system') {
            continue;
          }

          // 更新最后处理的 ID
          lastProcessedMessageId = message.id;

          await dispatchInboundMessage({
            gatewayContext,
            account,
            message,
          });
        }
      }
    } catch (error) {
      log.error?.(`TRIX Native message polling failed: ${String(error)}`);
    }
  }

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

        const message = envelope.payload.message;

        // 接受 direction = 'inbound' 或 'outbound'（兼容不同服务器版本）
        // outbound = 客户端发出的消息（到达 Agent）
        // inbound = Agent 发出的消息（到达客户端）
        if (message.direction !== 'inbound' && message.direction !== 'outbound') return;

        // 避免重复处理
        if (message.id === lastProcessedMessageId) return;
        lastProcessedMessageId = message.id;

        await dispatchInboundMessage({
          gatewayContext,
          account,
          message,
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
      socket.once('open', onOpen);
      socket.once('error', onError);
    });
  }

  // 首次连接失败直接抛出，让 gateway 知道启动失败
  await connect();

  // 启动消息轮询（作为 WebSocket 的备份）
  // 每 3 秒检查一次新消息
  const pollIntervalMs = 3000;
  setInterval(() => {
    pollMessages().catch((err) => {
      log.error?.(`TRIX Native poll error: ${String(err)}`);
    });
  }, pollIntervalMs);

  // 立即执行一次轮询
  pollMessages().catch((err) => {
    log.error?.(`TRIX Native initial poll error: ${String(err)}`);
  });

  // 必须加这个，否则 startAccount 返回后
  // OpenClaw 把通道标记为 configured 而不是 running
  // 使用一个永远 pending 的 Promise
  await new Promise<void>((resolve) => {
    // 不调用 resolve，Promise 永远 pending
    // 通道会一直保持 "running" 状态
  });
}
