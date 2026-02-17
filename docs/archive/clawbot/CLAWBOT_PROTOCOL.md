# Clawbot Channel WebSocket 协议规范

> **版本**: v1.0.2
> **最后更新**: 2026-02-17
> **协议**: Socket.io (WebSocket)

---

## 连接信息

```yaml
协议: Socket.io (WebSocket)
服务器地址: ws://47.243.55.130:8765
传输方式: ['websocket', 'polling']
CORS: 允许所有来源
认证: 无需额外认证（Socket.io 连接本身）
```

---

## 连接方式

### Clawbot 端连接

```javascript
const io = require('socket.io-client');

const socket = io('ws://47.243.55.130:8765', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 10000
});
```

### App 端连接

```typescript
import { io } from 'socket.io-client';

const socket = io('wss://47.243.55.130:8765', {
  transports: ['websocket', 'polling'],
  reconnection: true
});
```

---

## 事件列表

### 1. 配对相关事件

#### 1.1 请求配对（Clawbot → Server）

**事件名称**: `bot_request_pairing`

**发送数据**:
```json
{
  "deviceId": "clawbot-001"  // 设备唯一标识符（字符串，必填）
}
```

**回调响应**:
```json
{
  "success": true  // 或 false（失败时）
}
```

#### 1.2 配对信息（Server → Clawbot）

**事件名称**: `pairing_info`

**返回数据**:
```json
{
  "pairingId": "b5bcf730-54e6-4d7e-a2a7-f9f4ac02280a",
  "pairingCode": "X9N3MH",
  "qrImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "expiresIn": 600  // 秒
}
```

#### 1.3 使用配对码配对（App → Server）

**事件名称**: `pair_with_code`

**发送数据**:
```json
{
  "code": "X9N3MH",      // 6 位配对码（必填）
  "userId": "bd49b054-7e8d-45e0-863e-0a7d89d51bf3",  // Supabase 用户 ID（必填）
  "deviceName": "iPhone 13"  // 可选
}
```

**回调响应**:
```json
{
  "success": true,
  "pairingId": "b5bcf730-54e6-4d7e-a2a7-f9f4ac02280a"
}
```

#### 1.4 配对成功（Server → App）

**事件名称**: `pairing_success`

**返回数据**:
```json
{
  "pairingId": "b5bcf730-54e6-4d7e-a2a7-f9f4ac02280a",
  "deviceId": "clawbot-001"
}
```

#### 1.5 用户配对成功（Server → Clawbot）

**事件名称**: `user_paired`

**返回数据**:
```json
{
  "pairingId": "b5bcf730-54e6-4d7e-a2a7-f9f4ac02280a",
  "userId": "bd49b054-7e8d-45e0-863e-0a7d89d51bf3"
}
```

#### 1.6 配对恢复（Server → Clawbot）

**事件名称**: `pairing_restored`

**返回数据**:
```json
{
  "pairingId": "b5bcf730-54e6-4d7e-a2a7-f9f4ac02280a",
  "deviceId": "clawbot-001"
}
```

---

### 2. 消息相关事件

#### 2.1 App 发送消息（App → Server）

**事件名称**: `send_message`

**发送数据**:
```json
{
  "content": "你好 Clawbot",
  "contentType": "text",  // text | image | video | file
  "mediaUrl": "https://...",  // 可选，媒体文件 URL
  "timestamp": 1771140445906
}
```

**回调响应**:
```json
{
  "success": true,
  "messageId": "msg-123456"
}
```

#### 2.2 Clawbot 接收消息（Server → Clawbot）

**事件名称**: `bot_message`

**返回数据**:
```json
{
  "content": "用户消息",
  "contentType": "text",
  "mediaUrl": "https://...",  // 可选
  "timestamp": 1771140445906
}
```

#### 2.3 Clawbot 发送消息（Clawbot → Server）

**事件名称**: `bot_message`

**发送数据**:
```json
{
  "deviceId": "clawbot-001",
  "content": "回复内容",
  "contentType": "text"
}
```

#### 2.4 App 接收消息（Server → App）

**事件名称**: `bot_message`

**返回数据**:
```json
{
  "content": "Clawbot 回复",
  "contentType": "text",
  "timestamp": 1771140445906
}
```

#### 2.5 消息发送确认（Server → Clawbot）

**事件名称**: `message_sent`

**返回数据（成功）**:
```json
{
  "success": true,
  "messageId": "msg-123456"
}
```

**返回数据（失败）**:
```json
{
  "success": false,
  "error": "用户已离线"
}
```

---

### 3. 心跳相关事件

#### 3.1 发送心跳（Client → Server）

**事件名称**: `ping`

**发送数据**:
```json
{
  "timestamp": 1771140445906  // 毫秒时间戳
}
```

**建议**: 每 30 秒发送一次

#### 3.2 心跳响应（Server → Client）

**事件名称**: `pong`

**返回数据**:
```json
{
  "timestamp": 1771140445906
}
```

---

### 4. 错误事件

**事件名称**: `error`

**返回数据**:
```json
{
  "message": "错误消息",
  "code": "PAIRING_CODE_EXPIRED",  // 可选，错误代码
  "hint": "解决建议"  // 可选
}
```

**常见错误代码**:

| 错误代码 | 说明 | 解决方法 |
|---------|------|----------|
| `PAIRING_CODE_EXPIRED` | 配对码已过期 | 重新请求配对码 |
| `PAIRING_CODE_INVALID` | 配对码无效 | 检查配对码是否正确 |
| `DEVICE_NOT_FOUND` | 设备未找到 | 确保 Clawbot 在线 |
| `USER_NOT_AUTHENTICATED` | 用户未登录 | 先登录 Supabase |
| `PAIRING_FAILED` | 配对失败 | 查看详细错误信息 |

---

## 消息流程

### 完整配对流程

```
Clawbot                    Server                    App
   |                         |                         |
   |-- bot_request_pairing -->|                         |
   |   {deviceId}             |                         |
   |                         |                         |
   |<-- pairing_info ---------|                         |
   |   {pairingCode, qrImage} |                         |
   |                         |                         |
   |   显示配对码和二维码        |                         |
   |                         |                         |
   |                         |<-- pair_with_code -------|
   |                         |   {code, userId}         |
   |                         |                         |
   |                         |-- pairing_success ------>|
   |                         |   {pairingId}            |
   |                         |                         |
   |<-- user_paired ----------|                         |
   |   {userId}               |                         |
   |                         |                         |
```

### 消息收发流程

```
App                       Server                   Clawbot
 |                         |                         |
 |-- send_message -------->|                         |
 |   {content}             |                         |
 |                         |-- bot_message --------->|
 |                         |   {content}             |
 |                         |                         |
 |                         |<-- bot_message ---------|
 |                         |   {content}             |
 |                         |                         |
 |<-- bot_message ---------|                         |
 |   {content}             |                         |
 |                         |                         |
```

### 心跳流程

```
Client                    Server
  |                         |
  |-- ping ---------------->|
  |   {timestamp}           |
  |                         |
  |<-- pong -----------------|
  |   {timestamp}           |
  |                         |
```

---

## 数据类型定义

### DeviceId

```typescript
type DeviceId = string;  // 设备唯一标识符
// 示例: "clawbot-001", "clawbot-local-1771140445906"
```

### PairingCode

```typescript
type PairingCode = string;  // 6 位大写字母数字
// 示例: "X9N3MH", "ABC123"
```

### PairingId

```typescript
type PairingId = string;  // UUID v4
// 示例: "b5bcf730-54e6-4d7e-a2a7-f9f4ac02280a"
```

### ContentType

```typescript
type ContentType = 'text' | 'image' | 'video' | 'file';
```

---

## 安全考虑

### 认证

- **Clawbot 端**: 使用 `deviceId` 识别
- **App 端**: 使用 Supabase `userId` 认证
- **服务器端**: 验证配对关系

### 隔离

- 每个 App 用户独立 Room: `user_{userId}`
- Clawbot 通过 `pairingId` 与 App 绑定
- 消息只发送给已配对的设备

### 建议

1. 生产环境使用 WSS（WebSocket Secure）
2. 实现消息签名验证
3. 添加消息加密（可选）
4. 限制配对码有效期
5. 实现配对关系过期机制

---

## 版本历史

### v1.0.2 (2026-02-15)

- ✅ 修复 `user_paired` 事件无法发送的问题
- ✅ 添加 socket 存储逻辑
- ✅ 添加详细调试日志

### v1.0.1 (2026-02-13)

- ✅ 添加配对字段规范
- ✅ 支持 camelCase 和 snake_case

### v1.0.0 (2026-02-11)

- 🎉 初始版本
- ✅ 基础配对和消息功能

---

## 相关文档

- [Clawbot Channel 集成指南](./CLAWBOT_CHANNEL_GUIDE.md) - 完整集成文档
- [Clawbot 部署文档](./CLAWBOT_DEPLOYMENT.md) - 服务器部署配置
