# OpenClaw Native Channel Plugin — 官方规范参考

> 来源：docs.openclaw.ai + GitHub openclaw/openclaw issues #20121 #20502 #22699 #23402 #24374 #25527 #26363 #26478 #27933
> 版本：OpenClaw 2026.3.x

---

## 一、最重要的一条规则

### `startAccount` 必须永远不返回

这是被 **7 个官方 issue 反复确认** 的机制。涉及 Google Chat、LINE、MS Teams、BlueBubbles、Synology Chat 都因为这个问题产生了 auto-restart 循环。

官方 Gateway 框架内部逻辑（来自 issue #27933 的源码片段）：

```javascript
// gateway-cli-*.js — startChannelInternal
const task = startAccount({ ...ctx });
Promise.resolve(task)
  .catch(err => { /* set lastError */ })
  .finally(() => {
    setRuntime(channelId, id, { running: false, lastStopAt: Date.now() });
  })
  .then(async () => {
    // ← 触发 auto-restart 逻辑
  });
```

**结论：Promise resolve = channel stopped = auto-restart 触发。**

### 唯一正确的 startAccount 模式

```typescript
// ✅ 官方推荐模式（来自 issue #27933 官方修复）
gateway: {
  startAccount: async (ctx) => {
    // 1. 启动连接，拿到 cleanup 函数
    const cleanup = await startYourMonitor(ctx, account);

    // 2. 挂起，直到 Gateway 关闭（abortSignal 触发）
    //    不是等 WebSocket 断线，不是等 HTTP 关闭
    //    而是等 Gateway 主动停止这个 account
    try {
      await new Promise<void>((resolve) => {
        if (ctx.abortSignal?.aborted) { resolve(); return; }
        ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
      });
    } finally {
      // 3. Gateway 关闭时才执行清理
      cleanup?.();
      ctx.setStatus?.({
        accountId: account.accountId,
        running: false,
        lastStopAt: Date.now(),
      });
    }
  }
}
```

---

## 二、Plugin 文件结构

### 必须的三个文件

```
your-plugin/
├── src/index.ts              # 插件入口
├── openclaw.plugin.json      # 插件声明（必须存在）
└── package.json              # 包配置（必须有 openclaw 字段）
```

### openclaw.plugin.json

```json
{
  "id": "your-plugin-id",
  "channels": ["your-channel-id"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

**硬性要求：**
- `id` 必须与 `package.json` name 的 unscoped 部分完全一致
- `channels` 数组必须存在且声明 channel id。缺少此字段，用户在 `openclaw.json` 里配置 `channels.your-channel-id` 时 Gateway 直接报 `unknown channel id` 并拒绝启动
- `configSchema` 即使为空对象也必须存在

### package.json

```json
{
  "name": "@your-scope/your-plugin-id",
  "version": "1.0.0",
  "openclaw": {
    "extensions": ["./src/index.ts"],
    "channel": {
      "id": "your-channel-id",
      "label": "Your Channel",
      "selectionLabel": "Your Channel (Paired)",
      "docsPath": "/channels/your-channel",
      "docsLabel": "your-channel",
      "blurb": "一句话描述",
      "order": 75,
      "aliases": ["alias"]
    },
    "install": {
      "npmSpec": "@your-scope/your-plugin-id",
      "defaultChoice": "npm"
    }
  },
  "peerDependencies": {
    "openclaw": "*"
  }
}
```

**硬性要求：**
- `openclaw` 必须在 `peerDependencies` 或 `devDependencies`，不能在 `dependencies`
- `extensions` 指向 `.ts` 文件（jiti 运行时加载，不需要构建）
- `openclaw plugins install` 使用 `--ignore-scripts`，不能依赖需要 postinstall 构建的包

---

## 三、插件入口（src/index.ts）

官方支持两种导出格式：

```typescript
// 格式一：函数（推荐）
export default function register(api: any): void {
  api.registerChannel({ plugin: createYourPlugin() });
}

// 格式二：对象
export default {
  id: 'your-plugin-id',
  name: 'Your Channel',
  configSchema: { type: 'object', additionalProperties: false, properties: {} },
  register(api: any) {
    api.registerChannel({ plugin: createYourPlugin() });
  }
};
```

带 CLI 命令的完整入口：

```typescript
import { createYourPlugin } from './plugin.js';

export default function register(api: any): void {
  // 1. 注册 Channel（必须）
  api.registerChannel({ plugin: createYourPlugin() });

  // 2. 注册 CLI 命令（推荐，让用户无需手动改 JSON）
  api.registerCli(({ program }: any) => {
    program
      .command('yourchannel')
      .command('setup')
      .description('Pair a device')
      .action(async () => {
        const { runSetup } = await import('./setup.js');
        await runSetup(api);
      });
  }, { commands: ['yourchannel'] });
}
```

---

## 四、Channel 定义（完整结构）

```typescript
export function createYourPlugin() {
  const pendingPairingCodes = new Map<string, string>();

  return {
    id: 'your-channel-id',

    meta: {
      id: 'your-channel-id',
      label: 'Your Channel',
      selectionLabel: 'Your Channel (Paired)',
      docsPath: '/channels/your-channel',
      blurb: '一句话描述',
      aliases: ['alias'],
      order: 75,
    },

    capabilities: {
      chatTypes: ['direct'],
      media: true,        // 支持图片/语音/视频
      polls: false,
      threads: false,
      reactions: false,
      edit: false,
      reply: true,
    },

    config: {
      // ⚠️ channel id 含连字符时必须用方括号写法
      // 写成 cfg.channels?.yourChannelId 会静默读不到配置
      listAccountIds: (cfg: any) =>
        Object.keys(cfg.channels?.['your-channel-id']?.accounts ?? {}),

      resolveAccount: (cfg: any, accountId?: string) =>
        cfg.channels?.['your-channel-id']?.accounts?.[accountId ?? 'default']
        ?? { accountId: accountId ?? 'default' },

      defaultAccountId: () => 'default',
      isEnabled: (account: any) => account.enabled !== false,
      isConfigured: (account: any) =>
        Boolean(account.serverUrl && account.serviceToken),

      // inspectAccount：只读路径，不需要加载 secret
      // resolveAccount：运行时路径
      inspectAccount: (cfg: any, accountId?: string) => {
        const id = accountId ?? 'default';
        const acc = cfg.channels?.['your-channel-id']?.accounts?.[id];
        return {
          accountId: id,
          enabled: acc?.enabled !== false,
          configured: Boolean(acc?.serverUrl && acc?.serviceToken),
        };
      },
    },

    configSchema: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'boolean' },
          defaultAccount: { type: 'string' },
          accounts: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              additionalProperties: false,
              required: ['serverUrl', 'serviceToken'],
              properties: {
                enabled: { type: 'boolean' },
                name: { type: 'string' },
                serverUrl: { type: 'string', format: 'uri' },
                serviceToken: { type: 'string' },
                adminToken: { type: 'string' },
                storageDir: { type: 'string' },
              },
            },
          },
        },
      },
    },

    outbound: {
      deliveryMode: 'direct' as const,

      sendText: async ({ text, conversation, account }: any) => {
        const res = await fetch(`${account.serverUrl}/api/service/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${account.serviceToken}`,
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            direction: 'outbound',
            text,
          }),
        });
        if (!res.ok) return { ok: false };
        return { ok: true };
      },

      sendMedia: async ({ mediaUrl, mimeType, conversation, account }: any) => {
        // 1. 下载媒体
        const buf = await fetch(mediaUrl).then(r => r.arrayBuffer());
        // 2. 上传到服务器
        const form = new FormData();
        form.append('file', new Blob([buf], { type: mimeType }));
        const up = await fetch(`${account.serverUrl}/api/service/uploads`, {
          method: 'POST',
          headers: { 'authorization': `Bearer ${account.serviceToken}` },
          body: form,
        });
        const { url } = await up.json() as { url: string };
        // 3. 发送消息
        await fetch(`${account.serverUrl}/api/service/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${account.serviceToken}`,
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            direction: 'outbound',
            attachments: [{ url, mimeType }],
          }),
        });
        return { ok: true };
      },
    },

    gateway: {
      // QR 配对：生成配对码
      loginWithQrStart: async ({ cfg, accountId, timeoutMs }: any) => {
        const account = cfg.channels?.['your-channel-id']
          ?.accounts?.[accountId ?? 'default'];
        const res = await fetch(`${account.serverUrl}/api/pairings`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${account.serviceToken}`,
          },
          body: JSON.stringify({ ttlMs: timeoutMs }),
        });
        const pairing = await res.json() as {
          code: string;
          claimUrl: string;
          qrDataUrl?: string;
        };
        pendingPairingCodes.set(accountId ?? 'default', pairing.code);
        return {
          qrDataUrl: pairing.qrDataUrl,
          message: `Pairing code: ${pairing.code} | URL: ${pairing.claimUrl}`,
        };
      },

      // QR 配对：轮询等待完成
      loginWithQrWait: async ({ cfg, accountId, timeoutMs }: any) => {
        const account = cfg.channels?.['your-channel-id']
          ?.accounts?.[accountId ?? 'default'];
        const code = pendingPairingCodes.get(accountId ?? 'default');
        if (!code) return { connected: false, message: 'No pending pairing.' };

        const startedAt = Date.now();
        while (Date.now() - startedAt < (timeoutMs ?? 300_000)) {
          const res = await fetch(
            `${account.serverUrl}/api/pairings/${encodeURIComponent(code)}`,
            { headers: { 'authorization': `Bearer ${account.serviceToken}` } }
          );
          const data = await res.json() as { status?: string };
          if (data.status === 'paired') {
            pendingPairingCodes.delete(accountId ?? 'default');
            return { connected: true, message: 'Device paired.' };
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        pendingPairingCodes.delete(accountId ?? 'default');
        return { connected: false, message: 'Pairing timed out.' };
      },

      // ⚠️ 核心：必须永远不返回，直到 abortSignal 触发
      // 根据官方 issue #26478 #27933 #26363 #25527 #24374 的一致结论
      startAccount: async (ctx: any) => {
        const account = ctx.cfg.channels?.['your-channel-id']
          ?.accounts?.[ctx.accountId ?? 'default'];

        // 启动 WebSocket 长连接，拿到 cleanup 函数
        const cleanup = await startInboundMonitor(ctx, account);

        // ⚠️ 挂起直到 Gateway 关闭
        // resolve 条件必须是 abortSignal，不能是 ws.onclose
        try {
          await new Promise<void>((resolve) => {
            if (ctx.abortSignal?.aborted) { resolve(); return; }
            ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
          });
        } finally {
          cleanup?.();
          ctx.setStatus?.({
            accountId: account?.accountId ?? ctx.accountId,
            running: false,
            lastStopAt: Date.now(),
          });
        }
      },
    },
  };
}
```

---

## 五、Inbound 监听（WebSocket 长连接）

```typescript
// inbound.ts
import WebSocket from 'ws';

// 防止重复启动（Gateway 重启时可能多次调用 startAccount）
const activeMonitors = new Map<string, boolean>();

export async function startInboundMonitor(
  ctx: any,
  account: any
): Promise<(() => void) | undefined> {
  const key = account.accountId;
  const log = ctx.log ?? {};
  const abortSignal = ctx.abortSignal as AbortSignal | undefined;

  // 已在运行，跳过
  if (activeMonitors.get(key)) {
    log.warn?.(`[${key}] Inbound monitor already running, skipping`);
    return undefined;
  }
  activeMonitors.set(key, true);

  let stopped = false;
  let currentSocket: WebSocket | null = null;

  // ⚠️ abort 时必须删除 Map key，否则 Gateway 重启后无法重连
  abortSignal?.addEventListener('abort', () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  }, { once: true });

  const wsUrl = `${account.serverUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/ws`
    + `?role=agent`
    + `&accountId=${encodeURIComponent(account.accountId)}`
    + `&serviceToken=${encodeURIComponent(account.serviceToken ?? '')}`;

  async function connect(): Promise<void> {
    if (stopped) return;

    const socket = new WebSocket(wsUrl);
    currentSocket = socket;

    // 接收 inbound 消息
    socket.on('message', async (data) => {
      if (stopped) return;
      try {
        const envelope = JSON.parse(data.toString()) as {
          type: string;
          payload: { message?: any };
        };
        if (envelope.type !== 'message.created') return;
        if (!envelope.payload.message) return;
        if (envelope.payload.message.direction !== 'inbound') return;

        await dispatchInboundMessage(ctx, account, envelope.payload.message);
      } catch (err) {
        log.error?.(`[${key}] Dispatch failed: ${String(err)}`);
      }
    });

    // ⚠️ 断线重连：ws 断线触发重连，不触发 startAccount resolve
    socket.on('close', (code) => {
      if (currentSocket === socket) currentSocket = null;
      if (stopped || code === 1000) return;
      log.warn?.(`[${key}] WS closed (${code}), reconnecting in 5s...`);
      setTimeout(() => {
        connect().catch(err =>
          log.error?.(`[${key}] Reconnect failed: ${String(err)}`)
        );
      }, 5000);
    });

    socket.on('error', (err) => {
      log.error?.(`[${key}] WS error: ${String(err)}`);
    });

    // 等待连接建立，互相 removeListener 避免竞争条件
    await new Promise<void>((resolve, reject) => {
      function onOpen() {
        socket.removeListener('error', onError);
        log.info?.(`[${key}] WS connected`);
        resolve();
      }
      function onError(err: Error) {
        socket.removeListener('open', onOpen);
        if (currentSocket === socket) currentSocket = null;
        reject(err);
      }
      socket.once('open', onOpen);
      socket.once('error', onError);
    });

    // 心跳保活（30 秒）
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30_000);
    socket.once('close', () => clearInterval(heartbeat));
  }

  // 首次连接失败直接抛出，让 startAccount 感知
  try {
    await connect();
  } catch (err) {
    activeMonitors.delete(key);
    throw err;
  }

  // 返回 cleanup 函数
  return () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  };
}

async function dispatchInboundMessage(ctx: any, account: any, message: any) {
  const log = ctx.log ?? {};
  const channelRuntime = ctx.channelRuntime;

  if (!channelRuntime) {
    log.warn?.('channelRuntime unavailable');
    return;
  }

  const route = channelRuntime.routing.resolveAgentRoute?.({
    cfg: ctx.cfg,
    channel: 'your-channel-id',
    accountId: account.accountId,
    peer: { kind: 'direct', id: message.conversationId },
  });

  if (!route) {
    log.warn?.(`No route for conversation ${message.conversationId}`);
    return;
  }

  const finalized = channelRuntime.reply.finalizeInboundContext({
    Body: message.text ?? '',
    BodyForAgent: message.text ?? '',
    RawBody: message.text ?? '',
    CommandBody: message.text ?? '',
    From: `your-channel:${message.senderId}`,
    To: `conversation:${message.conversationId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId ?? account.accountId,
    ChatType: 'direct',
    SenderId: message.senderId,
    SenderName: message.senderName ?? message.senderId,
    Provider: 'your-channel-id',
    Surface: 'your-channel-id',
    MessageSid: message.id,
    Timestamp: message.createdAt,
    OriginatingChannel: 'your-channel-id',
    OriginatingTo: message.conversationId,
    WasMentioned: false,
  });

  await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: finalized,
    cfg: ctx.cfg,
    dispatcherOptions: {
      deliver: async (payload: any) => {
        await fetch(`${account.serverUrl}/api/service/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${account.serviceToken}`,
          },
          body: JSON.stringify({
            conversationId: message.conversationId,
            direction: 'outbound',
            text: payload.text ?? '',
            senderId: `openclaw:${account.accountId}`,
          }),
        });
      },
      onError: (err: unknown, info: { kind?: string }) => {
        log.error?.(`Reply (${info.kind ?? 'unknown'}) failed: ${String(err)}`);
      },
    },
    replyOptions: {},
  });
}
```

---

## 六、服务器端 WebSocket 协议

### 端点格式

```
ws://your-server/ws?role=agent&accountId=xxx&serviceToken=xxx
```

服务器必须：
1. 支持 `role=agent`，允许 Plugin 以 bot 身份连接
2. 收到 inbound 消息时，向所有 `role=agent` 连接广播
3. 响应 ping 帧：`socket.on('ping', () => socket.pong())`

### 广播消息格式（服务器 → Plugin）

```typescript
type ServerEvent =
  | {
      type: 'connected';
      payload: {
        role: 'user' | 'agent';
        conversationId?: string;
        agentOnline?: boolean;
      };
    }
  | {
      type: 'agent.status';
      payload: { online: boolean; accountId: string };
    }
  | {
      type: 'message.created';
      payload: { message: MessageRecord };
    };

interface MessageRecord {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  senderId: string;
  senderName?: string;
  text?: string;
  attachments: AttachmentDescriptor[];
  createdAt: number;
}
```

### 消息方向

| direction | 含义 | 前端气泡方向 |
|-----------|------|------------|
| `inbound` | 用户 → Agent | 右侧（自己） |
| `outbound` | Agent → 用户 | 左侧（对方） |

---

## 七、用户配置（openclaw.json）

```json
{
  "channels": {
    "your-channel-id": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "enabled": true,
          "name": "Your Channel",
          "serverUrl": "http://your-server:8788",
          "serviceToken": "your-service-token",
          "adminToken": "your-admin-token"
        }
      }
    }
  },
  "plugins": {
    "entries": {
      "your-plugin-id": { "enabled": true }
    }
  }
}
```

**⚠️ channel id 含连字符（如 `trix-native`）时，TypeScript 读取必须用 `cfg.channels?.['trix-native']`，不能写 `cfg.channels?.trixNative`。**

---

## 八、零配置安装流程

```bash
openclaw plugins install @your-scope/your-plugin
openclaw gateway restart
openclaw yourchannel setup   # 弹出配对码，扫码完成
openclaw gateway restart
```

---

## 九、调试命令

```bash
openclaw gateway status          # RPC probe: ok?
openclaw channels status         # running 还是 configured?
openclaw channels status --probe # 主动探活
openclaw logs --follow           # 实时日志
openclaw plugins list            # 插件是否加载
openclaw plugins doctor          # manifest/schema 检查
openclaw doctor                  # 全局健康检查
```

---

## 十、常见错误速查

| 错误 | 原因 | 解决 |
|------|------|------|
| `unknown channel id` | `openclaw.plugin.json` 缺 `channels` | 加 `"channels": ["your-channel-id"]` |
| `plugin id mismatch` | manifest id 与 package name 不一致 | 统一为 unscoped name |
| Channel 显示 `configured` 不是 `running` | `startAccount` 提前返回 | 加 `await abortSignal Promise`（issue #27933） |
| `auto-restart attempt X/10` | 同上 | 同上 |
| `EADDRINUSE` | auto-restart 时上一个实例未关闭 | 同上，根本原因一样 |
| `Inbound monitor already running` | abort 时未清 Map | `abortSignal` 里加 `activeMonitors.delete(key)` |
| `socket hang up` | 服务器崩溃 | `pm2 restart` |
| WS code=4000 | 服务器主动拒绝，token 无效或不支持 `role=agent` | 检查 serviceToken 和服务器逻辑 |
| WS code=1006 | 网络断开 | 正常，5 秒自动重连 |
| 消息气泡反向 | sender 判断错误 | `direction === 'inbound' ? 'user' : 'bot'` |
| config 读不到 | 驼峰 vs 连字符 | 用 `cfg.channels?.['your-channel-id']` |
| Socket.IO 不兼容 | 协议层不同 | 统一用原生 `ws` 库 |