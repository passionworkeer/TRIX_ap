# OpenClaw 配对方式详细实现报告

> 最后更新: 2026-03-19
>
> 📌 **说明**: 本文档是配对实现的历史详解。当前最新规范参考 [openclaw_reference.md](./openclaw_reference.md)。

---

## 一、概述

OpenClaw 支持两种通道的配对方式：

| 通道类型 | 协议 | 用途 |
|---------|------|------|
| **Clawbot Channel** | Socket.IO | 云端消息服务 |
| **TRIX Native Channel** | HTTP/WebSocket | 原生通道服务 |

---

## 二、TRIX Native Channel 配对实现

这是当前项目主要的配对方式，基于 `trix-openclaw-native` 包实现。

### 2.1 配对流程架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRIX Native Channel 配对流程                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [服务器端]                          [客户端]                                │
│  ┌──────────────┐                  ┌──────────────┐                        │
│  │ TrixNative   │                  │   Web 前端   │                        │
│  │ Server       │◄─────────────────►│  TrixNative  │                        │
│  │ (:8788)      │    HTTP REST      │  Channel     │                        │
│  └──────────────┘                  └──────────────┘                        │
│         │                                   │                                │
│         │  WebSocket                       │                                │
│         │  /ws                             │                                │
│         ▼                                   ▼                                │
│  ┌──────────────┐                  ┌──────────────┐                        │
│  │ JSON State   │                  │ localStorage │                        │
│  │ Store         │                  │ Session      │                        │
│  │ (持久化)     │                  │ (持久化)     │                        │
│  └──────────────┘                  └──────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心文件结构

```
packages/trix-openclaw-native/
├── src/
│   ├── server/
│   │   └── TrixNativeServer.ts      # 服务器主程序
│   ├── pairing/
│   │   └── PairingService.ts        # 配对服务核心逻辑
│   ├── storage/
│   │   └── JsonStateStore.ts        # 状态持久化存储
│   ├── types.ts                     # 类型定义
│   └── plugin/
│       └── plugin.ts                 # OpenClaw 插件入口
```

---

## 三、配对码生成 (服务器端)

**文件**: `packages/trix-openclaw-native/src/pairing/PairingService.ts`

### 核心逻辑

```typescript
// 创建配对 - create() 方法
async create(input: PairingCreateInput): Promise<PairingCreatedResponse> {
  const code = randomPairingCode();        // 生成 6-8 位配对码
  const secret = randomToken(18);          // 生成 18 位随机 secret
  const conversationId = randomId('conv', 10);

  // 构建配对 URL: http://host/pair?code=XXX&secret=YYY
  const claimUrl = `${input.publicBaseUrl}/pair?code=${code}&secret=${secret}`;

  // 生成二维码图片
  const qrDataUrl = await QRCode.toDataURL(claimUrl, { margin: 1, width: 320 });

  // 配对记录
  const pairing: PairingRecord = {
    code,
    secret,
    label: input.label,
    createdAt,
    expiresAt: createdAt + (input.ttlMs ?? DEFAULT_TTL_MS), // 默认 1 小时
    status: 'pending',
    conversationId,
    claimUrl,
    qrDataUrl,
  };

  // 会话记录
  const conversation: ConversationRecord = {
    id: conversationId,
    pairingCode: code,
    openClawSessionKey: input.openClawSessionKey,
    participants: [],
  };

  // 持久化存储
  await this.store.update(...);

  return { ...pairing, websocketUrl: ... };
}
```

### 关键参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `code` | 6-8 位配对码 | 随机生成 |
| `secret` | 18 位随机秘钥 | 随机生成 |
| `ttlMs` | 有效期 | 3600000ms (1小时) |
| `conversationId` | 会话 ID | `conv_` + 10位随机 |

---

## 四、配对认领 (Claim) 流程

**文件**: `packages/trix-openclaw-native/src/pairing/PairingService.ts`

### 核心逻辑

```typescript
// 客户端认领配对 - claim() 方法
async claim(input: PairingClaimInput, websocketUrl: string): Promise<PairingClaimResponse> {
  const clientToken = randomToken(20);  // 为客户端生成认证 Token

  await this.store.update((state) => {
    // 验证配对码和 secret
    if (entry.expiresAt <= Date.now()) {
      throw new Error('Pairing code expired');
    }
    if (input.secret && entry.secret !== input.secret) {
      throw new Error('Invalid pairing secret');
    }

    // 更新配对状态为 paired
    claimedPairing = {
      ...entry,
      status: 'paired',
      pairedAt: Date.now(),
      pairedClientId: input.clientId,
      pairedDeviceName: input.deviceName,
      clientToken,
    };

    // 添加参与者到会话
    const conversations = state.conversations.map((conversation) => {
      if (conversation.id !== claimedPairing!.conversationId) return conversation;
      return {
        ...conversation,
        participants: [
          ...conversation.participants,
          {
            clientId: input.clientId,
            deviceName: input.deviceName,
            role: 'user',
            clientToken,
            connectedAt: Date.now(),
          },
        ],
      };
    });
  });

  return {
    conversationId: claimedPairing!.conversationId,
    clientToken,
    websocketUrl,
    pairing: claimedPairing!,
  };
}
```

---

## 五、服务器端 HTTP API

**文件**: `packages/trix-openclaw-native/src/server/TrixNativeServer.ts`

### API 列表

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/api/pairings` | 创建配对码 | Admin Token |
| GET | `/api/pairings` | 列出所有配对 | Admin Token |
| GET | `/api/pairings/:code` | 获取配对状态 | Admin Token |
| POST | `/api/pairings/:code/claim` | 认领配对 | Client Info |
| GET | `/api/conversations/:id/messages` | 获取消息历史 | Client Token |
| POST | `/api/messages` | 发送消息 | Client Token |

### 认领 API 详情

```typescript
// POST /api/pairings/:code/claim
// Request Body
{
  "clientId": "web_abc123...",      // 客户端唯一 ID
  "deviceName": "TRIX-Browser",     // 设备名称
  "secret": "optional_secret"       // 可选的秘钥
}

// Response
{
  "conversationId": "conv_xxx",
  "clientToken": "token_xxx",       // 用于后续认证
  "websocketUrl": "ws://host/ws",
  "serverUrl": "http://host",
  "agentOnline": true,
  "pairing": {
    "code": "ABC123",
    "status": "paired",
    "pairedAt": 1234567890
  }
}
```

---

## 六、客户端实现 (Web 前端)

**文件**: `src/services/TrixNativeChannelClient.ts`

### 6.1 配对码方式

```typescript
async pairWithCode(code: string, deviceName: string, secret?: string) {
  const serverUrl = getClawbotEndpoints().nativeServerUrl;

  // 调用服务器 API 认领配对
  const response = await fetch(`${serverUrl}/api/pairings/${code}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, deviceName, secret }),
  });

  const claim = await response.json();

  // 保存会话到 localStorage
  this.saveSession({
    serverUrl: claim.serverUrl || serverUrl,
    websocketUrl: claim.websocketUrl,
    conversationId: claim.conversationId,
    clientToken: claim.clientToken,
    clientId,
    deviceName,
    pairingCode: claim.pairing.code,
  });

  // 建立 WebSocket 连接
  await this.connect();
}
```

### 6.2 二维码方式

```typescript
async pairWithQR(rawPayload: string, deviceName: string) {
  // 解析二维码内容
  const parsed = parseQrOrClaimPayload(rawPayload);
  // 返回: { serverUrl, code, secret }

  // 调用配对认领 API
  const response = await fetch(`${serverUrl}/api/pairings/${parsed.code}/claim`, {
    method: 'POST',
    body: JSON.stringify({ clientId, deviceName, secret: parsed.secret }),
  });

  // 保存会话并连接...
}
```

### 6.3 二维码解析逻辑

```typescript
function parseQrOrClaimPayload(rawInput: string): {
  serverUrl?: string;
  code: string;
  secret?: string;
} {
  // 1. 尝试解析 JSON 格式
  // { "code": "ABC123", "secret": "xxx", "serverUrl": "http://..." }
  if (typeof parsed.code === 'string') {
    return { serverUrl: parsed.serverUrl, code: parsed.code, secret: parsed.secret };
  }

  // 2. 尝试解析 URL 格式
  // http://host/pair?code=XXX&secret=YYY
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    return {
      serverUrl: `${url.protocol}//${url.host}`,
      code: url.searchParams.get('code'),
      secret: url.searchParams.get('secret'),
    };
  }

  // 3. 尝试解析 compact 格式
  // ABC123:SECRET
  if (compact.includes(':')) {
    const [code, secret] = compact.split(':');
    return { code, secret };
  }

  // 4. 纯配对码格式
  // ABC123
  if (/^[A-Z0-9]{6,8}$/.test(normalizedCode)) {
    return { code: normalizedCode };
  }
}
```

---

## 七、会话持久化

### localStorage 存储结构

```typescript
const STORAGE_KEYS = {
  session: 'trix_native_channel_session',
  clientId: 'trix_native_channel_client_id',
} as const;

// Session 结构
interface StoredSession {
  serverUrl: string;          // 服务器地址
  websocketUrl: string;        // WebSocket 地址
  conversationId: string;      // 会话 ID
  clientToken: string;        // 客户端认证 Token
  clientId: string;           // 客户端唯一 ID
  deviceName?: string;        // 设备名称
  pairingCode?: string;       // 配对码
}
```

---

## 八、Clawbot Channel (云端) 配对实现

这是早期的云端 Socket.IO 协议配对方式 (iOS 客户端)。

### 核心文件

| 文件 | 位置 |
|------|------|
| `ClawbotChannelService.swift` | `ios/TRIX3DCompanion/Core/Services/` |
| `ClawbotPairingService.swift` | `ios/TRIX3DCompanion/Core/Services/` |

### iOS 配对实现

```swift
// 配对码方式
func pairWithCode(_ code: String) async throws -> Bool {
  let normalizedCode = code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

  return try await withCheckedThrowingContinuation { continuation in
    socket.emitWithAck("pair_with_code", ["code": normalizedCode, "userId": userId]) { response in
      // 处理响应...
    }
  }
}

// 二维码方式
func pairWithQR(_ qrData: String) async throws -> Bool {
  return try await pairWithToken(qrData)
}

// Token 解析
func pairWithToken(_ token: String) async throws -> Bool {
  // 解析 JSON 格式
  if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
    qrToken = json["token"] as? String ?? json["pairingToken"] as? String
  }

  // 解析前缀格式: trix:pair:TOKEN
  if normalizedData.hasPrefix("trix:pair:") {
    qrToken = String(normalizedData.dropFirst(10))
  }

  // 发送配对请求
  socket.emitWithAck("pair_with_token", ["token": finalToken, "userId": userId]) { ... }
}
```

---

## 九、OpenClaw 插件集成

**文件**: `packages/trix-openclaw-native/src/plugin/plugin.ts`

```typescript
export function createTrixNativePlugin() {
  return {
    id: 'trix-native',
    meta: {
      label: 'TRIX Native',
      blurb: 'TRIX pairing + QR + LAN + multimodal native channel.',
    },
    configSchema: {
      schema: {
        properties: {
          enabled: { type: 'boolean' },
          defaultAccount: { type: 'string' },
          accounts: {
            type: 'object',
            additionalProperties: {
              properties: {
                enabled: { type: 'boolean' },
                name: { type: 'string' },
                serverUrl: { type: 'string', format: 'uri' },
                publicBaseUrl: { type: 'string', format: 'uri' },
                adminToken: { type: 'string' },
              },
            },
          },
        },
      },
    },
    gateway: {
      // 创建配对二维码
      loginWithQrStart: async ({ cfg, accountId, timeoutMs }) => {
        const account = resolveAccount(cfg, accountId);
        const response = await fetch(`${account.serverUrl}/api/pairings`, {
          method: 'POST',
          headers: { 'x-trix-admin-token': account.adminToken },
          body: JSON.stringify({ label: account.name, ttlMs }),
        });
        const pairing = await response.json();
        return { qrDataUrl: pairing.qrDataUrl };
      },

      // 等待配对完成
      loginWithQrWait: async ({ cfg, accountId, timeoutMs }) => {
        const pairingCode = pendingPairingCodeByAccount.get(accountKey);
        while (Date.now() - startedAt < timeoutMs) {
          const response = await fetch(`${account.serverUrl}/api/pairings/${pairingCode}`);
          const pairing = await response.json();
          if (pairing.status === 'paired') {
            return { connected: true };
          }
          await sleep(1000);
        }
        return { connected: false };
      },
    },
  };
}
```

---

## 十、配对状态机

```
                    ┌──────────────┐
                    │              │
                    │   创建配对    │
                    │  (pending)   │
                    └──────┬───────┘
                           │
                    用户扫描二维码
                    或输入配对码
                           │
                           ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   过期       │    │              │    │              │
│  (expired)   │───►│  认领配对    │───►│   已配对     │
│              │    │  (claiming)  │    │  (paired)    │
└──────────────┘    └──────────────┘    └──────────────┘
                           │                    │
                           │                    │ 用户解绑
                           ▼                    ▼
                    ┌──────────────┐    ┌──────────────┐
                    │    失败      │    │   已解绑     │
                    │  (failed)   │    │  (unpaired)  │
                    └──────────────┘    └──────────────┘
```

---

## 十一、关键数据结构

### 11.1 PairingRecord

```typescript
interface PairingRecord {
  code: string;              // 配对码 (如 "ABC123")
  secret: string;            // 秘钥 (用于二维码)
  label?: string;            // 设备标签
  createdAt: number;         // 创建时间戳
  expiresAt: number;         // 过期时间戳
  status: 'pending' | 'paired' | 'expired';
  conversationId: string;    // 会话 ID
  claimUrl: string;          // 配对链接
  qrDataUrl?: string;        // 二维码 Data URL
  pairedAt?: number;         // 配对成功时间
  pairedClientId?: string;   // 配对的客户端 ID
  pairedDeviceName?: string; // 设备名称
  clientToken?: string;      // 客户端认证 Token
}
```

### 11.2 ConversationRecord

```typescript
interface ConversationRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  pairingCode: string;
  openClawSessionKey?: string;
  participants: Array<{
    clientId: string;
    deviceName?: string;
    role: 'user' | 'agent';
    clientToken?: string;
    connectedAt?: number;
    lastSeenAt?: number;
  }>;
}
```

---

## 十二、配置与认证

### 12.1 环境变量

```bash
# TRIX Native Server
VITE_TRIX_NATIVE_SERVER_URL=http://TRIX_SERVER_HOST:8788

# Admin Token (服务器端)
TRIX_NATIVE_ADMIN_TOKEN=xxx
```

### 12.2 认证机制

| 场景 | 认证方式 |
|------|----------|
| Admin 操作 (创建配对) | `X-Trix-Admin-Token` Header |
| 客户端操作 (发送消息) | `X-Trix-Client-Token` Header |
| WebSocket 连接 | Query Params: `role`, `conversationId`, `clientToken` |

---

## 十三、相关文件索引

### 服务器端

| 文件 | 说明 |
|------|------|
| `packages/trix-openclaw-native/src/server/TrixNativeServer.ts` | HTTP/WebSocket 服务器 |
| `packages/trix-openclaw-native/src/pairing/PairingService.ts` | 配对服务核心逻辑 |
| `packages/trix-openclaw-native/src/storage/JsonStateStore.ts` | 状态持久化存储 |
| `packages/trix-openclaw-native/src/types.ts` | 类型定义 |
| `packages/trix-openclaw-native/src/plugin/plugin.ts` | OpenClaw 插件入口 |

### 客户端 (Web)

| 文件 | 说明 |
|------|------|
| `src/services/TrixNativeChannelClient.ts` | 配对、消息、连接管理 |

### 客户端 (iOS)

| 文件 | 说明 |
|------|------|
| `ios/TRIX3DCompanion/Core/Services/ClawbotChannelService.swift` | Socket.IO 连接与配对 |
| `ios/TRIX3DCompanion/Core/Services/ClawbotPairingService.swift` | 配对管理 |

---

## 十四、总结

OpenClaw 的配对实现是一个完整的端到端系统：

1. **服务器端** (`trix-openclaw-native`)
   - `TrixNativeServer.ts` - HTTP/WebSocket 服务器
   - `PairingService.ts` - 配对核心逻辑
   - `JsonStateStore.ts` - 持久化存储

2. **客户端** (Web)
   - `TrixNativeChannelClient.ts` - 配对、消息、连接管理

3. **客户端** (iOS)
   - `ClawbotChannelService.swift` - Socket.IO 连接
   - `ClawbotPairingService.swift` - 配对管理

4. **OpenClaw 集成**
   - `plugin.ts` - 插件配置和网关集成
