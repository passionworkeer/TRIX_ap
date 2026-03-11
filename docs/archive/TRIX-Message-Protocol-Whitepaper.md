# TRIX 全链路消息协议与数据结构重构白皮书

> **版本**: v1.0.0
> **日期**: 2026-02-21
> **状态**: 🔴 CRITICAL - 立即执行字段命名标准化
> **作者**: TRIX Team

---

## 📋 目录

1. [执行摘要](#执行摘要)
2. [架构概览](#架构概览)
3. [上行链路协议 (App → OpenClaw)](#上行链路协议-app--openclaw)
4. [下行链路协议 (OpenClaw → App)](#下行链路协议-openclaw--app)
5. [完整示例：一条消息的全生命周期](#完整示例一条消息的全生命周期)
6. [字段命名规范](#字段命名规范)
7. [迁移计划](#迁移计划)
8. [测试验证](#测试验证)

---

## 执行摘要

### 🎯 目标

**统一全链路 JSON 字段命名规范**，解决当前各端字段命名不一致导致的开发混乱。

### 🚨 核心问题

当前系统存在严重的字段命名冲突：

| 问题 | 影响 | 严重性 |
|------|------|--------|
| `content` vs `message` vs `text` | 前端、服务器、PC Adapter 三方命名不统一 | 🔴 CRITICAL |
| `messageId` vs `msg_id` | 驼峰与下划线混用 | 🔴 CRITICAL |
| `contentType` vs `content_type` | 数据库与 API 不一致 | 🔴 CRITICAL |
| 缺少 `mediaUrl` 字段验证 | 媒体消息可能丢失 | 🟡 HIGH |

### ✅ 解决方案

1. **建立统一的字段命名规范**（驼峰式 camelCase）
2. **定义全链路 JSON 转换契约**
3. **提供迁移脚本和测试用例**

---

## 架构概览

### 四跳链路架构

```
┌──────────────┐    Socket.IO     ┌──────────────┐    Socket.IO    ┌──────────────┐    ws (原生)    ┌──────────────┐
│              │ ───────────────> │              │ ──────────────> │              │ ──────────────> │              │
│   Mobile     │   Event: app_    │   Cloud      │   Event: app_   │  PC Adapter  │  JSON-RPC 3.0  │  OpenClaw    │
│   App        │   message        │   Server     │   message       │  (Node.js)   │   Method: chat │  Gateway     │
│              │                  │   (8765)     │                 │              │                │  (18789)     │
└──────────────┘                  └──────────────┘                 └──────────────┘                └──────────────┘
       ▲                                  ▲                                ▲                               ▲
       │                                  │                                │                               │
       │    Socket.IO                     │    Socket.IO                   │    ws (原生)                  │
       │    Event: bot_                   │    Event: bot_                 │    Event: chat                │
       │    message                       │    message                     │    (broadcast)                │
       └──────────────────────────────────┴────────────────────────────────┴───────────────────────────────┘
```

### 组件角色

| 组件 | 技术栈 | 角色 | 端口 |
|------|--------|------|------|
| **Mobile App** | React + Socket.IO Client | 消息发送者/接收者 | N/A |
| **Cloud Server** | Node.js + Socket.IO + SQLite | 消息中继 + 配对管理 + 持久化 | 8765 |
| **PC Adapter** | Node.js + Socket.IO + ws | 协议转换网关 | N/A |
| **OpenClaw Gateway** | Go + WebSocket | AI Agent 调度器 | 18789 |

---

## 上行链路协议 (App → OpenClaw)

### 1️⃣ App → Server (Socket.IO Event: `app_message`)

**位置**: `src/services/ClawbotChannelBridge.ts:549`

**JSON 格式**:
```json
{
  "content": "你好",
  "contentType": "text",
  "mediaUrl": null,
  "messageId": "1739280000000-abc123def"
}
```

**字段规范**:
- ✅ `content` (string, 必填): 消息文本内容
- ✅ `contentType` (string, 必填): 消息类型 `text | image | video | file`
- ✅ `mediaUrl` (string, 可选): 媒体文件 URL（OSS 地址）
- ✅ `messageId` (string, 必填): UUID 格式，用于确认回执

**代码实现**:
```typescript
// src/services/ClawbotChannelBridge.ts:549
this.socket.emit('app_message', {
  content,
  contentType,
  mediaUrl,
  messageId // 发送消息ID
});
```

---

### 2️⃣ Server 数据库落库 (SQLite)

**位置**: `server/clawbot-channel/services/messageService.js:6-13`

**表结构**:
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,                    -- UUID
  pairing_id TEXT NOT NULL,               -- 配对关系 ID
  direction TEXT NOT NULL,                -- 'app_to_bot' 或 'bot_to_app'
  content TEXT,                           -- 消息内容
  content_type TEXT DEFAULT 'text',       -- ⚠️ 下划线命名
  media_url TEXT,                         -- ⚠️ 下划线命名
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered BOOLEAN DEFAULT 0
)
```

**字段映射**:
| API 字段 (camelCase) | 数据库字段 (snake_case) | 转换逻辑 |
|----------------------|-------------------------|----------|
| `content` | `content` | 直接映射 |
| `contentType` | `content_type` | camelCase → snake_case |
| `mediaUrl` | `media_url` | camelCase → snake_case |
| `messageId` | `id` | 重命名 |

**代码实现**:
```javascript
// server/clawbot-channel/services/messageService.js:6
async saveMessage(pairingId, direction, content, contentType = 'text', mediaUrl = null) {
  const id = uuidv4();
  await dbRun(`
    INSERT INTO messages (id, pairing_id, direction, content, content_type, media_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, pairingId, direction, content, contentType, mediaUrl]);
  return id;
}
```

---

### 3️⃣ Server → PC Adapter (Socket.IO Event: `app_message`)

**位置**: `server/clawbot-channel/server.js:666-673`

**JSON 格式** (TRIX Channel v2.0.0):
```json
{
  "type": "chat_message",
  "message": "你好",
  "msg_id": "1739280000000-abc123def",
  "sender_device_id": "mobile_app",
  "content_type": "text",
  "media_url": null
}
```

**⚠️ 字段转换问题**:
- ❌ `content` → `message` (不一致！)
- ❌ `messageId` → `msg_id` (不一致！)
- ✅ `contentType` → `content_type` (正确)
- ✅ `mediaUrl` → `media_url` (正确)

**代码实现**:
```javascript
// server/clawbot-channel/server.js:666
botSocket.emit('app_message', {
  type: 'chat_message',
  message: content,           // ⚠️ 重命名
  msg_id: messageId,          // ⚠️ 下划线
  sender_device_id: 'mobile_app',
  content_type: contentType,  // ✅ 正确
  media_url: mediaUrl         // ✅ 正确
});
```

---

### 4️⃣ PC Adapter → OpenClaw Gateway (WebSocket JSON-RPC 3.0)

**位置**: `openclaw-skills/trix-channel/index.js:423-436`

**JSON 格式**:
```json
{
  "type": "req",
  "id": "msg_1739280000000_xyz789",
  "method": "chat",
  "params": {
    "text": "你好",
    "threadId": "default",
    "context": {
      "source": "trix-app",
      "userId": "bd49b054-7e8d-45e0-863e-0a7d89d51bf3",
      "deviceId": "trix_DESKTOP-ABC123_1739280000000"
    }
  }
}
```

**字段转换**:
| Server 字段 | Gateway 字段 | 转换逻辑 |
|-------------|--------------|----------|
| `message` | `params.text` | 重命名 |
| `msg_id` | `id` | 重命名（前缀加 `msg_`） |
| `content_type` | ❌ 丢弃 | Gateway 不需要 |
| `media_url` | ❌ 丢弃 | Gateway 不支持（需要扩展） |

**代码实现**:
```javascript
// openclaw-skills/trix-channel/index.js:412
function forwardToGateway(data) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const chatReq = {
    type: 'req',
    id: messageId,
    method: 'chat',
    params: {
      text: data.text,      // ⚠️ 字段名不同
      threadId: data.threadId || 'default',
      context: {
        source: 'trix-app',
        userId: data.userId,
        deviceId: data.deviceId
      }
    }
  };
  gatewayWs.send(JSON.stringify(chatReq));
}
```

---

### 📊 上行链路完整字段对照表

| 阶段 | 消息内容字段 | 消息ID字段 | 内容类型字段 | 媒体URL字段 |
|------|--------------|------------|--------------|-------------|
| **1. App emit** | `content` | `messageId` | `contentType` | `mediaUrl` |
| **2. SQLite** | `content` | `id` | `content_type` | `media_url` |
| **3. Server → Adapter** | `message` ⚠️ | `msg_id` ⚠️ | `content_type` | `media_url` |
| **4. Adapter → Gateway** | `params.text` ⚠️ | `id` ⚠️ | ❌ 丢失 | ❌ 丢失 |

**🔴 冲突总结**:
- 消息内容字段经历了 3 次重命名：`content` → `message` → `text`
- 消息ID字段经历了 3 次重命名：`messageId` → `msg_id` → `id`
- 媒体字段在 Gateway 阶段丢失

---

## 下行链路协议 (OpenClaw → App)

### 1️⃣ OpenClaw Gateway → PC Adapter (WebSocket Event: `chat`)

**位置**: `openclaw-skills/trix-channel/index.js:383`

**JSON 格式**:
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "messageId": "msg_1739280123_abc789",
    "role": "assistant",
    "response": "你好，主人！有什么可以帮助你的吗？",
    "timestamp": 1739280123456
  }
}
```

**字段规范**:
- ✅ `payload.response` (string, 必填): AI 回复文本
- ✅ `payload.messageId` (string, 必填): 原始消息 ID
- ✅ `payload.role` (string): 角色 `assistant | user`
- ✅ `payload.timestamp` (number): Unix 毫秒时间戳

**代码实现**:
```javascript
// openclaw-skills/trix-channel/index.js:383
if (msg.type === 'event' && msg.event === 'chat') {
  const payload = msg.payload || {};
  // 防止消息回声
  if (payload.role === 'user') return;
  forwardToApp(payload);
}
```

---

### 2️⃣ PC Adapter → Server (Socket.IO Event: `bot_response`)

**位置**: `openclaw-skills/trix-channel/index.js:470-475`

**JSON 格式**:
```json
{
  "response": "你好，主人！有什么可以帮助你的吗？",
  "messageId": "msg_1739280123_abc789",
  "timestamp": "2026-02-21T10:42:03.456Z",
  "pairingId": "pair_abc123"
}
```

**⚠️ 字段转换问题**:
- ❌ `payload.response` → `response` (命名不一致)
- ✅ `payload.messageId` → `messageId` (正确)
- ✅ `payload.timestamp` → `timestamp` (格式转换：number → ISO string)

**代码实现**:
```javascript
// openclaw-skills/trix-channel/index.js:456
function forwardToApp(payload) {
  const responseText = payload.response || payload.text || payload.message?.content || '';

  serverSocket.emit('bot_response', {
    response: responseText,
    messageId: payload.messageId,
    timestamp: new Date().toISOString(),  // ⚠️ 格式转换
    pairingId: pairingId
  });
}
```

---

### 3️⃣ Server 数据库落库 (SQLite)

**位置**: `server/clawbot-channel/services/messageService.js:6-13`

**表结构** (同上行):
```sql
INSERT INTO messages (id, pairing_id, direction, content, content_type, media_url)
VALUES (?, ?, ?, ?, ?, ?)
```

**字段映射**:
| Adapter 字段 | 数据库字段 | 转换逻辑 |
|--------------|-----------|----------|
| `response` | `content` | 重命名 ⚠️ |
| `messageId` | `id` | 重命名 |
| `timestamp` | `created_at` | 格式转换 |
| `pairingId` | `pairing_id` | 直接映射 |

---

### 4️⃣ Server → App (Socket.IO Event: `bot_message`)

**位置**: `server/clawbot-channel/server.js:732-737`

**JSON 格式**:
```json
{
  "content": "你好，主人！有什么可以帮助你的吗？",
  "contentType": "text",
  "mediaUrl": null,
  "timestamp": 1739280123456
}
```

**⚠️ 字段转换问题**:
- ❌ `response` → `content` (又改回来了！)
- ✅ `timestamp` 格式转换：ISO string → number
- ✅ 添加了 `contentType` 和 `mediaUrl` (App 需要)

**代码实现**:
```javascript
// server/clawbot-channel/server.js:732
io.to(`user_${pairing.user_id}`).emit('bot_message', {
  content,          // ⚠️ 又改名为 content
  contentType,
  mediaUrl,
  timestamp: Date.now()  // ⚠️ number 格式
});
```

---

### 📊 下行链路完整字段对照表

| 阶段 | 回复内容字段 | 消息ID字段 | 时间戳字段 | 媒体字段 |
|------|--------------|------------|------------|----------|
| **1. Gateway** | `payload.response` | `payload.messageId` | `payload.timestamp` (number) | ❌ |
| **2. Adapter** | `response` | `messageId` | `timestamp` (ISO string) ⚠️ | ❌ |
| **3. SQLite** | `content` ⚠️ | `id` ⚠️ | `created_at` (DATETIME) | `media_url` |
| **4. Server → App** | `content` | ❌ 丢失 | `timestamp` (number) ⚠️ | `mediaUrl` |

**🔴 冲突总结**:
- 回复内容字段经历了 3 次重命名：`response` → `response` → `content`
- 时间戳格式经历了 3 次转换：`number` → `ISO string` → `number`
- 消息ID在最后一跳丢失（App 无法关联请求和响应）

---

## 完整示例：一条消息的全生命周期

### 📤 上行：App 发送 "你好"

#### 阶段 1: App emit
```json
{
  "content": "你好",
  "contentType": "text",
  "mediaUrl": null,
  "messageId": "1739280000000-abc123def"
}
```

#### 阶段 2: SQLite 落库
```sql
INSERT INTO messages (
  id,
  pairing_id,
  direction,
  content,
  content_type,
  media_url
) VALUES (
  '1739280000000-abc123def',           -- messageId → id
  'pair_bd49b054_7e8d_45e0_863e',      -- 配对关系 ID
  'app_to_bot',                         -- 方向
  '你好',                               -- content
  'text',                               -- contentType → content_type
  NULL                                  -- mediaUrl → media_url
);
```

#### 阶段 3: Server → PC Adapter
```json
{
  "type": "chat_message",
  "message": "你好",                    // ⚠️ content → message
  "msg_id": "1739280000000-abc123def", // ⚠️ messageId → msg_id
  "sender_device_id": "mobile_app",
  "content_type": "text",              // ✅ 正确
  "media_url": null                    // ✅ 正确
}
```

#### 阶段 4: PC Adapter → Gateway
```json
{
  "type": "req",
  "id": "msg_1739280000000_xyz789",    // ⚠️ msg_id → id (前缀改变)
  "method": "chat",
  "params": {
    "text": "你好",                    // ⚠️ message → text
    "threadId": "default",
    "context": {
      "source": "trix-app",
      "userId": "bd49b054-7e8d-45e0-863e-0a7d89d51bf3",
      "deviceId": "trix_DESKTOP-ABC123_1739280000000"
    }
  }
}
```

---

### 📥 下行：OpenClaw 回复 "你好，主人！"

#### 阶段 1: Gateway → PC Adapter
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "messageId": "msg_1739280123_abc789",
    "role": "assistant",
    "response": "你好，主人！有什么可以帮助你的吗？",
    "timestamp": 1739280123456
  }
}
```

#### 阶段 2: PC Adapter → Server
```json
{
  "response": "你好，主人！有什么可以帮助你的吗？",
  "messageId": "msg_1739280123_abc789",
  "timestamp": "2026-02-21T10:42:03.456Z",  // ⚠️ number → ISO string
  "pairingId": "pair_bd49b054_7e8d_45e0_863e"
}
```

#### 阶段 3: SQLite 落库
```sql
INSERT INTO messages (
  id,
  pairing_id,
  direction,
  content,
  content_type,
  media_url
) VALUES (
  'msg_1739280123_abc789',             -- messageId → id
  'pair_bd49b054_7e8d_45e0_863e',      -- pairingId
  'bot_to_app',                         -- 方向
  '你好，主人！有什么可以帮助你的吗？',  -- response → content ⚠️
  'text',                               -- contentType
  NULL                                  -- mediaUrl
);
```

#### 阶段 4: Server → App
```json
{
  "content": "你好，主人！有什么可以帮助你的吗？",  // ⚠️ response → content
  "contentType": "text",
  "mediaUrl": null,
  "timestamp": 1739280123456            // ⚠️ ISO string → number
}
```

---

## 字段命名规范

### ✅ 推荐标准（立即执行）

#### 核心原则

1. **API 层统一使用 camelCase**
   - Socket.IO Events
   - HTTP API
   - 前端代码

2. **数据库层使用 snake_case**
   - SQLite 表名和字段名
   - 索引名

3. **转换层明确映射关系**
   - Server 负责数据库字段转换
   - Adapter 负责 JSON-RPC 格式转换

#### 标准字段命名

| 用途 | API 字段 (camelCase) | 数据库字段 (snake_case) | JSON-RPC 字段 |
|------|---------------------|------------------------|---------------|
| **消息内容** | `content` | `content` | `params.text` |
| **消息ID** | `messageId` | `id` | `id` |
| **内容类型** | `contentType` | `content_type` | ❌ 不需要 |
| **媒体URL** | `mediaUrl` | `media_url` | `params.mediaUrl` ⚠️ 待扩展 |
| **时间戳** | `timestamp` | `created_at` | `timestamp` |
| **发送者ID** | `senderId` | `sender_id` | `context.userId` |
| **设备ID** | `deviceId` | `device_id` | `context.deviceId` |
| **线程ID** | `threadId` | `thread_id` | `params.threadId` |
| **配对ID** | `pairingId` | `pairing_id` | ❌ 内部字段 |

---

### 🔄 迁移映射表

#### 上行链路修复

**位置 1: Server → PC Adapter**

**当前代码** (`server/clawbot-channel/server.js:666`):
```javascript
// ❌ 错误的字段命名
botSocket.emit('app_message', {
  type: 'chat_message',
  message: content,           // ❌ 应该是 content
  msg_id: messageId,          // ❌ 应该是 messageId
  sender_device_id: 'mobile_app',
  content_type: contentType,  // ❌ 应该是 contentType
  media_url: mediaUrl         // ❌ 应该是 mediaUrl
});
```

**修复后**:
```javascript
// ✅ 统一 camelCase
botSocket.emit('app_message', {
  type: 'chat_message',
  content: content,           // ✅ 统一为 content
  messageId: messageId,       // ✅ 统一为 messageId
  senderDeviceId: 'mobile_app', // ✅ 驼峰化
  contentType: contentType,   // ✅ 统一为 contentType
  mediaUrl: mediaUrl          // ✅ 统一为 mediaUrl
});
```

---

**位置 2: PC Adapter → Gateway**

**当前代码** (`openclaw-skills/trix-channel/index.js:412`):
```javascript
// ❌ 缺少媒体字段
const chatReq = {
  type: 'req',
  id: messageId,
  method: 'chat',
  params: {
    text: data.text,      // ❌ 应该接收 content
    threadId: data.threadId || 'default',
    context: { ... }
  }
};
```

**修复后**:
```javascript
// ✅ 支持媒体消息
const chatReq = {
  type: 'req',
  id: messageId,
  method: 'chat',
  params: {
    text: data.content,               // ✅ 接收 content
    threadId: data.threadId || 'default',
    contentType: data.contentType,    // ✅ 添加 contentType
    mediaUrl: data.mediaUrl,          // ✅ 添加 mediaUrl
    context: {
      source: 'trix-app',
      userId: data.userId,
      deviceId: data.deviceId
    }
  }
};
```

---

#### 下行链路修复

**位置 1: PC Adapter → Server**

**当前代码** (`openclaw-skills/trix-channel/index.js:456`):
```javascript
// ❌ 命名不一致
serverSocket.emit('bot_response', {
  response: responseText,              // ❌ 应该是 content
  messageId: payload.messageId,        // ✅ 正确
  timestamp: new Date().toISOString(), // ❌ 应该是 number
  pairingId: pairingId
});
```

**修复后**:
```javascript
// ✅ 统一命名
serverSocket.emit('bot_message', {      // ✅ 改名 bot_response → bot_message
  content: responseText,                // ✅ 统一为 content
  messageId: payload.messageId,         // ✅ 保留
  contentType: 'text',                  // ✅ 添加
  mediaUrl: null,                       // ✅ 添加
  timestamp: payload.timestamp          // ✅ 保持 number 格式
});
```

---

**位置 2: Server → App**

**当前代码** (`server/clawbot-channel/server.js:732`):
```javascript
// ✅ 已经正确
io.to(`user_${pairing.user_id}`).emit('bot_message', {
  content,
  contentType,
  mediaUrl,
  timestamp: Date.now()
});
```

**无需修改**，字段命名已经正确。

---

### 📋 字段命名自查表

#### 前端开发者 (App)

```typescript
// ✅ 正确的发送格式
socket.emit('app_message', {
  content: "你好",
  contentType: "text",  // text | image | video | file
  mediaUrl: "https://...",  // 可选
  messageId: generateUUID()
});

// ✅ 正确的接收格式
socket.on('bot_message', (data) => {
  const {
    content,        // AI 回复文本
    contentType,    // 消息类型
    mediaUrl,       // 媒体 URL
    timestamp       // Unix 毫秒时间戳
  } = data;
});
```

---

#### 后端开发者 (Server)

```javascript
// ✅ 正确的数据库映射
const dbFields = {
  content: apiData.content,           // 直接映射
  content_type: apiData.contentType,  // camelCase → snake_case
  media_url: apiData.mediaUrl,        // camelCase → snake_case
  id: apiData.messageId               // 重命名
};

// ✅ 正确的转发格式
botSocket.emit('app_message', {
  type: 'chat_message',
  content: data.content,              // ✅ 统一
  messageId: data.messageId,          // ✅ 统一
  senderDeviceId: 'mobile_app',       // ✅ 驼峰
  contentType: data.contentType,      // ✅ 统一
  mediaUrl: data.mediaUrl             // ✅ 统一
});
```

---

#### Adapter 开发者 (PC Adapter)

```javascript
// ✅ 正确的 Gateway 请求
const chatReq = {
  type: 'req',
  id: data.messageId,
  method: 'chat',
  params: {
    text: data.content,               // ✅ content → text
    threadId: 'default',
    contentType: data.contentType,    // ✅ 新增
    mediaUrl: data.mediaUrl,          // ✅ 新增
    context: {
      source: 'trix-app',
      userId: data.userId,
      deviceId: data.deviceId
    }
  }
};

// ✅ 正确的转发格式
serverSocket.emit('bot_message', {    // ✅ 统一事件名
  content: payload.response,          // ✅ response → content
  messageId: payload.messageId,       // ✅ 保留
  contentType: 'text',                // ✅ 添加
  mediaUrl: null,                     // ✅ 添加
  timestamp: payload.timestamp        // ✅ 保留 number
});
```

---

## 迁移计划

### 🎯 Phase 1: 字段标准化（本周完成）

#### 任务清单

- [ ] **Server**: 修改 `server.js:666` 的字段命名
- [ ] **Adapter**: 修改 `index.js:412` 支持 `content` 和媒体字段
- [ ] **Adapter**: 修改 `index.js:456` 统一事件名为 `bot_message`
- [ ] **测试**: 验证消息发送和接收流程

#### 测试用例

```javascript
// 测试 1: 纯文本消息
{
  content: "你好",
  contentType: "text",
  mediaUrl: null,
  messageId: "test-001"
}

// 测试 2: 图片消息
{
  content: "看这张图",
  contentType: "image",
  mediaUrl: "https://oss.example.com/image.jpg",
  messageId: "test-002"
}

// 测试 3: 视频消息
{
  content: "短视频",
  contentType: "video",
  mediaUrl: "https://oss.example.com/video.mp4",
  messageId: "test-003"
}
```

---

### 🎯 Phase 2: 数据库迁移（下周完成）

#### 迁移脚本

```sql
-- 1. 重命名字段（如果需要）
ALTER TABLE messages RENAME COLUMN content_type TO content_type_old;
ALTER TABLE messages RENAME COLUMN media_url TO media_url_old;

-- 2. 添加新字段
ALTER TABLE messages ADD COLUMN contentType TEXT DEFAULT 'text';
ALTER TABLE messages ADD COLUMN mediaUrl TEXT;

-- 3. 迁移数据
UPDATE messages SET
  contentType = content_type_old,
  mediaUrl = media_url_old;

-- 4. 删除旧字段
ALTER TABLE messages DROP COLUMN content_type_old;
ALTER TABLE messages DROP COLUMN media_url_old;
```

**⚠️ 注意**: SQLite 不支持 `ALTER TABLE DROP COLUMN`，需要重建表。

---

### 🎯 Phase 3: 文档更新（持续）

#### 需要更新的文档

- [ ] `docs/archive/clawbot/CLAWBOT_PROTOCOL.md`
- [ ] `openclaw-skills/trix-channel/SKILL.md`
- [ ] `openclaw-skills/trix-channel/README.md`
- [ ] API 文档和示例代码

---

## 测试验证

### 单元测试

```javascript
// server/clawbot-channel/tests/message-format.test.js

describe('消息字段命名规范', () => {
  test('上行链路：App → Server 字段验证', () => {
    const appMessage = {
      content: "你好",
      contentType: "text",
      mediaUrl: null,
      messageId: "test-001"
    };

    // 验证字段存在
    expect(appMessage).toHaveProperty('content');
    expect(appMessage).toHaveProperty('contentType');
    expect(appMessage).toHaveProperty('mediaUrl');
    expect(appMessage).toHaveProperty('messageId');
  });

  test('Server → Adapter 字段转换', () => {
    const serverMessage = convertToAdapterFormat({
      content: "你好",
      contentType: "text",
      mediaUrl: null,
      messageId: "test-001"
    });

    // 验证字段转换正确
    expect(serverMessage).toHaveProperty('content');        // ✅ 不是 message
    expect(serverMessage).toHaveProperty('messageId');      // ✅ 不是 msg_id
    expect(serverMessage).toHaveProperty('contentType');    // ✅ 不是 content_type
    expect(serverMessage).toHaveProperty('mediaUrl');       // ✅ 不是 media_url
  });
});
```

---

### 集成测试

```bash
# 测试脚本
cd server/clawbot-channel
npm run test:message-flow

# 预期输出
✅ App 发送消息成功
✅ Server 落库成功
✅ Adapter 接收消息格式正确
✅ Gateway 接收 JSON-RPC 格式正确
✅ AI 回复成功
✅ App 接收回复格式正确
```

---

### E2E 测试

```bash
# 启动所有服务
1. 启动 OpenClaw Gateway (端口 18789)
2. 启动 PC Adapter (openclaw-skills/trix-channel/index.js)
3. 启动 Cloud Server (端口 8765)
4. 启动 Mobile App

# 测试流程
1. App 输入配对码配对
2. App 发送 "你好"
3. 验证 AI 回复包含 "你好，主人"
4. 验证所有字段命名正确
```

---

## 附录

### A. 字段命名速查表

| 用途 | App emit | Server emit | Adapter emit | Gateway |
|------|----------|-------------|--------------|---------|
| **事件名（上行）** | `app_message` | `app_message` | N/A | N/A |
| **事件名（下行）** | N/A | `bot_message` | `bot_message` | `chat` (event) |
| **消息内容** | `content` | `content` ✅ | `content` ✅ | `params.text` |
| **消息ID** | `messageId` | `messageId` ✅ | `messageId` ✅ | `id` |
| **内容类型** | `contentType` | `contentType` ✅ | `contentType` ✅ | ❌ |
| **媒体URL** | `mediaUrl` | `mediaUrl` ✅ | `mediaUrl` ✅ | ❌ 待扩展 |

---

### B. 常见问题

**Q: 为什么不在所有层统一使用 camelCase？**
A: 数据库使用 snake_case 是 SQL 的标准惯例，API 层使用 camelCase 是 JavaScript/JSON 的惯例。我们需要在两者之间做明确的转换。

**Q: 时间戳应该用什么格式？**
A:
- API 层：Unix 毫秒时间戳 (number)
- 数据库：ISO 8601 字符串 (DATETIME)
- Gateway：Unix 毫秒时间戳 (number)

**Q: `messageId` 是必须的吗？**
A: 是的，用于：
1. 消息发送确认 (ACK)
2. 请求-响应关联
3. 去重和幂等性

---

### C. 参考资源

- [Socket.IO 官方文档](https://socket.io/docs/)
- [JSON-RPC 3.0 规范](https://www.jsonrpc.org/specification)
- [OpenClaw Gateway API](https://docs.openclaw.ai)
- [TRIX 项目架构文档](../ARCHITECTURE.md)

---

## 📝 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|----------|------|
| v1.0.0 | 2026-02-21 | 初版发布，定义全链路协议规范 | TRIX Team |

---

**状态**: 🔴 **立即执行** - 字段命名冲突已影响开发和维护效率

**下一步行动**:
1. 召开团队会议，确认迁移计划
2. 执行 Phase 1 代码修改
3. 运行测试验证
4. 部署到生产环境
