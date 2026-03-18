# TRIX Native 通道连接指南

> 最后更新: 2026-03-18

本文档详细说明 TRIX Native 通道如何连接 OpenClaw Gateway，以及核心代码的实现逻辑。

---

## 1. 系统架构

```
┌─────────────────┐      WebSocket       ┌─────────────────┐
│  TRIX App       │ ◄─────────────────► │  TRIX Native    │
│  (网页/移动端)   │    role=user        │  Server         │
└─────────────────┘                     │  (TRIX_SERVER_HOST:8788)
                                       └────────┬────────┘
                                                │ HTTP/WebSocket
                                                ▼
                                       ┌─────────────────┐
                                       │  OpenClaw       │
                                       │  Gateway         │
                                       │  (本地 18789)    │
                                       └────────┬────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │  Agent (TRIX)   │
                                       │  处理消息        │
                                       └─────────────────┘
```

---

## 2. 连接流程

### 2.1 整体流程

1. **配对阶段**: TRIX App 与 TRIX Native Server 建立连接，完成配对
2. **消息发送**: TRIX App 发送消息 → TRIX Native Server（存入数据库）
3. **WebSocket 通知**: TRIX Native Server 通过 WebSocket 推送 `message.created` 事件
4. **消息接收**: OpenClaw Gateway 通过 WebSocket 接收消息（role=agent）
5. **Agent 处理**: Gateway 调用 Agent 处理消息
6. **消息回复**: Agent 生成回复 → 通过 `dispatchReplyWithBufferedBlockDispatcher` 回调发送

### 2.2 WebSocket 连接建立

**TRIX Native Server 端**:
- 监听 `/ws` 路径
- 支持两种角色: `role=user`（TRIX App）和 `role=agent`（OpenClaw）
- 参数: `adminToken`, `accountId`

**OpenClaw Plugin 端** (`inbound.ts`):

```typescript
const wsUrl = `${wsBase}/ws?role=agent&adminToken=${encodeURIComponent(
  account.adminToken ?? ''
)}&accountId=${encodeURIComponent(account.accountId)}`;
```

---

## 3. 核心代码块

### 3.1 入口: startInboundMonitor

**文件**: `packages/trix-openclaw-native/src/plugin/inbound.ts`

```typescript
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
}
```

### 3.2 消息分发: dispatchInboundMessage

```typescript
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
  const buildAgentMediaPayload = compat.buildAgentMediaPayload as ((
    media: Array<{ path: string; contentType?: string }>
  ) => Record<string, unknown>);

  // 1. 解析路由：找到处理该会话的 Agent
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

  // 2. 构建消息上下文
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

  // 3. 分发消息给 Agent 处理，并设置回复回调
  await (reply.dispatchReplyWithBufferedBlockDispatcher as (params: Record<string, unknown>) => Promise<void>)({
    ctx: finalized,
    cfg: gatewayContext.cfg,
    dispatcherOptions: {
      deliver: async (payload: OutboundReplyPayloadLike) => {
        // 4. 发送回复到 TRIX Native Server
        await postReply(account, message.conversationId, payload);
      },
      onError: (error: unknown, info: { kind?: string }) => {
        log.error?.(`TRIX Native ${info.kind ?? 'reply'} failed: ${String(error)}`);
      },
    },
    replyOptions: {},
  });
}
```

### 3.3 回复发送: postReply

```typescript
async function postReply(
  account: ResolvedPluginAccount,
  conversationId: string,
  payload: OutboundReplyPayloadLike
): Promise<void> {
  const store = new AttachmentStore(account.storageDir);
  await store.ensure();

  // 处理媒体附件
  const mediaUrls = payload.mediaUrls?.length ? payload.mediaUrls : payload.mediaUrl ? [payload.mediaUrl] : [];
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

  // 发送 HTTP POST 到 TRIX Native Server
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
```

---

## 4. 配置

### 4.1 OpenClaw 配置

文件: `~/.openclaw/openclaw.json`

```json
{
  "channels": {
    "trix-native": {
      "accounts": {
        "default": {
          "serverUrl": "http://TRIX_SERVER_HOST:8788",
          "adminToken": "OoLV8oTIwHe6FN_F6VnFxMGDiKcQ-QWP"
        }
      },
      "enabled": true,
      "defaultAccount": "default"
    }
  },
  "plugins": {
    "load": {
      "paths": [
        "E:\\desktop\\trix-3d-companion\\packages\\trix-openclaw-native"
      ]
    }
  }
}
```

### 4.2 Plugin 配置

文件: `packages/trix-openclaw-native/src/plugin/plugin.ts`

```typescript
gateway: {
  startAccount: async (ctx: Record<string, unknown>) => {
    const log = (ctx.log as { info?: (msg: string) => void } | undefined) ?? {};
    const account = resolveAccount(ctx.cfg as Record<string, unknown>, ctx.accountId as string | undefined);
    const effectiveAccount = {
      ...account,
      storageDir: account.storageDir || path.resolve('.trix-native-channel/openclaw'),
    };
    await startInboundMonitor(ctx, effectiveAccount);
  },
},
```

---

## 5. 调试方法

### 5.1 检查 Gateway 状态

```bash
openclaw status
```

输出应显示:
```
│ TRIX Native │ ON      │ OK     │ configured │
```

### 5.2 检查 WebSocket 连接

WebSocket 连接建立时会输出日志:
```
TRIX Native agent websocket connected (default)
```

异常断开时:
```
TRIX Native websocket closed unexpectedly (code=XXX), reconnecting in 5s...
```

### 5.3 手动测试连接

```bash
# 检查服务器是否可达
curl http://TRIX_SERVER_HOST:8788/api/pairings

# 检查 Gateway 健康状态
curl http://127.0.0.1:18789/health
```

---

## 6. 已知问题

### 6.1 WebSocket 连接断开后不重连（旧版本）

**问题**: 早期版本中，WebSocket 连接建立后 promise 就 resolved，导致函数退出，Gateway 会重启通道。

**解决**: 当前版本使用 `connect()` 内部函数，包含完整的重连逻辑：
- 监听 `close` 事件
- 非 1000 断开码时，5 秒后自动重连

### 6.2 消息方向过滤

代码中只处理 `direction === 'inbound'` 的消息:

```typescript
if (envelope.payload.message.direction !== 'inbound') return;
```

---

## 7. 关键文件

| 文件 | 说明 |
|------|------|
| `packages/trix-openclaw-native/src/plugin/inbound.ts` | 接收消息的核心逻辑 |
| `packages/trix-openclaw-native/src/plugin/outbound.ts` | 发送消息的逻辑 |
| `packages/trix-openclaw-native/src/plugin/plugin.ts` | Plugin 入口和配置 |
| `packages/trix-openclaw-native/src/plugin/accounts.ts` | 账户配置解析 |
| `packages/trix-openclaw-native/src/types.ts` | 类型定义 |

---

## 8. 故障排查清单

1. ✅ Gateway 是否运行? (`curl http://127.0.0.1:18789/health`)
2. ✅ TRIX Native Server 是否可达? (`curl http://TRIX_SERVER_HOST:8788/api/pairings`)
3. ✅ 插件是否加载? (`openclaw status` 显示 TRIX Native OK)
4. ✅ WebSocket 是否连接? (查看日志中的 `websocket connected`)
5. ✅ 消息是否发送成功? (查看数据库或服务器日志)
