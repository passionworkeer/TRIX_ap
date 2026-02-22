# Clawbot Channel API 文档

> **版本**: v2.0
> **最后更新**: 2026-02-22
> **服务器**: `server/clawbot-channel/`

---

## 🌐 基础信息

### 服务端口
```
HTTP:  8765
WebSocket: 8765 (同一端口)
```

### 基础 URL
```
开发环境: http://localhost:8765
生产环境: http://TRIX_SERVER_HOST:8765
```

---

## 📡 HTTP API

### 健康检查

```
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "uptime": 3600
}
```

---

### 文件上传

```
POST /upload
```

**请求头**:
```
Content-Type: multipart/form-data
```

**表单字段**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | ✅ | 上传的文件 |

**响应**:
```json
{
  "success": true,
  "url": "https://oss.example.com/uploads/xxx.jpg",
  "key": "uploads/xxx.jpg"
}
```

---

### Base64 上传

```
POST /upload/base64
```

**请求体**:
```json
{
  "data": "data:image/png;base64,iVBORw0KGgo...",
  "filename": "image.png"
}
```

**响应**:
```json
{
  "success": true,
  "url": "https://oss.example.com/uploads/xxx.png",
  "key": "uploads/xxx.png"
}
```

---

### OSS 签名 URL

```
POST /oss/signed-url
```

**请求体**:
```json
{
  "key": "uploads/example.jpg",
  "expiresIn": 3600
}
```

**响应**:
```json
{
  "success": true,
  "url": "https://oss.example.com/uploads/example.jpg?signature=xxx",
  "expiresAt": "2026-02-22T13:00:00.000Z"
}
```

---

### TTS 语音合成

```
POST /api/tts/synthesize
```

**请求体**:
```json
{
  "text": "你好，欢迎来到 TRIX 3D Companion",
  "scene": "bot_reply",
  "messageId": "msg_123"
}
```

**响应**:
```
Content-Type: audio/mpeg

[音频二进制数据]
```

---

### Webhook 回调

```
POST /webhook/clawbot
```

**请求头**:
```
x-webhook-secret: <CLAWBOT_WEBHOOK_SECRET>
Content-Type: application/json
```

**请求体**:
```json
{
  "event": "message",
  "data": {
    "deviceId": "device_001",
    "content": "回复内容",
    "timestamp": 1708600000000
  }
}
```

---

## 🔌 WebSocket API

### 连接地址

```
ws://localhost:8765
```

### 事件类型

#### App → Server

| 事件 | 说明 |
|------|------|
| `app_register` | App 注册连接 |
| `request_pairing` | 请求配对 |
| `check_pairing_status` | 检查配对状态 |
| `pair_with_code` | 通过配对码配对 |
| `pair_with_token` | 通过 Token 配对 |
| `app_message` | 发送消息到 Bot |
| `unpair` | 解除配对 |

#### Bot → Server

| 事件 | 说明 |
|------|------|
| `bot_register` | Bot 注册连接 |
| `bot_request_pairing` | Bot 请求配对 |
| `bot_message` | Bot 发送消息到 App |
| `bot_heartbeat` | Bot 心跳 |

---

### 1. App 注册

```javascript
socket.emit('app_register', {
  userId: 'user-uuid',
  deviceId: 'device-001'
});
```

**响应**:
```javascript
socket.on('app_registered', (data) => {
  // data: { success: true, userId: 'user-uuid' }
});
```

---

### 2. 请求配对

```javascript
socket.emit('request_pairing', {
  userId: 'user-uuid'
});
```

**响应**:
```javascript
socket.on('pairing_code', (data) => {
  // data: { code: '123456', expiresIn: 300 }
});

socket.on('pairing_token', (data) => {
  // data: { token: 'uuid-token', qrUrl: 'trix://pair/xxx' }
});
```

---

### 3. 配对码配对 (Bot)

```javascript
socket.emit('pair_with_code', {
  code: '123456',
  deviceId: 'bot-device-001'
});
```

**响应**:
```javascript
socket.on('pairing_success', (data) => {
  // data: { success: true, pairingId: 'xxx' }
});
```

---

### 4. Token 配对

```javascript
socket.emit('pair_with_token', {
  token: 'uuid-token',
  deviceId: 'device-001'
});
```

---

### 5. 发送消息 (App → Bot)

```javascript
socket.emit('app_message', {
  userId: 'user-uuid',
  content: '你好',
  contentType: 'text',
  messageId: 'msg-001',
  timestamp: Date.now()
});
```

**响应**:
```javascript
socket.on('message_sent', (data) => {
  // data: { success: true, messageId: 'msg-001' }
});
```

---

### 6. 接收消息 (Bot → App)

```javascript
socket.emit('bot_message', {
  deviceId: 'bot-device-001',
  content: '你好，有什么可以帮你的？',
  contentType: 'text',
  messageId: 'bot-msg-001',
  timestamp: Date.now()
});
```

---

### 7. 解除配对

```javascript
socket.emit('unpair', {
  userId: 'user-uuid',
  deviceId: 'device-001'
});
```

---

## 📦 消息格式

### App 消息结构

```typescript
interface AppMessage {
  userId: string;
  content: string;
  contentType: 'text' | 'image' | 'audio' | 'video';
  mediaUrl?: string;
  messageId: string;
  threadId?: string;
  timestamp: number;
}
```

### Bot 消息结构

```typescript
interface BotMessage {
  deviceId: string;
  content: string;
  contentType: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  messageId: string;
  timestamp: number;
}
```

---

## 🔄 连接状态

### App 状态流程

```
连接 → app_register → request_pairing → pairing_success
                                         ↓
                                   app_message ↔ bot_message
                                         ↓
                                    unpair → 断开
```

### Bot 状态流程

```
连接 → bot_register → 等待配对 → pairing_success
                               ↓
                         bot_message ↔ app_message
                               ↓
                          bot_heartbeat (定期)
```

---

## ⚠️ 错误处理

### 错误事件

```javascript
socket.on('error', (error) => {
  // error: { code: 'ERROR_CODE', message: 'Error description' }
});
```

### 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_REQUEST` | 请求参数错误 |
| `UNAUTHORIZED` | 未授权 |
| `PAIRING_FAILED` | 配对失败 |
| `DEVICE_NOT_FOUND` | 设备未找到 |
| `MESSAGE_FAILED` | 消息发送失败 |

---

## 🔐 安全配置

### 环境变量

```env
# Webhook 密钥
CLAWBOT_WEBHOOK_SECRET=your-secret-key

# OSS 配置
OSS_ACCESS_KEY_ID=your-access-key
OSS_ACCESS_KEY_SECRET=your-secret-key
OSS_BUCKET=your-bucket
OSS_REGION=oss-cn-hangzhou

# TTS 配置
TTS_SERVICE_URL=https://tts.example.com
```

---

## 📊 服务监控

### PM2 管理

```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs clawbot-channel

# 重启服务
pm2 restart clawbot-channel
```

### 健康检查

```bash
curl http://localhost:8765/health
```

---

**文档版本**: v2.0
**最后更新**: 2026-02-22
**维护者**: TRIX 3D Companion 开发团队
