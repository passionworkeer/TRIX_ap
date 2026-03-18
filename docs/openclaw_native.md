# OpenClaw Native Channel 实现规范

> 版本: 2.0 | 基于 OpenClaw 2026.3.13
> 信息来源：官方文档 docs.openclaw.ai + GitHub openclaw/openclaw issue #27933 + 真实调试经验

---

## 一、最核心的规则（必读）

### 规则 1：`startAccount` 必须永远不返回

这是 **OpenClaw 官方 GitHub issue #27933** 明确记录的机制：

> The gateway framework treats a resolved `startAccount` promise as "channel stopped"

Gateway 框架内部实际逻辑（来自官方 issue #27933）：

```typescript
const task = startAccount({...});
const trackedPromise = Promise.resolve(task)
  .catch(err => { /* set lastError */ })
  .finally(() => {
    setRuntime(channelId, id, { running: false, lastStopAt: Date.now() });
  })
  .then(async () => { /* auto-restart logic */ });
```

**结论：`startAccount` 返回 = Gateway 认为通道停止 = 触发无限 auto-restart 循环。**

### 官方修复模式（来自 issue #27933，适用于所有 webhook/WebSocket 类 channel）

```typescript
gateway: {
  startAccount: async (ctx) => {
    // 1. 启动连接，拿到 cleanup 函数
    const cleanup = await startYourMonitor(ctx, account);

    // 2. 挂起直到 Gateway 关闭（abortSignal 触发）
    try {
      await new Promise<void>((resolve) => {
        if (ctx.abortSignal?.aborted) { resolve(); return; }
        ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
      });
    } finally {
      // 3. 清理资源
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

Telegram/Discord 用 polling loop 挂起，WebSocket 类 channel 用 abortSignal 挂起，效果相同。

---

## 二、Plugin 文件结构

### 2.1 必须的三个文件

```
your-plugin/
├── src/
│   └── index.ts              # 插件入口
├── openclaw.plugin.json      # 插件声明（必须有）
└── package.json              # npm 包配置（必须有 openclaw 字段）
```

### 2.2 openclaw.plugin.json

```json
{
  "id": "your-plugin-id",
  "channels": ["your-channel-id"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  },
  "uiHints": {
    "adminToken": { "label": "Admin Token", "sensitive": true },
    "serverUrl": { "label": "Server URL", "placeholder": "http://your-server:8788" }
  }
}
```

必须有的字段：
- `id`：必须与 `package.json` name 的 unscoped 部分一致，不一致会报 `plugin id mismatch` 警告
- `channels`：声明该插件注册的 channel id 数组。缺少此字段，用户配置 `channels.your-channel-id` 时 Gateway 直接拒绝启动，报 `unknown channel id` 错误

### 2.3 package.json

```json
{
  "name": "@your-scope/your-plugin-id",
  "version": "1.0.0",
  "openclaw": {
    "extensions": ["./src/index.ts"],
    "channel": {
      "id": "your-channel-id",
      "label": "Your Channel",
      "selectionLabel": "Your Channel (description)",
      "docsPath": "/channels/your-channel",
      "docsLabel": "your-channel",
      "blurb": "一句话描述这个 channel 做什么",
      "order": 75,
      "aliases": ["alias1", "alias2"]
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

注意事项：
- `extensions` 指向 `.ts` 文件，OpenClaw 用 jiti 运行时加载，不需要构建
- `openclaw` 必须放在 `peerDependencies` 或 `devDependencies`，不能放 `dependencies`
- 安装时用 `npm install --ignore-scripts`，不能依赖需要 postinstall 构建的 native 模块
- scoped 包（`@scope/name`）在 `plugins.entries` 里的 key 是 unscoped 部分

---

## 三、插件入口（index.ts）

官方文档支持两种导出格式：

```typescript
// 格式一：函数（推荐）
export default function register(api) {
  api.registerChannel({ plugin: createYourPlugin() });
}

// 格式二：对象
export default {
  id: 'your-plugin-id',
  name: 'Your Channel',
  register(api) {
    api.registerChannel({ plugin: createYourPlugin() });
  }
};
```

完整示例（包含 CLI 命令注册）：

```typescript
import { createYourPlugin } from './plugin/plugin.js';

export default function register(api: any): void {
  // 1. 注册 Channel（必须）
  api.registerChannel({ plugin: createYourPlugin() });

  // 2. 注册 CLI 命令（推荐，让用户不用手动改 JSON）
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
// plugin/plugin.ts
import path from 'node:path';
import { startInboundMonitor } from './inbound.js';

const pendingPairingCodes = new Map<string, string>();

export function createYourPlugin() {
  return {
    id: 'your-channel-id',

    meta: {
      id: 'your-channel-id',
      label: 'Your Channel',
      selectionLabel: 'Your Channel (description)',
      docsPath: '/channels/your-channel',
      blurb: '一句话描述',
      aliases: ['alias'],
      order: 75,
    },

    capabilities: {
      chatTypes: ['direct'],
      media: true,        // 多模态支持
      polls: false,
      threads: false,
      reactions: false,
      edit: false,
      reply: true,
    },

    config: {
      // ⚠️ channel id 含连字符时必须用方括号写法
      // cfg.channels?.yourChannelId 会读不到配置
      listAccountIds: (cfg: any) =>
        Object.keys(cfg.channels?.['your-channel-id']?.accounts ?? {}),

      resolveAccount: (cfg: any, accountId?: string) =>
        cfg.channels?.['your-channel-id']?.accounts?.[accountId ?? 'default']
        ?? { accountId: accountId ?? 'default' },

      defaultAccountId: () => 'default',
      isEnabled: (account: any) => account.enabled !== false,
      isConfigured: (account: any) =>
        Boolean(account.serverUrl && account.adminToken),
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
              required: ['serverUrl', 'adminToken'],
              properties: {
                enabled: { type: 'boolean' },
                name: { type: 'string' },
                serverUrl: { type: 'string', format: 'uri' },
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
        await fetch(`${account.serverUrl}/api/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-your-admin-token': account.adminToken ?? '',
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            direction: 'outbound',
            text,
          }),
        });
        return { ok: true };
      },

      sendMedia: async ({ mediaUrl, mimeType, conversation, account }: any) => {
        const buf = await fetch(mediaUrl).then(r => r.arrayBuffer());
        const form = new FormData();
        form.append('file', new Blob([buf], { type: mimeType }));
        const up = await fetch(`${account.serverUrl}/api/uploads`, {
          method: 'POST',
          headers: { 'x-your-admin-token': account.adminToken ?? '' },
          body: form,
        });
        const { url } = await up.json() as { url: string };
        await fetch(`${account.serverUrl}/api/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-your-admin-token': account.adminToken ?? '',
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
      loginWithQrStart: async ({ cfg, accountId, timeoutMs }: any) => {
        const account = cfg.channels?.['your-channel-id']?.accounts?.[accountId ?? 'default'];
        const res = await fetch(`${account.serverUrl}/api/pairings`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-your-admin-token': account.adminToken ?? '',
          },
          body: JSON.stringify({ label: account.name, ttlMs: timeoutMs }),
        });
        const pairing = await res.json() as { code: string; claimUrl: string; qrDataUrl?: string };
        pendingPairingCodes.set(accountId ?? 'default', pairing.code);
        return {
          qrDataUrl: pairing.qrDataUrl,
          message: `Use pairing code ${pairing.code} or scan: ${pairing.claimUrl}`,
        };
      },

      loginWithQrWait: async ({ cfg, accountId, timeoutMs }: any) => {
        const account = cfg.channels?.['your-channel-id']?.accounts?.[accountId ?? 'default'];
        const code = pendingPairingCodes.get(accountId ?? 'default');
        if (!code) return { connected: false, message: 'No pending pairing.' };

        const startedAt = Date.now();
        while (Date.now() - startedAt < (timeoutMs ?? 300_000)) {
          const res = await fetch(
            `${account.serverUrl}/api/pairings/${encodeURIComponent(code)}`,
            { headers: { 'x-your-admin-token': account.adminToken ?? '' } }
          );
          const data = await res.json() as { status?: string };
          if (data.status === 'paired') {
            pendingPairingCodes.delete(accountId ?? 'default');
            return { connected: true, message: 'Device paired successfully.' };
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        pendingPairingCodes.delete(accountId ?? 'default');
        return { connected: false, message: 'Pairing timed out.' };
      },

      // ⚠️ 核心：必须永远不返回，直到 abortSignal 触发
      // 来源：官方 GitHub issue #27933
      startAccount: async (ctx: any) => {
        const account = ctx.cfg.channels?.['your-channel-id']
          ?.accounts?.[ctx.accountId ?? 'default'];
        const effectiveAccount = {
          ...account,
          storageDir: account.storageDir || path.resolve('.your-channel/openclaw'),
        };

        const cleanup = await startInboundMonitor(ctx, effectiveAccount);

        try {
          await new Promise<void>((resolve) => {
            if (ctx.abortSignal?.aborted) { resolve(); return; }
            ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
          });
        } finally {
          cleanup?.();
          ctx.setStatus?.({
            accountId: effectiveAccount.accountId,
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
// plugin/inbound.ts
import WebSocket from 'ws';

const activeMonitors = new Map<string, boolean>();

export async function startInboundMonitor(
  gatewayContext: any,
  account: any
): Promise<(() => void) | undefined> {
  const key = account.accountId;
  const log = gatewayContext.log ?? {};
  const abortSignal = gatewayContext.abortSignal as AbortSignal | undefined;

  if (activeMonitors.get(key)) {
    log.warn?.(`Inbound monitor already running for ${key}, skipping`);
    return undefined;
  }
  activeMonitors.set(key, true);

  let stopped = false;
  let currentSocket: WebSocket | null = null;

  // ⚠️ abort 时必须删除 Map 里的 key，否则 Gateway 重启后无法重新连接
  abortSignal?.addEventListener('abort', () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  }, { once: true });

  const wsUrl = `${account.serverUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/ws`
    + `?role=agent`
    + `&adminToken=${encodeURIComponent(account.adminToken ?? '')}`
    + `&accountId=${encodeURIComponent(account.accountId)}`;

  async function connect(): Promise<void> {
    if (stopped) return;

    const socket = new WebSocket(wsUrl);
    currentSocket = socket;

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

        await dispatchInboundMessage({ gatewayContext, account, message: envelope.payload.message });
      } catch (err) {
        log.error?.(`Inbound dispatch failed: ${String(err)}`);
      }
    });

    socket.on('close', (code) => {
      if (currentSocket === socket) currentSocket = null;
      if (stopped || code === 1000) {
        log.info?.(`WebSocket closed normally (${account.accountId})`);
        return;
      }
      log.warn?.(`WebSocket closed (code=${code}), reconnecting in 5s...`);
      setTimeout(() => {
        connect().catch(err => log.error?.(`Reconnect failed: ${String(err)}`));
      }, 5000);
    });

    socket.on('error', (err) => {
      log.error?.(`WebSocket error: ${String(err)}`);
    });

    // 用互相 removeListener 避免 open/error 竞争条件
    await new Promise<void>((resolve, reject) => {
      function onOpen() {
        socket.removeListener('error', onError);
        log.info?.(`WebSocket connected (${account.accountId})`);
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

    // 心跳保活
    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30_000);
    socket.once('close', () => clearInterval(heartbeat));
  }

  try {
    await connect();
  } catch (err) {
    activeMonitors.delete(key);
    throw err;
  }

  return () => {
    stopped = true;
    activeMonitors.delete(key);
    currentSocket?.close(1000, 'plugin stop');
    currentSocket = null;
  };
}

async function dispatchInboundMessage({ gatewayContext, account, message }: any) {
  const log = gatewayContext.log ?? {};
  const channelRuntime = gatewayContext.channelRuntime;

  if (!channelRuntime) {
    log.warn?.('channelRuntime unavailable');
    return;
  }

  const route = channelRuntime.routing.resolveAgentRoute?.({
    cfg: gatewayContext.cfg,
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
    cfg: gatewayContext.cfg,
    dispatcherOptions: {
      deliver: async (payload: any) => {
        await fetch(`${account.serverUrl}/api/messages`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-your-admin-token': account.adminToken ?? '',
          },
          body: JSON.stringify({
            conversationId: message.conversationId,
            direction: 'outbound',
            text: payload.text ?? '',
            senderId: `openclaw:${account.accountId}`,
            attachments: payload.mediaUrls?.length
              ? payload.mediaUrls.map((url: string) => ({ url }))
              : undefined,
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

## 六、用户配置（openclaw.json）

```json
{
  "channels": {
    "your-channel-id": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "enabled": true,
          "name": "My Channel",
          "serverUrl": "http://your-server:8788",
          "adminToken": "your-admin-token-here"
        }
      }
    }
  },
  "plugins": {
    "entries": {
      "your-plugin-id": {
        "enabled": true
      }
    }
  }
}
```

**⚠️ channel id 含连字符时（如 `trix-native`），TypeScript 读取必须用 `cfg.channels?.['trix-native']`，写成驼峰 `cfg.channels?.trixNative` 会静默读不到配置。**

---

## 七、零配置安装流程

### 用户操作（4 条命令，不碰任何 JSON）

```bash
openclaw plugins install @your-scope/your-plugin
openclaw gateway restart
openclaw yourchannel setup    # 弹出配对码，扫码即完成
openclaw gateway restart
```

### setup 命令实现

```typescript
// setup.ts
import { execSync } from 'child_process';

export async function runSetup(api: any) {
  const DEFAULT_SERVER = 'http://your-server:8788';

  const plugin = createYourPlugin();
  const { message } = await plugin.gateway.loginWithQrStart({
    cfg: api.config,
    accountId: 'default',
    timeoutMs: 300_000,
  });

  console.log(`\n${message}\n`);
  console.log('等待设备配对...\n');

  const result = await plugin.gateway.loginWithQrWait({
    cfg: api.config,
    accountId: 'default',
    timeoutMs: 300_000,
  });

  if (!result.connected) {
    console.error(`\n✗ ${result.message}`);
    process.exit(1);
  }

  // 配对成功后自动写入配置
  execSync(`openclaw config set channels.your-channel-id.accounts.default.serverUrl "${DEFAULT_SERVER}"`);
  execSync(`openclaw config set channels.your-channel-id.accounts.default.enabled true`);
  execSync(`openclaw config set channels.your-channel-id.accounts.default.name "Your Channel"`);

  console.log(`\n✓ ${result.message}`);
  console.log('运行 openclaw gateway restart 使配置生效\n');
}
```

---

## 八、服务器端要求

### WebSocket 端点格式

```
ws://your-server/ws?role=agent&adminToken=xxx&accountId=xxx
```

服务器必须：
1. 支持 `role=agent` 参数，允许 Plugin 连接
2. 收到 inbound 消息时，向所有 `role=agent` 连接广播
3. 响应 `ping` 帧（服务端加 `socket.on('ping', () => socket.pong())`）

### 广播消息格式

```json
{
  "type": "message.created",
  "payload": {
    "message": {
      "id": "msg_abc123",
      "conversationId": "conv_xyz456",
      "direction": "inbound",
      "text": "用户发的消息",
      "senderId": "client_xxx",
      "senderName": "用户名",
      "createdAt": 1234567890000,
      "attachments": []
    }
  }
}
```

### 消息方向约定

| direction | 含义 | 前端气泡 |
|-----------|------|---------|
| `inbound` | 用户发给 Agent | 右侧（自己） |
| `outbound` | Agent 回复给用户 | 左侧（对方） |

**前端判断：`direction === 'inbound' ? 'user' : 'bot'`**

---

## 九、调试检查清单

```bash
# 1. Gateway 正常运行
openclaw gateway status
# 期望：RPC probe: ok

# 2. Channel 状态（最关键）
openclaw channels status
# 期望：your-channel default: enabled, configured, running
# ❌ 显示 configured 而非 running → startAccount 提前返回了

# 3. 日志检查
openclaw logs --limit 20 | grep your-channel
# 期望：WebSocket connected (default)，只出现一次
# ❌ 循环出现 closed / auto-restart → startAccount 提前返回

# 4. 服务器稳定性
ssh user@server "pm2 status"
# 期望：online，restarts < 3

# 5. Token 一致性验证
openclaw config get channels.your-channel-id.accounts.default.adminToken
ssh user@server "cat /path/to/state.json | grep adminToken"
# 两个值必须完全一致
```

---

## 十、常见错误速查

| 错误 | 原因 | 解决 |
|------|------|------|
| `unknown channel id: xxx` | `openclaw.plugin.json` 缺少 `channels` | 加 `"channels": ["your-channel-id"]` |
| `plugin id mismatch` | `id` 与 `package.json` name 不一致 | 统一为 unscoped name |
| Channel 显示 `configured` 不是 `running` | `startAccount` 提前返回 | 加 `await new Promise + abortSignal`（issue #27933） |
| `auto-restart attempt X/10` | 同上 | 同上 |
| `Inbound monitor already running` | abort 时未清理 Map | `abortSignal` 里加 `activeMonitors.delete(key)` |
| `socket hang up` | 服务器崩溃 | `pm2 restart` 查日志 |
| WebSocket code=4000 | 服务器主动拒绝 | 检查 adminToken，服务器是否处理 role=agent |
| WebSocket code=1006 | 网络断开 | 正常，5 秒自动重连 |
| 消息气泡方向反 | sender 判断逻辑错误 | `direction === 'inbound' ? 'user' : 'bot'` |
| config 读不到 | 驼峰 vs 连字符 | 用 `cfg.channels?.['your-channel-id']` |
| Socket.IO vs 原生 WS | 协议不兼容 | 统一用 `ws` 库，不用 socket.io-client |

---

*信息来源：*
*1. 官方文档 https://docs.openclaw.ai/tools/plugin*
*2. 官方 GitHub issue #27933（startAccount 机制的权威说明，含真实 Gateway 源码片段）*
*3. 官方 GitHub issue #18330（channels 字段声明规则）*
*4. MindDock/OpenClaw-Dev-Guide（Channel Plugin 开发指导）*
*5. 真实调试 OpenClaw 2026.3.13 的经验总结*