# TRIX Native OpenCLAW Channel - 配对系统架构文档

## 1. 概述

TRIX Native OpenCLAW Channel 是一个原生 OpenCLAW 插件，实现了类似 WhatsApp/飞书的设备配对和消息通信系统。支持 QR 码扫描配对、WebSocket 实时通信、多模态消息（文本/图片/音频/视频）。

### 核心特性

- **原生 OpenCLAW 插件**: 完整实现 OpenCLAW 插件接口
- **多设备配对**: 支持 QR 码扫描和手动输入配对码
- **WebSocket 实时通信**: 双向实时消息推送
- **多模态支持**: 文本、图片、音频、视频、文件
- **JWT 安全认证**: 客户端 Token 验证机制

## 2. 架构设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIX Native Channel                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Frontend   │    │    Server    │    │   OpenCLAW Plugin  │  │
│  │  (Web/App)   │◄──►│  (HTTP+WS)   │◄──►│  (Agent Gateway)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                   │                      │             │
│         │                   │                      │             │
│    QR Scan            Pairing API             Inbound/Outbound    │
│    WebSocket          Message API             Message Routing     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 组件说明

| 组件 | 职责 | 技术栈 |
|------|------|--------|
| Frontend | 设备配对、消息收发、WebSocket 连接 | TypeScript, WebSocket |
| Server | HTTP API、WebSocket 服务、消息存储 | Node.js, ws, JSON Store |
| OpenCLAW Plugin | 与 OpenCLAW 集成、消息路由 | OpenCLAW Plugin SDK |

## 3. 配对流程

### 3.1 QR 码扫描配对

```
┌─────────────┐                                    ┌──────────────────┐
│   OpenCLaw  │                                    │   TRIX Server    │
│   (Agent)   │                                    │                  │
└──────┬──────┘                                    └────────┬─────────┘
       │                                                   │
       │ 1. loginWithQrStart()                            │
       │ ───────────────────────────────────────────────►  │
       │                                                   │
       │                    2. Create pairing code         │
       │                    3. Generate QR Data URL       │
       │                                                   │
       │                          Response                 │
       │ ◄──────────────────────────────────────────────  │
       │    { code, qrDataUrl, claimUrl }                 │
       │                                                   │
       │ 4. Display QR Code                               │
       │                                                   │
       │                        5. User scans QR           │
       │                        6. Frontend claims pairing  │
       │                        7. WebSocket connects       │
       │                                                   │
       │ 8. loginWithQrWait()                             │
       │ ───────────────────────────────────────────────► │
       │                                                   │
       │                   9. Poll pairing status            │
       │                   10. Status: paired            │
       │                                                   │
       │                          Response                 │
       │ ◄──────────────────────────────────────────────  │
       │    { connected: true }                          │
       │                                                   │
```

### 3.2 手动输入配对码

```
Frontend                                          Server
   │                                               │
   │  1. User inputs pairing code                  │
   │  2. POST /api/pairings/{code}/claim           │
   │ ──────────────────────────────────────────►   │
   │                                               │
   │              3. Validate code                 │
   │              4. Create session                │
   │              5. Generate clientToken          │
   │                                               │
   │              Response                         │
   │ ◄─────────────────────────────────────────    │
   │  {                                            │
   │    conversationId,                            │
   │    clientToken,                               │
   │    websocketUrl,                              │
   │    serverUrl,                                 │
   │    pairing                                    │
   │  }                                            │
   │                                               │
   │  6. Save session to localStorage                │
   │  7. Connect WebSocket                         │
   │                                               │
```

## 4. API 端点

### 4.1 配对 API

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/pairings` | POST | 创建配对码 | Admin Token |
| `/api/pairings` | GET | 获取所有配对 | Admin Token |
| `/api/pairings/:code` | GET | 获取配对详情 | Admin Token |
| `/api/pairings/:code/claim` | POST | 认领配对 | 无需认证 |

**创建配对码 (POST /api/pairings)**

```bash
curl -X POST http://server:8788/api/pairings \
  -H "Content-Type: application/json" \
  -H "X-Trix-Admin-Token: YOUR_ADMIN_TOKEN" \
  -d '{
    "label": "My iPhone",
    "ttlMs": 3600000,
    "openClawSessionKey": "optional-session-key"
  }'
```

**响应:**

```json
{
  "code": "ABCDEF12",
  "secret": "random-secret-token",
  "label": "My iPhone",
  "createdAt": 1773631794295,
  "expiresAt": 1773635394295,
  "status": "pending",
  "conversationId": "conv_xxx",
  "claimUrl": "http://server:8788/pair?code=ABCDEF12&secret=...",
  "qrDataUrl": "data:image/png;base64,...",
  "websocketUrl": "ws://server:8788/ws"
}
```

**认领配对 (POST /api/pairings/:code/claim)**

```bash
curl -X POST http://server:8788/api/pairings/ABCDEF12/claim \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "web_abc123",
    "deviceName": "MacBook Pro",
    "secret": "optional-secret-from-qr"
  }'
```

**响应:**

```json
{
  "conversationId": "conv_xxx",
  "clientToken": "eyJhbG...",
  "websocketUrl": "ws://server:8788/ws",
  "serverUrl": "http://server:8788",
  "pairing": {
    "code": "ABCDEF12",
    "status": "paired"
  },
  "agentOnline": true
}
```

### 4.2 消息 API

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/messages/:conversationId` | GET | 获取消息历史 | Client Token |
| `/api/messages` | POST | 发送消息 | Client Token / Admin Token |
| `/api/uploads` | POST | 上传附件 | Client Token / Admin Token |
| `/api/attachments/:id` | GET | 下载附件 | 无需认证 |

**获取消息历史 (GET /api/messages/:conversationId)**

```bash
curl http://server:8788/api/messages/conv_xxx \
  -H "x-trix-client-token: CLIENT_TOKEN"
```

**响应:**

```json
{
  "messages": [
    {
      "id": "msg_xxx",
      "conversationId": "conv_xxx",
      "direction": "inbound",
      "text": "Hello!",
      "attachments": [],
      "senderId": "web_abc123",
      "senderName": "User",
      "createdAt": 1773631829432
    }
  ],
  "agentOnline": true
}
```

**发送消息 (POST /api/messages)**

```bash
curl -X POST http://server:8788/api/messages \
  -H "Content-Type: application/json" \
  -H "x-trix-client-token: CLIENT_TOKEN" \
  -d '{
    "conversationId": "conv_xxx",
    "direction": "inbound",
    "senderId": "web_abc123",
    "senderName": "User",
    "text": "Hello!"
  }'
```

### 4.3 WebSocket 协议

**连接 URL:**

```
ws://server:8788/ws?role=user&conversationId=xxx&clientId=xxx&clientToken=xxx
ws://server:8788/ws?role=agent&adminToken=xxx&accountId=xxx
```

**消息格式:**

```typescript
// 客户端发送
interface ClientEnvelope {
  type: string;
  payload: unknown;
}

// 服务器推送
interface ServerEnvelope {
  type: 'connected' | 'agent.status' | 'message.created' | 'pairing.updated';
  payload: unknown;
}
```

**事件类型:**

| 事件 | 方向 | 描述 |
|------|------|------|
| `connected` | Server → Client | 连接成功，包含 role, conversationId, agentOnline |
| `agent.status` | Server → Client | Agent 在线状态变化 |
| `message.created` | Server → Client | 新消息通知 |
| `pairing.updated` | Server → Client | 配对状态更新 |

## 5. 数据结构

### 5.1 核心类型定义

```typescript
// 配对记录
interface PairingRecord {
  code: string;              // 配对码 (6-8位字母数字)
  secret: string;            // 配对密钥
  label?: string;            // 设备标签
  createdAt: number;         // 创建时间戳
  expiresAt: number;         // 过期时间戳
  status: 'pending' | 'paired' | 'expired';
  conversationId: string;    // 关联会话ID
  claimUrl: string;          // 认领URL
  qrDataUrl?: string;        // QR码Data URL
  pairedAt?: number;         // 配对时间
  pairedClientId?: string;   // 配对的客户端ID
  pairedDeviceName?: string; // 配对的设备名称
  clientToken?: string;      // 分配的客户端Token
}

// 会话记录
interface ConversationRecord {
  id: string;                // 会话ID
  createdAt: number;         // 创建时间
  updatedAt: number;         // 更新时间
  pairingCode: string;       // 关联配对码
  openClawSessionKey?: string; // OpenClaw 会话密钥
  participants: Array<{
    clientId: string;
    deviceName?: string;
    role: 'user' | 'agent';
    clientToken?: string;
    connectedAt?: number;
    lastSeenAt?: number;
  }>;
}

// 消息记录
interface MessageRecord {
  id: string;                // 消息ID
  conversationId: string;    // 所属会话
  direction: 'inbound' | 'outbound' | 'system';
  text: string;              // 文本内容
  attachments: AttachmentDescriptor[]; // 附件列表
  senderId: string;          // 发送者ID
  senderName?: string;       // 发送者名称
  createdAt: number;         // 创建时间
  metadata?: Record<string, unknown>; // 元数据
}

// 附件描述符
interface AttachmentDescriptor {
  id: string;                // 附件ID
  kind: 'image' | 'audio' | 'video' | 'file';
  mimeType: string;          // MIME 类型
  fileName: string;          // 文件名
  sizeBytes: number;         // 文件大小
  sha256: string;            // 文件哈希
  storagePath: string;       // 存储路径
  publicUrl?: string;        // 公开URL
  width?: number;            // 图片宽度
  height?: number;           // 图片高度
  durationMs?: number;       // 媒体时长
  createdAt: number;         // 创建时间
}
```

### 5.2 状态管理

```typescript
// 全局状态
interface NativeChannelState {
  adminToken: string;          // 管理员 Token
  pairings: PairingRecord[];   // 所有配对记录
  conversations: ConversationRecord[]; // 所有会话
  messages: MessageRecord[];   // 所有消息
  uploads: AttachmentDescriptor[]; // 上传记录
}
```

## 6. 安全机制

### 6.1 认证方式

| 场景 | 认证方式 | 说明 |
|------|----------|------|
| 管理操作 | Admin Token | 创建配对码、查看配对列表 |
| 客户端操作 | Client Token | 发送消息、获取历史 |
| WebSocket | Query Token | URL 参数传递 |

### 6.2 Token 验证流程

```
Admin Token 验证:
  Request ──► Header: X-Trix-Admin-Token
            │
            ▼
        state.adminToken
            │
            ▼
        Match? ──Yes──► Continue
            │
            No
            │
            ▼
        401 Invalid admin token

Client Token 验证:
  Request ──► Header: X-Trix-Client-Token
            │
            ▼
        conversation.participants
            │
            ▼
        Find participant with matching token
            │
            ▼
        Found? ──Yes──► Continue
            │
            No
            │
            ▼
        401 Invalid client token
```

### 6.3 配对码安全

- 配对码 6-8 位字母数字组合
- 默认 1 小时有效期 (可配置)
- 支持可选的 secret 验证
- 配对后 code 失效，使用 clientToken 通信

## 7. 前端集成

### 7.1 使用 TrixNativeChannelClient

```typescript
import trixNativeChannelClient from '@/services/TrixNativeChannelClient';

// 初始化客户端
const client = trixNativeChannelClient;

// 检查配对状态
const status = await client.checkPairingStatus();
console.log('Paired:', status.paired);

// 手动输入配对码
async function pairWithCode(code: string) {
  try {
    const result = await client.pairWithCode(code);
    console.log('Pairing success:', result);
  } catch (error) {
    console.error('Pairing failed:', error);
  }
}

// 扫描 QR 码配对
async function pairWithQR(qrData: string) {
  try {
    const result = await client.pairWithQR(qrData);
    console.log('QR pairing success:', result);
  } catch (error) {
    console.error('QR pairing failed:', error);
  }
}
```

### 7.2 事件监听

```typescript
// 监听连接状态
client.on('connected', (data) => {
  console.log('Connected, agent online:', data.agentOnline);
});

client.on('disconnected', () => {
  console.log('Disconnected');
});

client.on('reconnecting', (data) => {
  console.log('Reconnecting, attempt:', data.attempt);
});

// 监听配对事件
client.on('pairing_success', (data) => {
  console.log('Paired with device:', data.deviceId);
});

client.on('unpaired', () => {
  console.log('Unpaired');
});

// 监听 Agent 状态
client.on('bot_online', (data) => {
  console.log('Agent online:', data.message);
});

client.on('bot_offline', (data) => {
  console.log('Agent offline:', data.message);
});

// 监听消息
client.on('message', (message) => {
  console.log('New message:', message);
});

client.on('history', (messages) => {
  console.log('Message history:', messages);
});

// 监听错误
client.on('error', (error) => {
  console.error('Error:', error.message);
});
```

### 7.3 发送消息

```typescript
// 发送文本消息
const clientMessageId = await client.sendMessage({
  text: 'Hello!',
  contentType: 'text'
});

// 发送带附件的消息
const clientMessageId = await client.sendMessage({
  text: 'Check out this image!',
  contentType: 'mixed',
  attachments: [
    {
      uploadId: 'attachment-id-from-upload'
    }
  ]
});

// 上传附件
const attachment = await client.uploadAttachment(file, {
  fileName: 'photo.jpg',
  kind: 'image'
});

// 发送媒体消息
const clientMessageId = await client.sendMessage({
  text: 'Voice message',
  contentType: 'voice',
  mediaUrl: attachment.url,
  mediaMimeType: 'audio/ogg',
  mediaMetadata: {
    duration: 5000
  }
});
```

## 8. 后端插件集成

### 8.1 OpenCLAW 配置

编辑 `~/.openclaw/config.json`:

```json
{
  "channels": {
    "trixNative": {
      "enabled": true,
      "defaultAccount": "default",
      "accounts": {
        "default": {
          "name": "TRIX Native",
          "serverUrl": "http://your-server:8788",
          "adminToken": "your-admin-token"
        }
      }
    }
  }
}
```

### 8.2 插件使用方法

在 OpenCLAW 中使用:

```
# 开始配对
/trix-native pair

# 查看配对设备列表
/trix-native list

# 发送消息到指定会话
/trix-native send conv_xxx "Hello!"

# 查看帮助
/trix-native help
```

## 9. 部署配置

### 9.1 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `TRIX_NATIVE_ADMIN_TOKEN` | 管理员 Token | 自动生成 |
| `TRIX_NATIVE_PUBLIC_BASE_URL` | 公开访问地址 | 自动检测 |
| `TRIX_NATIVE_STORAGE_DIR` | 数据存储目录 | `.trix-native-channel` |

### 9.2 服务器启动

```bash
# 使用 CLI
npx trix-openclaw-native server start \
  --host 0.0.0.0 \
  --port 8788 \
  --public-base-url http://your-domain:8788

# 或使用环境变量
TRIX_NATIVE_ADMIN_TOKEN=your-token \
TRIX_NATIVE_PUBLIC_BASE_URL=http://your-domain:8788 \
node dist/cli.js server start
```

## 10. 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 无法创建配对码 | Admin Token 错误 | 检查 state.json 中的 adminToken |
| 配对失败 | 配对码过期 | 重新生成配对码，默认1小时有效期 |
| WebSocket 连接失败 | 端口未开放 | 检查防火墙设置 |
| 消息发送失败 | Client Token 失效 | 重新配对获取新的 clientToken |
| Agent 显示离线 | 插件未启动 | 检查 OpenCLAW 插件状态 |

### 调试命令

```bash
# 检查服务器健康
curl http://server:8788/health

# 查看配对状态
curl http://server:8788/api/pairings/PARING_CODE \
  -H "X-Trix-Admin-Token: ADMIN_TOKEN"

# 获取消息历史
curl http://server:8788/api/messages/CONVERSATION_ID \
  -H "x-trix-client-token: CLIENT_TOKEN"
```

---

**文档版本**: 1.1
**最后更新**: 2026-03-17
**兼容版本**: @trix-app/openclaw-native-channel@0.1.0
