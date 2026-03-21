import WebSocket from 'ws';
import { resolveTrixAccount } from './account.js';
import { normalizeInboundEvent, summarizeInboundAttachments } from './normalize.js';
import { sendPayloadTrix } from './outbound.js';

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const RECONNECT_DELAY_MS = 3000;
const KEEPALIVE_PING_INTERVAL_MS = 25_000;
const activeMonitors = new Map<string, boolean>();
const INBOUND_ACK_TTL_MS = 30 * 60 * 1000;
const MAX_TRACKED_INBOUND_MESSAGES = 2048;

type TrixDmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled';

function readTrixChannelConfig(config: Record<string, unknown>): Record<string, unknown> {
  const channels = (config as { channels?: Record<string, unknown> }).channels;
  return (channels?.['trix-native'] as Record<string, unknown> | undefined) ?? {};
}

function resolveConfiguredAccountSettings(config: Record<string, unknown>, accountId: string): {
  dmPolicy: TrixDmPolicy;
  allowFrom: string[];
  groupAllowFrom: string[];
} {
  const channel = readTrixChannelConfig(config);
  const accounts = (channel.accounts as Record<string, Record<string, unknown>> | undefined) ?? {};
  const rawAccount = accounts[accountId] ?? {};
  const dmPolicy = ((rawAccount.dmPolicy as string | undefined) ?? (channel.dmPolicy as string | undefined) ?? 'open') as TrixDmPolicy;
  const allowFrom = [
    ...(((channel.allowFrom as unknown[]) ?? []).map((entry) => String(entry).trim()).filter(Boolean)),
    ...(((rawAccount.allowFrom as unknown[]) ?? []).map((entry) => String(entry).trim()).filter(Boolean)),
  ];
  const groupAllowFrom = [
    ...(((channel.groupAllowFrom as unknown[]) ?? []).map((entry) => String(entry).trim()).filter(Boolean)),
    ...(((rawAccount.groupAllowFrom as unknown[]) ?? []).map((entry) => String(entry).trim()).filter(Boolean)),
  ];

  return {
    dmPolicy,
    allowFrom: [...new Set(allowFrom)],
    groupAllowFrom: [...new Set(groupAllowFrom)],
  };
}

function allowListIncludes(entries: string[], peerId: string): boolean {
  if (entries.includes('*')) {
    return true;
  }
  return entries.includes(peerId);
}

async function fetchServiceAttachment(params: {
  serviceUrl: string;
  servicePath: string;
  serviceToken: string;
}): Promise<{ buffer: Buffer; contentType?: string }> {
  const response = await fetch(`${params.serviceUrl.replace(/\/$/, '')}${params.servicePath}`, {
    headers: {
      authorization: `Bearer ${params.serviceToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`service attachment fetch failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? undefined;
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function resolveCommandAuthorized(params: {
  config: Record<string, unknown>;
  runtime: NonNullable<Parameters<typeof monitorTrixProvider>[0]['channelRuntime']>;
  accountId: string;
  chatType: 'direct' | 'channel';
  peerId: string;
  rawText: string;
}): Promise<boolean | undefined> {
  if (!params.runtime.commands.shouldComputeCommandAuthorized(params.rawText, params.config)) {
    return undefined;
  }

  const useAccessGroups = ((params.config as { commands?: { useAccessGroups?: boolean } }).commands?.useAccessGroups) !== false;
  const { dmPolicy, allowFrom, groupAllowFrom } = resolveConfiguredAccountSettings(params.config, params.accountId);
  const normalizedPeerId = params.peerId.trim();

  if (params.chatType === 'channel') {
    return params.runtime.commands.resolveCommandAuthorizedFromAuthorizers({
      useAccessGroups,
      authorizers: [
        {
          configured: groupAllowFrom.length > 0,
          allowed: allowListIncludes(groupAllowFrom, normalizedPeerId),
        },
      ],
    });
  }

  if (dmPolicy === 'disabled') {
    return false;
  }

  if (dmPolicy === 'open') {
    return true;
  }

  const storeAllowFrom = await params.runtime.pairing.readAllowFromStore({
    channel: 'trix-native',
    accountId: params.accountId,
  });
  const normalizedStoreAllowFrom = storeAllowFrom.map((entry) => String(entry).trim()).filter(Boolean);

  return params.runtime.commands.resolveCommandAuthorizedFromAuthorizers({
    useAccessGroups,
    authorizers: [
      {
        configured: allowFrom.length > 0,
        allowed: allowListIncludes(allowFrom, normalizedPeerId),
      },
      {
        configured: normalizedStoreAllowFrom.length > 0 || dmPolicy === 'pairing',
        allowed: allowListIncludes(normalizedStoreAllowFrom, normalizedPeerId),
      },
    ],
  });
}

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
      resolveStorePath: (store?: string, options?: { agentId?: string | null }) => string;
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
    pairing: {
      readAllowFromStore: (params: { channel: string; accountId: string }) => Promise<string[]>;
    };
    commands: {
      shouldComputeCommandAuthorized: (text: string, cfg?: Record<string, unknown>, options?: Record<string, unknown>) => boolean;
      resolveCommandAuthorizedFromAuthorizers: (params: {
        useAccessGroups: boolean;
        authorizers: Array<{ configured: boolean; allowed: boolean }>;
        modeWhenAccessGroupsOff?: 'allow' | 'deny' | 'configured';
      }) => boolean;
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
  const inboundDeliveryState = new Map<string, { status: 'processing' | 'done'; updatedAt: number }>();

  const pruneInboundDeliveryState = () => {
    const now = Date.now();
    for (const [messageKey, entry] of inboundDeliveryState.entries()) {
      if (entry.status === 'done' && now - entry.updatedAt > INBOUND_ACK_TTL_MS) {
        inboundDeliveryState.delete(messageKey);
      }
    }

    if (inboundDeliveryState.size <= MAX_TRACKED_INBOUND_MESSAGES) {
      return;
    }

    const entries = [...inboundDeliveryState.entries()].sort((left, right) => left[1].updatedAt - right[1].updatedAt);
    for (const [messageKey] of entries) {
      inboundDeliveryState.delete(messageKey);
      if (inboundDeliveryState.size <= MAX_TRACKED_INBOUND_MESSAGES) {
        break;
      }
    }
  };

  const markInboundDeliveryState = (messageKey: string, status: 'processing' | 'done') => {
    inboundDeliveryState.set(messageKey, { status, updatedAt: Date.now() });
    pruneInboundDeliveryState();
  };

  const clearInboundDeliveryState = (messageKey: string) => {
    inboundDeliveryState.delete(messageKey);
  };

  const sendServiceAck = (messageId: string) => {
    const ackSocket = currentSocket;
    if (!ackSocket || ackSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    ackSocket.send(JSON.stringify({
      type: 'message.ack',
      payload: {
        accountId: account.accountId,
        messageId,
      },
    }));
  };

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
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const clearPingTimer = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    socket.on('open', () => {
      clearPingTimer();
      pingTimer = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          clearPingTimer();
          return;
        }
        try {
          socket.ping();
        } catch (error) {
          opts.statusSink?.({
            accountId: account.accountId,
            lastError: error instanceof Error ? error.message : String(error),
          });
        }
      }, KEEPALIVE_PING_INTERVAL_MS);
      opts.statusSink?.({
        accountId: account.accountId,
        connected: true,
        running: true,
        transport: account.transport,
        lastConnectedAt: Date.now(),
        lastError: null,
      });
    });

    socket.on('message', async (data) => {
      if (stopped) {
        return;
      }

      let inboundMessageKey: string | null = null;
      try {
        const normalized = normalizeInboundEvent(JSON.parse(String(data)));
        if (!normalized) {
          return;
        }
        const normalizedMessageId = normalized.message.id;
        if (!normalizedMessageId) {
          throw new Error('Inbound trix-native message missing id');
        }
        inboundMessageKey = `${account.accountId}:${normalizedMessageId}`;
        const inboundDelivery = inboundDeliveryState.get(inboundMessageKey);
        if (inboundDelivery?.status === 'done') {
          sendServiceAck(normalizedMessageId);
          return;
        }
        if (inboundDelivery?.status === 'processing') {
          console.info('[trix-native] duplicate inbound replay ignored while processing', {
            conversationId: normalized.conversationId,
            messageId: normalized.message.id,
          });
          return;
        }
        markInboundDeliveryState(inboundMessageKey, 'processing');

        console.info('[trix-native] inbound message', {
          conversationId: normalized.conversationId,
          hasAttachments: normalized.message.attachments.length > 0,
          isSlashCommand: normalized.message.text?.startsWith('/') ?? false,
        });

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
        const storePath = runtime.session.resolveStorePath(
          (opts.config as { session?: { store?: string } }).session?.store,
          { agentId: route.agentId as string | undefined },
        );

        const rawText = normalized.message.text ?? '';
        const isSlashCommand = rawText.startsWith('/');
        const commandAuthorized = await resolveCommandAuthorized({
          config: opts.config,
          runtime,
          accountId: account.accountId,
          chatType: normalized.chatType,
          peerId: normalized.peerId,
          rawText,
        });

        let mediaPath: string | undefined;
        let mediaType: string | undefined;
        let bodyForAgent: string;
        let rawBody = rawText;
        let commandBody = rawText;

        if (isSlashCommand) {
          // Slash commands: preserve raw text without attachment pollution
          bodyForAgent = rawText;

          console.info('[trix-native] command dispatch', {
            conversationId: normalized.conversationId,
            commandName: rawText.split(' ')[0],
            senderId: normalized.peerId,
          });
        } else {
          // Regular messages: text + attachment summary, fetch media via servicePath
          const attachmentSummary = summarizeInboundAttachments(normalized.message.attachments);
          bodyForAgent = [normalized.message.text, attachmentSummary].filter(Boolean).join('\n\n').trim();

          const firstAttachment = normalized.message.attachments.find((a) => a.url || (a as { servicePath?: string }).servicePath);
          if (firstAttachment) {
            const servicePath = (firstAttachment as { servicePath?: string }).servicePath;
            const downloadUrl: string = servicePath
              ? `${account.serviceUrl.replace(/\/$/, '')}${servicePath}`
              : firstAttachment.url!;

            try {
              const fetched = servicePath
                ? await fetchServiceAttachment({
                    serviceUrl: account.serviceUrl ?? '',
                    servicePath,
                    serviceToken: account.serviceToken ?? '',
                  })
                : await runtime.media.fetchRemoteMedia({ url: downloadUrl });
              const stored = await runtime.media.saveMediaBuffer(
                fetched.buffer,
                fetched.contentType ?? firstAttachment.mimeType,
                'inbound',
                MAX_MEDIA_BYTES,
              );
              mediaPath = stored.path;
              mediaType = stored.contentType ?? firstAttachment.mimeType;

              console.info('[trix-native] inbound attachment fetch ok', {
                accountId: account.accountId,
                conversationId: normalized.conversationId,
                attachmentId: firstAttachment.id,
                url: downloadUrl,
                mediaPath,
                usedServicePath: !!servicePath,
              });
            } catch (error) {
              console.warn('[trix-native] inbound attachment fetch failed, using summary fallback', {
                accountId: account.accountId,
                conversationId: normalized.conversationId,
                attachmentId: firstAttachment.id,
                url: downloadUrl,
                error: error instanceof Error ? error.message : String(error),
              });
              // bodyForAgent already has the attachment summary, so fallback is automatic
            }
          }
        }

        const ctxPayload = runtime.reply.finalizeInboundContext({
          Body: bodyForAgent,
          BodyForAgent: bodyForAgent,
          RawBody: rawBody,
          CommandBody: commandBody,
          BodyForCommands: commandBody,
          ...(typeof commandAuthorized === 'boolean' ? { CommandAuthorized: commandAuthorized } : {}),
          ...(isSlashCommand ? { CommandSource: 'text' } : {}),
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
          storePath,
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

        let inboundReplyAcknowledged = false;

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
              console.info('[trix-native] reply dispatch ok', { conversationId: normalized.conversationId });
              opts.statusSink?.({
                accountId: account.accountId,
                lastOutboundAt: Date.now(),
                lastError: null,
              });
              if (!inboundReplyAcknowledged) {
                inboundReplyAcknowledged = true;
                markInboundDeliveryState(inboundMessageKey!, 'done');
                sendServiceAck(normalizedMessageId);
              }
            },
            onError: (error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              console.error('[trix-native] reply dispatch failed', error);
              opts.statusSink?.({
                accountId: account.accountId,
                lastError: `TRIX reply dispatch failed: ${message}`,
              });
            },
          },
          replyOptions: {},
        });

        opts.statusSink?.({
          accountId: account.accountId,
          connected: true,
          running: true,
          lastInboundAt: Date.now(),
          lastEventAt: Date.now(),
          lastError: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[trix-native] inbound processing failed', error);
        if (inboundMessageKey) {
          clearInboundDeliveryState(inboundMessageKey);
        }
        opts.statusSink?.({
          accountId: account.accountId,
          lastError: `Failed to process inbound trix-native event: ${message}`,
        });
      }
    });

    socket.on('pong', () => {
      opts.statusSink?.({
        accountId: account.accountId,
        connected: true,
        lastEventAt: Date.now(),
      });
    });

    socket.on('close', () => {
      clearPingTimer();
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
      clearPingTimer();
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
