import WebSocket from 'ws';
import { resolveTrixAccount } from './account.js';
import { normalizeInboundEvent, summarizeInboundAttachments } from './normalize.js';
import { sendPayloadTrix } from './outbound.js';

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const RECONNECT_DELAY_MS = 3000;
const activeMonitors = new Map<string, boolean>();

function waitUntilAbort(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (!signal) {
      return;
    }
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

export async function monitorTrixProvider(opts: {
  config: Record<string, unknown>;
  runtime: unknown;
  abortSignal?: AbortSignal;
  accountId?: string;
  statusSink?: (next: Record<string, unknown>) => void;
  channelRuntime?: {
    reply: {
      dispatchReplyWithBufferedBlockDispatcher: (params: Record<string, unknown>) => Promise<void>;
      finalizeInboundContext: (ctx: Record<string, unknown>) => Record<string, unknown>;
    };
    routing: {
      resolveAgentRoute: (params: Record<string, unknown>) => { sessionKey: string; accountId?: string; agentId?: string } | null;
    };
    session: {
      resolveStorePath: (cfg: Record<string, unknown>) => string;
      recordInboundSession: (params: Record<string, unknown>) => Promise<void>;
    };
    media: {
      fetchRemoteMedia: (params: { url: string }) => Promise<{ buffer: Buffer; contentType?: string }>;
      saveMediaBuffer: (
        buffer: Uint8Array,
        contentType: string | undefined,
        direction: 'inbound' | 'outbound',
        maxBytes: number,
      ) => Promise<{ path: string; contentType?: string }>;
    };
  };
}): Promise<void> {
  const account = resolveTrixAccount({ cfg: opts.config, accountId: opts.accountId ?? undefined });
  const key = account.accountId;
  const runtime = opts.channelRuntime;

  if (!account.enabled || !account.configured) {
    opts.statusSink?.({ accountId: account.accountId, connected: false, configured: account.configured });
    return waitUntilAbort(opts.abortSignal);
  }

  if (!runtime) {
    throw new Error('channelRuntime unavailable for trix-native');
  }

  if (activeMonitors.get(key)) {
    return waitUntilAbort(opts.abortSignal);
  }
  activeMonitors.set(key, true);

  let stopped = false;
  let currentSocket: WebSocket | null = null;

  opts.abortSignal?.addEventListener('abort', () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  }, { once: true });

  const connect = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    const socket = new WebSocket(
      `${account.serviceUrl.replace(/\/$/, '')}/api/service/ws?accountId=${encodeURIComponent(account.accountId)}`,
      {
        headers: {
          authorization: `Bearer ${account.serviceToken ?? ''}`,
        },
      },
    );
    currentSocket = socket;

    socket.on('open', () => {
      opts.statusSink?.({
        accountId: account.accountId,
        connected: true,
        running: true,
        transport: account.transport,
        lastConnectedAt: Date.now(),
      });
    });

    socket.on('message', async (data) => {
      if (stopped) {
        return;
      }

      try {
        const normalized = normalizeInboundEvent(JSON.parse(String(data)));
        if (!normalized) {
          return;
        }

        const route = runtime.routing.resolveAgentRoute({
          cfg: opts.config,
          channel: 'trix-native',
          accountId: account.accountId,
          peer: {
            kind: normalized.chatType === 'channel' ? 'group' : 'direct',
            id: normalized.peerId,
          },
        });
        if (!route) {
          return;
        }

        const attachmentSummary = summarizeInboundAttachments(normalized.message.attachments);
        const bodyForAgent = [normalized.message.text, attachmentSummary].filter(Boolean).join('\n\n').trim();

        let mediaPath: string | undefined;
        let mediaType: string | undefined;
        const firstAttachment = normalized.message.attachments.find((attachment) => attachment.url);
        if (firstAttachment?.url) {
          const fetched = await runtime.media.fetchRemoteMedia({ url: firstAttachment.url });
          const stored = await runtime.media.saveMediaBuffer(
            fetched.buffer,
            fetched.contentType ?? firstAttachment.mimeType,
            'inbound',
            MAX_MEDIA_BYTES,
          );
          mediaPath = stored.path;
          mediaType = stored.contentType ?? firstAttachment.mimeType;
        }

        const ctxPayload = runtime.reply.finalizeInboundContext({
          Body: bodyForAgent,
          BodyForAgent: bodyForAgent,
          RawBody: bodyForAgent,
          CommandBody: bodyForAgent,
          From: `trix-native:${normalized.peerId}`,
          To: `conv:${normalized.conversationId}`,
          SessionKey: route.sessionKey,
          AccountId: route.accountId ?? account.accountId,
          ChatType: normalized.chatType,
          ConversationLabel: normalized.peerDisplayName ?? normalized.peerId,
          SenderName: normalized.peerDisplayName,
          SenderId: normalized.peerId,
          Provider: 'trix-native',
          Surface: 'trix-native',
          MessageSid: normalized.message.id,
          ReplyToId: normalized.message.replyToMessageId ?? undefined,
          Timestamp: normalized.message.timestamp,
          MediaPath: mediaPath,
          MediaType: mediaType,
          MediaUrl: mediaPath,
          OriginatingChannel: 'trix-native',
          OriginatingTo: `conv:${normalized.conversationId}`,
        });

        await runtime.session.recordInboundSession({
          storePath: runtime.session.resolveStorePath(opts.config),
          sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
          ctx: ctxPayload,
          updateLastRoute: {
            sessionKey: route.sessionKey,
            channel: 'trix-native',
            to: `conv:${normalized.conversationId}`,
            accountId: account.accountId,
          },
          onRecordError: () => undefined,
        });

        await runtime.reply.dispatchReplyWithBufferedBlockDispatcher({
          ctx: ctxPayload,
          cfg: opts.config,
          dispatcherOptions: {
            deliver: async (payload: { text?: string; mediaUrls?: string[]; mediaUrl?: string; replyToId?: string }) => {
              await sendPayloadTrix({
                cfg: opts.config,
                accountId: account.accountId,
                conversationId: normalized.conversationId,
                payload,
              });
            },
            onError: () => undefined,
          },
          replyOptions: {},
        });

        opts.statusSink?.({
          accountId: account.accountId,
          connected: true,
          running: true,
          lastInboundAt: Date.now(),
          lastEventAt: Date.now(),
        });
      } catch {
        opts.statusSink?.({
          accountId: account.accountId,
          lastError: 'Failed to process inbound trix-native event',
        });
      }
    });

    socket.on('close', () => {
      if (currentSocket === socket) {
        currentSocket = null;
      }
      opts.statusSink?.({
        accountId: account.accountId,
        connected: false,
        lastDisconnect: {
          at: Date.now(),
        },
      });
      if (stopped) {
        return;
      }
      setTimeout(() => {
        void connect();
      }, RECONNECT_DELAY_MS);
    });

    socket.on('error', (error) => {
      opts.statusSink?.({
        accountId: account.accountId,
        connected: false,
        lastError: String(error),
      });
    });

    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      opts.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
    });
  };

  await connect();
}

