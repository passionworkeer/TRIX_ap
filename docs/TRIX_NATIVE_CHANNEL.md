# TRIX Native Channel 完整文档

> **版本**: `@trix-app/openclaw-native-channel` v0.1.0
> **最后更新**: 2026-03-19
> **三端支持**: Web · iOS · Windows 桌面

本文档是 TRIX Native Channel 的唯一权威文档，涵盖架构设计、配对协议、三端实现和调试方法。

---

## 一、概述

TRIX Native Channel 是 `trix-openclaw-native` 包实现的一套设备配对和消息通信系统，架构如下：

```
┌──────────────────────────────────────────────────────────┐
│                      TRIX Native Channel                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐   HTTP/WebSocket    ┌─────────────────┐  │
│  │  前端/桌面  │ ◄─────────────────► │  Native Server  │  │
│  │ (Web/iOS)  │    role=user        │  (:18789)       │  │
│  └────────────┘                     └────────┬────────┘  │
│                                               │             │
│  ┌────────────┐   HTTP/WebSocket    ┌────────▼────────┐  │
│  │ OpenClaw   │ ◄─────────────────► │  Gateway (:18789) │  │
│  │ Plugin     │    role=agent        │                   │  │
│  └────────────┘                     └────────┬────────┘  │
│                                               │             │
│                                               ▼             │
│                                       ┌─────────────┐     │
│                                       │   Agent     │     │
│                                       │  (TRIX AI)  │     │
│                                       └─────────────┘     │
└──────────────────────────────────────────────────────────┘
```

### 核心特性

- **原生 OpenClaw 插件**：完整实现 OpenClaw Channel 接口
- **QR 码配对**：URL 格式 `http://host/pair?code=XXX&secret=YYY`
- **WebSocket 实时通信**：双向消息推送
- **多模态支持**：文本、图片、音频、视频、文件
- **JWT Token 认证**：clientToken + adminToken 分层

---

## 二、配对协议

### 2.1 QR 码格式（统一）

桌面端生成的 QR 码内容：

```
http://127.0.0.1:18789/pair?code=ABCDEF12&secret=R8s9KxMnPqLvW
```

| 字段 | 说明 | 示例 |
|------|------|------|
| `code` | 8 位大写字母数字配对码 | `ABCDEF12` |
| `secret` | 18 位随机密钥 | `R8s9KxMnPqLvW...` |
| `ttlMs` | 有效期，默认 1 小时 | `3600000` |

### 2.2 三端支持的输入格式

| 格式 | 示例 | Web | iOS | 桌面 |
|------|------|-----|-----|------|
| URL 格式 | `http://host/pair?code=XXX&secret=YYY` | ✅ | ✅ | — |
| JSON 格式 | `{"code":"XXX","secret":"YYY"}` | ✅ | ✅ | — |
| 复合格式 | `CODE:SECRET` | ✅ | ✅ | — |
| 纯配对码 | `ABCDEF12` | ✅ | ✅ | — |

### 2.3 配对状态机

```
┌─────────────┐
│   pending   │  ← 创建配对码后
└──────┬──────┘
       │ 扫描/认领
       ▼
┌─────────────┐    超时       ┌─────────────┐
│   paired    │──────────────►│  expired    │
└─────────────┘               └─────────────┘
       │ 解绑
       ▼
┌─────────────┐
│  unpaired   │
└─────────────┘
```

### 2.4 HTTP API

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/pairings` | POST | Admin Token | 创建配对码 |
| `/api/pairings` | GET | Admin Token | 列出所有配对 |
| `/api/pairings/:code` | GET | Admin Token | 获取配对状态 |
| `/api/pairings/:code/claim` | POST | 无 | 认领配对 |

### 2.5 WebSocket 协议

连接 URL：
```
ws://host/ws?role=user&conversationId=xxx&clientId=xxx&clientToken=xxx  # 客户端
ws://host/ws?role=agent&accountId=xxx&serviceToken=xxx               # Agent
```

---

## 三、OpenClaw 插件规范

> 以下是 OpenClaw Channel 插件的硬性要求，违反会导致 auto-restart 循环。

### 3.1 `startAccount` 必须永远不返回

**这是被 7 个官方 issue 反复确认的核心规则。**

Gateway 内部逻辑：
```javascript
const task = startAccount(ctx);
Promise.resolve(task)
  .catch(err => { /* set lastError */ })
  .finally(() => { setRuntime(channelId, id, { running: false }); })
  .then(async () => { /* ← auto-restart 触发 */ });
```

**结论：`Promise resolve = channel stopped = auto-restart 触发。**

正确模式：
```typescript
gateway: {
  startAccount: async (ctx) => {
    const cleanup = await startInboundMonitor(ctx, account);

    // ⚠️ 必须：挂起直到 abortSignal，不是等 WebSocket 断开
    try {
      await new Promise<void>((resolve) => {
        if (ctx.abortSignal?.aborted) { resolve(); return; }
        ctx.abortSignal?.addEventListener('abort', () => resolve(), { once: true });
      });
    } finally {
      cleanup?.();
      ctx.setStatus?.({ accountId, running: false, lastStopAt: Date.now() });
    }
  }
}
```

### 3.2 Plugin 文件结构

```
trix-openclaw-native/
├── src/index.ts              # npm 包主入口 + OpenClaw 插件入口
├── openclaw.plugin.json      # 必须：声明 channels 数组
└── package.json              # 必须：含 openclaw 字段
```

**`openclaw.plugin.json` 硬性要求：**
- `id` 必须与 `package.json` name 的 unscoped 部分一致
- `channels` 数组必须存在，声明 channel id（否则报 `unknown channel id`）

**`package.json` 硬性要求：**
- `openclaw` 必须在 `peerDependencies`
- `extensions` 指向 `.ts` 文件（jiti 运行时加载）
- `install.npmSpec` 指向自身包名

### 3.3 `channel id` 含连字符时

配置文件中使用方括号语法：

```typescript
// ✅ 正确
cfg.channels?.['trix-native']?.accounts?.default

// ❌ 错误（静默读不到）
cfg.channels?.trixNative?.accounts?.default
```

---

## 四、配置

### 4.1 桌面端 Gateway 配置

`~/.openclaw/openclaw.json` 或 `openclaw.json`：

```json
{
  "channels": {
    "trix-native": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "enabled": true,
          "name": "TRIX Native",
          "serverUrl": "http://127.0.0.1:18789",
          "adminToken": "<从 state.json 读取>"
        }
      }
    }
  },
  "plugins": {
    "load": {
      "paths": ["/path/to/trix-openclaw-native"]
    }
  }
}
```

### 4.2 状态存储路径

Gateway 和 IPC Handler 统一使用 `app.getPath('userData')`：

```
{userData}/state.json
```

Gateway 通过 `TRIX_NATIVE_STORAGE_DIR` 环境变量传入，IPC Handler 直接读取 `app.getPath('userData')`。

---

## 五、数据结构

### PairingRecord

```typescript
interface PairingRecord {
  code: string;              // 配对码 (8位大写字母数字)
  secret: string;            // 配对密钥 (18位)
  label?: string;            // 设备标签
  createdAt: number;          // 创建时间戳
  expiresAt: number;         // 过期时间戳
  status: 'pending' | 'paired' | 'expired';
  conversationId: string;    // 关联会话 ID
  claimUrl: string;          // 认领 URL
  qrDataUrl?: string;        // QR 码 Data URL
  pairedAt?: number;         // 配对时间
  pairedClientId?: string;   // 配对的客户端 ID
  pairedDeviceName?: string; // 设备名称
  clientToken?: string;      // 客户端认证 Token
}
```

### ConversationRecord

```typescript
interface ConversationRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  pairingCode: string;
  participants: Array<{
    clientId: string;
    deviceName?: string;
    role: 'user' | 'agent';
    clientToken?: string;
    connectedAt?: number;
  }>;
}
```

---

## 六、三端实现

### 6.1 Web 前端

**文件**: `src/services/TrixNativeChannelClient.ts`

```typescript
import trixNativeChannelClient from '@/services/TrixNativeChannelClient';

// 扫码配对
await client.pairWithQR('http://host/pair?code=XXX&secret=YYY');

// 手动配对码
await client.pairWithCode('ABCDEF12');

// 监听事件
client.on('connected', (data) => { /* ... */ });
client.on('message', (msg) => { /* ... */ });
client.on('pairing_success', (data) => { /* ... */ });
```

**Context**: `src/contexts/ClawbotChannelContext.tsx` → `useClawbotChannel()`

### 6.2 iOS 端

**核心文件**:
- `ios/TRIX3DCompanion/Core/Services/ClawbotChannelService.swift` — HTTP/WebSocket 客户端
- `ios/TRIX3DCompanion/App/ClawbotChannelViewModel.swift` — 配对状态管理

```swift
// 扫码配对（自动识别 URL 格式）
try await viewModel.pairWithQR(qrContent)

// 手动配对码
try await viewModel.pairWithCode("ABCDEF12")

// 解绑
viewModel.unpair()
```

### 6.3 Windows 桌面端

**Float 悬浮窗** (`desktop/src/renderer/float.tsx`):
- 点击"📱 显示配对 QR"按钮
- 底部面板显示 QR 码（base64 PNG）
- 每 2 秒轮询状态
- 配对成功后 3 秒自动关闭面板

**IPC Handler** (`desktop/src/main/ipc.ts`):
- `pairing:createQr` → `POST /api/pairings`
- `pairing:pollStatus` → `GET /api/pairings/:code`

---

## 七、调试

### 7.1 Gateway 状态检查

```bash
openclaw gateway status    # RPC probe: ok?
openclaw channels status   # enabled, configured, running
openclaw logs --follow     # 实时日志
```

### 7.2 服务器健康检查

```bash
# Gateway
curl http://127.0.0.1:18789/health

# Native Server
curl http://127.0.0.1:18789/api/pairings \
  -H "x-trix-admin-token: <token>"
```

### 7.3 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Channel 显示 `configured` 非 `running` | `startAccount` 提前返回 | 加 `await abortSignal Promise` |
| `unknown channel id` | `openclaw.plugin.json` 缺 `channels` | 添加 `"channels": ["trix-native"]` |
| 配置读不到 | 驼峰 vs 连字符 | 用 `cfg.channels?.['trix-native']` |
| QR panel 按钮无法点击 | `-webkit-app-region: drag` | 按钮加 `-webkit-app-region: no-drag` |
| IPC pairing 失败 | `state.json` 路径错误 | 确认 Gateway 和 IPC 用同一目录 |

---

## 八、关键文件索引

| 文件 | 说明 |
|------|------|
| `packages/trix-openclaw-native/src/server/TrixNativeServer.ts` | HTTP/WebSocket 服务器 |
| `packages/trix-openclaw-native/src/pairing/PairingService.ts` | 配对服务核心逻辑 |
| `packages/trix-openclaw-native/src/storage/JsonStateStore.ts` | JSON 持久化存储 |
| `packages/trix-openclaw-native/src/plugin/plugin.ts` | Plugin 入口、`startAccount` |
| `packages/trix-openclaw-native/src/plugin/inbound.ts` | 接收消息（`startInboundMonitor`） |
| `packages/trix-openclaw-native/src/plugin/outbound.ts` | 发送消息（`postReply`） |
| `packages/trix-openclaw-native/src/types.ts` | 类型定义 |
| `src/services/TrixNativeChannelClient.ts` | Web 前端客户端 |
| `src/contexts/ClawbotChannelContext.tsx` | Web React Context |
| `ios/TRIX3DCompanion/Core/Services/ClawbotChannelService.swift` | iOS HTTP/WebSocket 客户端 |
| `ios/TRIX3DCompanion/App/ClawbotChannelViewModel.swift` | iOS 配对 ViewModel |
| `desktop/src/main/ipc.ts` | 桌面端 IPC（含配对 QR） |
| `desktop/src/renderer/float.tsx` | 桌面 Float 悬浮窗 UI |

---

**最后更新**: 2026-03-19
