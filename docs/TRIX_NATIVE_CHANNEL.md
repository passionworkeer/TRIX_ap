# TRIX Native Channel

> 当前唯一正式文档。旧 relay / 旧 Gateway 直连方案已废弃。
>
> **最后更新**: 2026-03-22（全面更新：新增 Study Room、TTS、Session Management、Rate Limiting）

---

## 架构

```text
Web / iOS
   │ HTTPS + WSS
   ▼
Trix Service
   ├─ Pairing / Claim
   ├─ User WebSocket (role=user)
   ├─ User Messages API
   ├─ Service WebSocket (role=service)
   ├─ Service Messages API
   ├─ Study Room Manager     ← 新增
   ├─ TTS Synthesizer (Edge TTS)  ← 新增
   ├─ Upload API / Signed URL
   └─ Attachment / DB
   ▲
   │
OpenClaw Gateway (本机)
   └─ trix-native channel plugin
```

## 原生插件要求

- 必须有 `openclaw.plugin.json`
- `package.json` 必须声明 `openclaw.extensions`
- 推荐声明 `setupEntry`
- `channels.trix-native` 必须存在于 OpenClaw 配置
- 插件实现 `config.listAccountIds`、`config.resolveAccount`、`config.inspectAccount`
- 插件出站只走 `/api/service/messages`
- `startAccount()` 必须持有连接，不允许连上即返回

## 服务平面与用户平面

### 用户平面

- `POST /api/pairings/:code/claim` — 认领配对码
- `GET /ws?role=user&conversationId=...&clientId=...&clientToken=...` — 用户 WebSocket
- `POST /api/messages` — 发送消息（clientToken 在 JSON body 中，非 header）
- `POST /api/uploads` — 上传附件
- `GET /api/conversations/:id/messages` — 历史消息
- `POST /api/client/session/bind` — 绑定已有配对会话到认证用户 ← 新增
- `POST /api/client/session/restore` — 恢复会话（基于 appUserId）← 新增

### 服务平面

- `GET /api/service/ws` — Service WebSocket（role=service）
- `GET /api/service/probe` — 健康检查
- `POST /api/service/messages` — 发送消息给用户
- `GET /api/service/conversations/by-peer/:peerId` — 获取对话

---

## 配对协议（Step-by-Step）

### OpenClaw Gateway 端

```
1. 用户触发登录 → createServicePairing()
   └─ POST /api/pairings with accountId, label

2. Server 返回:
   {
     code: "ABC123",
     claimUrl: "http://server/pair?code=ABC123&secret=xxx&accountId=default",
     qrDataUrl: "data:image/png;base64,...",
     websocketUrl: "ws://server/ws"
   }

3. 显示 QR 码（qrcode-terminal）或返回 qrDataUrl

4. 轮询配对状态: GET /api/pairings/:code every 7 seconds
   └─ Wait until status === "paired" (timeout: 5 minutes)

5. 成功: OpenClaw 连接到 /api/service/ws with serviceToken
```

### 客户端（Web/iOS）端

```
1. 用户扫描 QR 码或手动输入配对码

2. 解析 QR 内容 → 提取 code, secret, accountId

3. 调用: POST /api/pairings/:code/claim
   Body: { clientId, deviceName, secret (optional), accountId, appUserId }

4. Server 返回:
   {
     conversationId: "conv_xxx",
     clientToken: "yyy",
     websocketUrl: "ws://server/ws",
     peerId: "user_xxx",
     agentOnline: true
   }

5. 连接 WebSocket:
   ws://server/ws?role=user&conversationId=conv_xxx&clientId=clientId&clientToken=clientToken

6. 获取历史: GET /api/conversations/:id/messages
```

---

## 配对码

- **格式**: 6-8 位大写字母
- **有效期**: 1 小时（`DEFAULT_TTL_MS = 60 * 60 * 1000`）
- **轮询**: 客户端每 7 秒一次，超时 5 分钟
- **QR 格式**: `http://host/pair?code=XXX&secret=YYY&accountId=ZZZ`

---

## WebSocket 三角色

### role=user（用户端）

- **认证**: `conversationId` + `clientToken`（URL 参数）
- **接收**: `message.created`, `agent.status`, `study_room_state`
- **发送**: 不可发送（只读），消息通过 REST API 发送

### role=service（服务/插件端）

- **认证**: Bearer Token（`serviceToken`）
- **端点**: `/api/service/ws`
- **接收**: `message.ack`（消息确认）
- **发送**: 消息通过 REST API 发送

### role=agent（Agent 端，遗留）

- **认证**: `adminToken` 或 `serviceToken`
- **端点**: `/ws?role=agent`

---

## WebSocket 消息类型

| Type | 方向 | 说明 |
|------|------|------|
| `connected` | Server→Client | 连接确认 |
| `message.created` | Server→User | 新消息 |
| `message.ack` | Service→Server | 服务确认消息 |
| `pairing.updated` | Server→Service | 配对状态变更 |
| `agent.status` | Server→User | Agent 在线/离线状态 |
| `study_room_state` | Server→User | Study Room 状态变更 |

### 用户消息信封

```typescript
{
  type: 'message.created',
  payload: {
    conversationId: string,
    message: {
      id: string,
      direction: 'inbound' | 'outbound' | 'system',
      text: string,
      attachments: Array<{
        id: string,
        kind: string,
        mimeType: string,
        fileName: string,
        sizeBytes: number,
        url: string,
        servicePath: string  // signed URL for service fetch
      }>,
      senderId: string,
      senderName: string,
      createdAt: string,
      replyToMessageId: string | null,
      metadata?: Record<string, unknown>
    },
    agentOnline: boolean
  }
}
```

### 服务消息信封

```typescript
{
  type: 'message.created',
  payload: {
    accountId: string,
    conversationId: string,
    chatType: 'direct',
    peer: {
      id: string,           // peerId
      displayName: string   // device name
    },
    message: {
      id: string,
      text: string,
      replyToMessageId: string | null,
      attachments: Attachment[],
      timestamp: number    // createdAt in ms
    }
  }
}
```

---

## 身份模型

- `accountId`: OpenClaw channel account
- `peerId`: 真实用户身份
- `clientId`: 设备身份
- `conversationId`: 对话房间
- `messageId`: 服务端稳定消息 id

`peerId` 和 `clientId` 必须分离，不能再把设备身份当作用户身份。

---

## Rate Limiting

| 端点类别 | 默认限制 | 时间窗口 |
|---------|---------|---------|
| `/api/pairings/:code/claim` | 10 次 | 15 分钟 |
| 用户消息 `/api/messages` | 60 次 | 1 分钟 |
| 用户上传 `/api/uploads` | 20 次 | 1 分钟 |
| 服务消息 `/api/service/messages` | 300 次 | 1 分钟 |
| 服务上传 `/api/service/uploads` | 60 次 | 1 分钟 |

所有限制可通过环境变量覆盖：`TRIX_NATIVE_RATE_LIMIT_{CATEGORY}_{MAX|WINDOW_MS}`

---

## 附件处理

### 双路径系统

| 路径 | 认证方式 |
|------|---------|
| `/api/uploads` | User — clientToken + conversationId |
| `/api/service/uploads` | Service — Bearer Token |

### 签名 URL

- 用户附件：HMAC-SHA256 签名 URL，24 小时有效期
- 签名密钥：`attachmentSigningSecret`
- 签名内容：HMAC-SHA256(secret, payload)

---

## Study Room（番茄专注室）

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/study-rooms` | 创建房间 |
| GET | `/api/study-rooms` | 列出所有房间 |
| GET | `/api/study-rooms/:roomCode` | 获取指定房间 |
| POST | `/api/study-rooms/:roomCode/join` | 加入房间 |
| POST | `/api/study-rooms/:roomCode/leave` | 离开房间 |
| POST | `/api/study-rooms/:roomCode/action` | 主持人操作（start_focus/pause/end） |
| DELETE | `/api/study-rooms/:roomCode` | 删除房间 |
| POST | `/api/study-rooms/lookup-by-users` | 按用户查找房间 |

### 客户端方法（TrixNativeChannelClient.ts）

```typescript
client.createStudyRoom()           // 创建房间
client.joinStudyRoom(roomCode)     // 加入房间
client.leaveStudyRoom()            // 离开房间
client.hostActionStudyRoom(action)  // start_focus | pause | end
client.getStudyRoomState()          // 获取房间状态
client.lookupStudyRoomsByUsers()    // 按用户查找房间
```

### WebSocket 事件

房间状态变更通过 `study_room_state` 事件推送。

---

## TTS（Text-to-Speech）

### 端点

```
POST /api/tts/synthesize
```

### Features

- 使用 Microsoft Edge TTS（`node-edge-tts`）
- 支持场景: `welcome`, `status`, `bot_reply`
- 语音配置通过环境变量
- 输出格式: MP3（16kHz / 24kHz / 48kHz）

---

## Session Management

### 绑定已有会话

```
POST /api/client/session/bind
```

将已有配对会话绑定到认证的 Supabase 用户，允许重新认证无需重新配对。

### 恢复会话

```
POST /api/client/session/restore
```

基于 `appUserId` 恢复会话，为同一设备颁发新的 `clientToken`。

---

## 部署

- 服务器只部署 Trix Service + Nginx + TLS
- OpenClaw 只安装在用户自己的电脑上
- 当前生产域名：`https://trix.love`

---

## 全部 API 端点一览

### 配对

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pairings` | 生成配对码 |
| GET | `/api/pairings` | 列出所有配对 |
| GET | `/api/pairings/:code` | 查询配对状态 |
| DELETE | `/api/pairings/:code` | 解绑客户端 |
| POST | `/api/pairings/:code/claim` | 认领配对 |
| GET | `/health` | 健康检查 + agentOnline 状态 |

### 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/client/session/bind` | 绑定会话到用户 |
| POST | `/api/client/session/restore` | 恢复会话 |

### 消息

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/messages` | 用户发送消息 |
| GET | `/api/messages/:conversationId` | 获取消息（遗留端点） |
| POST | `/api/service/messages` | Service 发送消息 |
| GET | `/api/service/conversations/:id` | Service 获取对话 |
| GET | `/api/service/conversations/by-peer/:peerId` | 按 peerId 获取对话 |

### 上传

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/uploads` | 用户上传 |
| POST | `/api/service/uploads` | Service 上传 |

### Study Room

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/study-rooms` | 创建 |
| GET | `/api/study-rooms` | 列表 |
| GET | `/api/study-rooms/:roomCode` | 详情 |
| POST | `/api/study-rooms/:roomCode/join` | 加入 |
| POST | `/api/study-rooms/:roomCode/leave` | 离开 |
| POST | `/api/study-rooms/:roomCode/action` | 主持人操作 |
| DELETE | `/api/study-rooms/:roomCode` | 删除 |
| POST | `/api/study-rooms/lookup-by-users` | 按用户查找 |

### TTS

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tts/synthesize` | 合成语音 |

### WebSocket

| 路径 | 角色 | 说明 |
|------|------|------|
| `/ws?role=user&...` | user | 用户实时消息 |
| `/api/service/ws` | service | Service/Plugin 实时消息 |
| `/ws?role=agent` | agent | Agent 连接（遗留） |

---

**最后更新**: 2026-03-22
