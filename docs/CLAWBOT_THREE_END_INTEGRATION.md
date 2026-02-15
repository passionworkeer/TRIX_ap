# Clawbot 三端对接完整技术文档

## 📋 文档目的

本文档提供给 **Clawbot 技术团队**，用于实现 Clawbot 端（Python/其他）与服务器和 App 的完整对接。

**三端组成：**
- **服务器端**：ws://47.243.55.130:8765（已完成）
- **App 端**：React Web 应用（已完成）
- **Clawbot 端**：本文档目标（待实现）

---

## 🌐 服务器信息

```
服务器地址：ws://47.243.55.130:8765
协议：Socket.io
传输：WebSocket
认证：无需额外认证（通过 deviceId 识别）
心跳：30 秒一次（ping/pong）
```

---

## 📡 Socket.io 事件完整列表

### 服务器发出的事件（Clawbot 需要监听）

#### 1. `pairing_restored` - 配对已恢复

**触发时机：** Clawbot 重连时，如果有已存在的配对记录

**数据格式：**
```json
{
  "pairingId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceId": "clawbot_xxx"
}
```

**用途：** Clawbot 重连后恢复之前的配对，无需重新配对

---

#### 2. `bot_message` - App 发来的消息

**触发时机：** App 发送消息给 Clawbot

**数据格式：**
```json
{
  "content": "你好",
  "contentType": "text",
  "mediaUrl": "https://...",  // 可选，仅媒体消息
  "timestamp": 1234567890
}
```

**用途：** Clawbot 收到用户消息，处理后回复

---

#### 3. `message_sent` - 消息发送确认

**触发时机：** Clawbot 通过 `bot_message` 发送消息后的确认

**数据格式：**
```json
{
  "success": true,
  "messageId": "1234567890"
}
```

或错误时：
```json
{
  "success": false,
  "error": "错误原因"
}
```

**用途：** 确认消息是否成功送达 App

---

#### 4. `error` - 服务器错误

**触发时机：** 发生错误时

**数据格式：**
```json
{
  "message": "Not paired with any bot",
  "deviceId": "clawbot_xxx"
}
```

或：
```json
{
  "message": "Bot is offline",
  "deviceId": "clawbot_xxx",
  "hint": "请确保 Clawbot 保持连接状态..."
}
```

**用途：** 通知 Clawbot 发生了错误

---

### 服务器监听的事件（Clawbot 需要发送）

#### 1. `bot_request_pairing` - 请求配对

**发送时机：** Clawbot 连接后立即发送

**发送格式：**
```python
sio.emit('bot_request_pairing', {
    'deviceId': 'clawbot_001'
})
```

**服务器响应：** 返回 `pairing_info` 事件

---

#### 2. `bot_confirm_pairing` - 确认配对（已废弃）

**状态：** ⚠️ **不再需要使用！**

服务器现在在 `pair_with_code` 时直接完成配对，不再等待外部确认。

此事件已废弃，但服务器仍支持（向后兼容）。

---

#### 3. `bot_message` - Clawbot 发送消息给 App

**发送时机：** Clawbot 要回复用户消息时

**发送格式：**
```python
sio.emit('bot_message', {
    'deviceId': 'clawbot_001',
    'content': '收到！',
    'contentType': 'text'
})
```

**参数说明：**
- `deviceId`（必填）：Clawbot 的设备 ID
- `content`（必填）：消息内容
- `contentType`（必填）：`text` | `image` | `video` | `file`
- `mediaUrl`（可选）：媒体 URL（当 contentType 非 text 时）

**服务器响应：** 返回 `message_sent` 事件

---

### 其他 Socket.io 事件

#### `ping` / `pong` - 心跳

**发送：** 服务器或客户端定期发送

**格式：**
```json
{
  "timestamp": 1234567890
}
```

**用途：** 保持连接活跃，检测连接状态

---

## 🔄 配对流程详解

### 完整配对时序图

```
Clawbot                服务器                   App
  │                      │                        │
  │ bot_request_pairing  │                        │
  │─────────────────────>│                        │
  │ {deviceId}          │                        │
  │                      │                        │
  │                      │ 生成配对码/二维码           │
  │                      │ 保存到数据库（pending）    │
  │                      │                        │
  │ pairing_info        │                        │
  │<─────────────────────│                        │
  │ {pairingCode,        │                        │
  │  qrImage}           │                        │
  │                      │                        │
  │                      │         用户输入配对码        │
  │                      │<────────────────────────────│
  │                      │    pair_with_code      │
  │                      │    {code, userId}      │
  │                      │                        │
  │                      │  验证配对码              │
  │                      │ 绑定 userId 到配对记录    │
  │                      │ 检查 Bot 是否在线 ✅ 新增  │
  │                      │ 如果在线 → 完成配对       │
  │                      │ 更新状态为 paired          │
  │                      │                        │
  │                      │    pairing_success    │
  │                      │<───────────────────────────│
  │                      │ {deviceId, deviceName,     │
  │                      │  pairingId}            │
  │                      │                        │
  │                      │   App: 配对成功！         │
  │                      │   isPaired = true         │
```

---

## 📨 配对流程分步详解

### 步骤 1：Clawbot 连接并请求配对

**Clawbot 端代码：**
```python
import socketio

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print('✅ 已连接到服务器')
    # 连接成功后立即请求配对
    sio.emit('bot_request_pairing', {
        'deviceId': 'clawbot_001'
    })

sio.connect('ws://47.243.55.130:8765')
sio.wait()
```

**服务器处理：**
```javascript
socket.on('bot_request_pairing', async (data, callback) => {
  const { deviceId } = data;

  // 1. 检查是否已有配对记录
  const existing = await pairingService.getPairingByDeviceId(deviceId);

  if (existing && existing.user_id) {
    // 已有完整配对，恢复配对
    socket.emit('pairing_restored', {
      pairingId: existing.id,
      deviceId: existing.device_id
    });
  } else {
    // 创建新的配对记录
    const pairing = await pairingService.createBotPairing(deviceId);

    // 存储 Clawbot socket（重要！）
    botSockets.set(deviceId, socket);
    socket.deviceId = deviceId;
    socket.isBot = true;
    socket.pairingId = pairing.id;

    // 返回配对信息
    socket.emit('pairing_info', {
      pairingId: pairing.id,
      pairingCode: pairing.pairingCode,
      qrImage: pairing.qrImage,
      expiresIn: 600  // 10 分钟
    });
  }

  callback({ success: true, restored: !!existing });
});
```

---

### 步骤 2：App 扫描二维码或输入配对码

**App 端代码：**
```typescript
// ClawbotChannelBridge.requestPairing()
this.socket.emit('request_pairing', {
  userId: this.userId,
  deviceName: 'TRIX Mobile App'
}, (response) => {
  if (response.success) {
    this.pairingCode = response.pairingCode;
    this.qrImage = response.qrImage;
    // 显示配对码和二维码
  }
});
```

---

### 步骤 3：App 通过配对码完成配对

**App 端代码：**
```typescript
// ClawbotChannelBridge.pairWithCode(code)
this.socket.emit('pair_with_code', {
  code: code.toUpperCase(),
  userId: this.userId
}, (response) => {
  if (response.success) {
    console.log('配对码验证成功');
    this.isPaired = true;
    this.deviceId = response.deviceId;
  } else {
    console.error('配对失败:', response.error);
  }
});
```

**服务器处理：**
```javascript
socket.on('pair_with_code', async (data, callback) => {
  const { code, userId } = data;

  // 1. 验证配对码
  const result = await pairingService.verifyPairingCode(code);

  if (!result.success) {
    return callback({ success: false, error: 'Invalid or expired pairing code' });
  }

  // 2. 绑定 userId 到配对记录
  await pairingService.bindUserToPairing(result.pairing.id, userId);

  // 3. ✅ 检查 Bot 是否在线（新增）
  if (!botSockets.has(result.pairing.device_id)) {
    console.log('[App] Bot offline, cannot complete pairing');
    return callback({
      success: false,
      error: 'Clawbot is offline. Please ensure Clawbot is connected and try pairing again.'
    });
  }

  // 4. 完成配对
  await pairingService.completeBotPairing(
    result.pairing.id,
    result.pairing.device_id,
    socket.id
  );

  // 5. 通知 App 配对成功
  io.to(`user_${userId}`).emit('pairing_success', {
    deviceId: result.pairing.device_id,
    deviceName: 'Clawbot',
    pairingId: result.pairing.id
  });

  callback({
    success: true,
    pairingId: result.pairing.id,
    status: 'paired'
  });
});
```

---

### 步骤 4：App 收到配对成功

**App 端代码：**
```typescript
this.socket.on('pairing_success', (data: {
  deviceId: string,
  deviceName: string,
  pairingId: string
}) => {
  console.log('配对成功:', data);

  // 更新状态
  this.isPaired = true;
  this.deviceId = data.deviceId;

  // 保存到本地存储
  localStorage.setItem('clawbot_paired', 'true');
  localStorage.setItem('clawbot_device_id', data.deviceId);

  // 导航到聊天界面
  navigate('/chat/detail', {
    state: {
      friendId: 'clawbot',
      name: 'TRIX Bot',
      avatar: IMAGES.WIZARD_BOY,
      isBot: true
    }
  });
});
```

---

### 步骤 5：Clawbot 重连时恢复配对

**Clawbot 端代码：**
```python
@sio.on('pairing_restored')
def on_pairing_restored(data):
    pairing_id = data['pairingId']
    device_id = data['deviceId']
    print(f'✅ 配对已恢复: {device_id}')

    # Clawbot 现在可以正常收发消息
```

**服务器处理：**
```javascript
socket.on('bot_request_pairing', async (data, callback) => {
  // 检查是否已有配对记录
  const existing = await pairingService.getPairingByDeviceId(deviceId);

  if (existing && existing.user_id) {
    // 已有完整配对，通知 Bot 配对已恢复
    socket.emit('pairing_restored', {
      pairingId: existing.id,
      deviceId: existing.device_id
    });

    // 存储 Clawbot socket
    botSockets.set(deviceId, socket);
    socket.deviceId = deviceId;
    socket.isBot = true;
    socket.pairingId = existing.id;

    console.log(`[Bot] Pairing restored for ${deviceId}, total bots: ${botSockets.size}`);

    callback({ success: true, restored: true });
  }
});
```

---

## 💬 消息收发流程详解

### App → Clawbot

#### 步骤 1：App 发送消息

**App 端代码：**
```typescript
// ClawbotChannelBridge.sendMessage(content, contentType, mediaUrl)
this.socket.emit('app_message', {
  content: '你好 Clawbot',
  contentType: 'text',
  mediaUrl: undefined  // 可选
});
```

**服务器处理：**
```javascript
socket.on('app_message', async (data) => {
  const { content, contentType, mediaUrl } = data;
  const userId = socket.userId;

  // 1. 获取配对信息
  const pairing = await pairingService.getPairingByUserId(userId);

  if (!pairing || pairing.status !== 'paired') {
    socket.emit('error', {
      message: 'Not paired with any bot'
    });
    return;
  }

  // 2. 检查 Bot 是否在线
  const botSocket = botSockets.get(pairing.device_id);

  if (!botSocket) {
    socket.emit('error', {
      message: 'Bot is offline',
      deviceId: pairing.device_id,
      hint: '请确保 Clawbot 保持连接状态。如果 Clawbot 已关闭，请重新启动并连接。'
    });
    return;
  }

  // 3. 保存消息到数据库
  await messageService.saveMessage(
    pairing.id,
    'app_to_bot',
    content,
    contentType,
    mediaUrl
  );

  // 4. 转发给 Bot
  botSocket.emit('bot_message', {
    content,
    contentType,
    mediaUrl,
    timestamp: Date.now()
  });

  console.log(`[App] Message forwarded to bot ${pairing.device_id}`);
});
```

---

#### 步骤 2：Clawbot 收到消息

**Clawbot 端代码：**
```python
@sio.on('bot_message')
def on_bot_message(msg):
    content = msg['content']
    content_type = msg['contentType']
    media_url = msg.get('mediaUrl')

    print(f'📩 收到消息: {content}')

    # 处理消息（调用 AI）
    reply_content = process_with_ai(content, content_type)

    # 发送回复
    send_reply(reply_content, 'text')
```

---

### Clawbot → App

#### 步骤 1：Clawbot 发送回复

**Clawbot 端代码：**
```python
def send_reply(content, content_type='text', media_url=None):
    sio.emit('bot_message', {
        'deviceId': 'clawbot_001',
        'content': content,
        'contentType': content_type
    })

# 监听发送确认
@sio.on('message_sent')
def on_message_sent(response):
    if response.get('success'):
        print('✅ 消息已发送')
    else:
        print(f'❌ 发送失败: {response.get("error")}')
```

**服务器处理：**
```javascript
socket.on('bot_message', async (data) => {
  const { deviceId, content, contentType, mediaUrl } = data;

  // 1. 获取配对信息
  const pairing = await pairingService.getPairingByDeviceId(deviceId);

  if (!pairing || pairing.status !== 'paired') {
    socket.emit('error', {
      message: 'Not paired or invalid pairing status',
      deviceId
    });
    return;
  }

  // 2. 保存消息到数据库
  await messageService.saveMessage(
    pairing.id,
    'bot_to_app',
    content,
    contentType,
    mediaUrl
  );

  // 3. 转发给 App
  io.to(`user_${pairing.user_id}`).emit('bot_message', {
    content,
    contentType,
    mediaUrl,
    timestamp: Date.now()
  });

  // 4. 确认给 Clawbot
  socket.emit('message_sent', {
    success: true,
    messageId: Date.now().toString()
  });
});
```

---

#### 步骤 2：App 收到回复

**App 端代码：**
```typescript
this.socket.on('bot_message', (msg: {
  content: string;
  contentType: string;
  mediaUrl?: string;
  timestamp: number
}) => {
  console.log('收到 Bot 消息:', msg);

  // 添加到消息列表
  const message: ClawbotChannelMessage = {
    id: Date.now().toString(),
    content: msg.content,
    contentType: msg.contentType,
    mediaUrl: msg.mediaUrl,
    timestamp: msg.timestamp,
    isIncoming: true
  };

  this.messages.next([...this.messages(), message]);
});
```

---

## ⚠️ 已知问题和修复

### 问题 1：Bot 离线时仍完成配对

**现象：**
```
✅ Clawbot 连接 → 生成配对码
❌ Clawbot 1 分钟后断开
✅ App 输入配对码 → 服务器完成配对
❌ App 尝试发送消息 → "Bot is offline"
```

**原因：** 服务器在 `pair_with_code` 时没有检查 Bot socket 是否在线

**修复：** 已添加 Bot 在线检查（2026-02-15 15:10）
```javascript
// ✅ 完成配对前检查 Bot 是否在线
if (!botSockets.has(result.pairing.device_id)) {
  console.log(`[App] Bot offline, cannot complete pairing`);
  return callback({
    success: false,
    error: 'Clawbot is offline. Please ensure Clawbot is connected and try pairing again.'
  });
}
```

---

### 问题 2：变量作用域错误

**现象：**
```
ReferenceError: pairing is not defined
at server.js:289:66
```

**原因：** 使用了未定义的变量名

**修复：** 已修复（2026-02-15 15:00）
```javascript
// ❌ 错误
await pairingService.completeBotPairing(result.pairing.id, pairing.device_id, socket.id);

// ✅ 正确
await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);
```

---

### 问题 3：Callback 未定义

**现象：**
```
TypeError: callback is not a function
at server.js:300:7
```

**原因：** Socket.io 客户端可能不提供 callback

**修复：** 已添加类型检查（2026-02-15 15:00）
```javascript
// ✅ 添加类型检查
if (typeof callback === 'function') {
  callback({ success: true });
}
```

---

## 📦 Clawbot 端实现要求

### 必须实现的功能

#### 1. Socket.io 连接

```python
import socketio

SERVER_URL = 'ws://47.243.55.130:8765'
DEVICE_ID = 'clawbot_001'

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print(f'✅ 已连接到服务器: {SERVER_URL}')

    # 连接后立即请求配对
    sio.emit('bot_request_pairing', {'deviceId': DEVICE_ID})

sio.connect(SERVER_URL)
sio.wait()
```

**要求：**
- ✅ 连接到 `ws://47.243.55.130:8765`
- ✅ 连接成功后发送 `bot_request_pairing`
- ✅ 传输协议：WebSocket
- ✅ 实现 reconnection（自动重连）

---

#### 2. 监听配对事件

```python
@sio.on('pairing_info')
def on_pairing_info(data):
    pairing_code = data['pairingCode']
    qr_image = data.get('qrImage')
    expires_in = data['expiresIn']

    print(f'📋 配对码: {pairing_code}')
    print(f'⏰ 有效期: {expires_in} 秒')

    # 显示二维码和配对码
    display_qr_code(qr_image, pairing_code)

@sio.on('pairing_restored')
def on_pairing_restored(data):
    device_id = data['deviceId']
    print(f'✅ 配对已恢复: {device_id}')

@sio.on('error')
def on_error(data):
    error_msg = data.get('message', 'Unknown error')
    print(f'❌ 错误: {error_msg}')
```

**要求：**
- ✅ 监听 `pairing_info` - 收到配对码
- ✅ 监听 `pairing_restored` - 重连时恢复配对
- ✅ 监听 `error` - 处理错误
- ✅ 显示配对码（用户输入或二维码）

---

#### 3. 监听和发送消息

```python
@sio.on('bot_message')
def on_bot_message(msg):
    content = msg['content']
    content_type = msg['contentType']
    media_url = msg.get('mediaUrl')

    print(f'📩 收到消息: {content}')

    # 处理消息（调用 AI 模型）
    reply_content = process_with_ai(content, content_type)

    # 发送回复
    send_reply(reply_content, 'text')

def send_reply(content, content_type='text', media_url=None):
    sio.emit('bot_message', {
        'deviceId': DEVICE_ID,
        'content': content,
        'contentType': content_type
    })

    # 可选：监听发送确认
    @sio.on('message_sent')
    def on_message_sent(response):
        if response.get('success'):
            print('✅ 消息已发送')
        else:
            print(f'❌ 发送失败: {response.get("error")}')
```

**要求：**
- ✅ 监听 `bot_message` - 收 App 发来的消息
- ✅ 发送 `bot_message` - 回复消息给 App
- ✅ 监听 `message_sent` - 确认发送成功
- ✅ 实现 AI 处理逻辑（调用大模型）
- ✅ 保持 WebSocket 连接

---

#### 4. 心跳和重连

```python
import threading

def heartbeat():
    """定期发送心跳"""
    while True:
        sio.emit('ping', {'timestamp': time.time() * 1000})
        time.sleep(30)  # 每 30 秒

@sio.on('pong')
def on_pong(data):
    last_pong_time = time.time() * 1000
    print('💓 心跳正常')

# 启动心跳线程
threading.Thread(target=heartbeat, daemon=True).start()

@sio.on('disconnect')
def on_disconnect():
    print('❌ 已断开连接，准备重连...')
    time.sleep(5)
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print(f'❌ 重连失败: {e}')
        time.sleep(10)
        sio.connect(SERVER_URL)
```

**要求：**
- ✅ 每 30 秒发送一次 `ping`
- ✅ 监听 `pong` 响应
- ✅ 实现 `disconnect` 处理
- ✅ 自动重连（指数退避）

---

#### 5. 错误处理

```python
@sio.on('error')
def on_socket_error(err):
    print(f'❌ Socket.io 错误: {err}')

@sio.on('connect_error')
def on_connect_error(err):
    print(f'❌ 连接失败: {err}')
    print('🔄 5 秒后重试...')
    time.sleep(5)
```

**要求：**
- ✅ 捕获所有连接错误
- ✅ 实现重试逻辑
- ✅ 记录详细错误日志

---

## 🧪 测试验证方法

### 测试 1：配对流程

**前提：**
- Clawbot 保持连接
- App 已打开

**步骤：**
1. Clawbot 连接 → 生成配对码 ABC123
2. App 输入配对码：ABC123
3. 验证配对成功

**预期结果：**
- ✅ Clawbot 控制台：`📋 配对码: ABC123`
- ✅ App 控制台：`配对成功`
- ✅ App 跳转到聊天界面
- ✅ `isPaired = true`

**验证命令：**
```bash
# 服务器日志
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 20 | grep -E '(Pairing generated|Bot online|Pairing success)'"

# 数据库状态
ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db \
  'SELECT status FROM pairings WHERE device_id=\"clawbot_001\" ORDER BY created_at DESC LIMIT 1'"
```

**预期输出：**
```
[Bot] Pairing generated: ABC123
[App] Bot online (clawbot_001), completing pairing...
[App] Pairing success: ABC123

paired
```

---

### 测试 2：消息收发

**前提：**
- 已完成配对
- Clawbot 保持连接

**步骤：**
1. App 发送消息："你好"
2. Clawbot 收到并回复："收到！"
3. App 收到回复

**预期结果：**
- ✅ Clawbot 控制台：`📩 收到消息: 你好`
- ✅ Clawbot 控制台：`✅ 消息已发送`
- ✅ App 界面显示两条消息

**验证命令：**
```bash
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 30 | grep -E '(Message forwarded|bot_message|message_sent)'"
```

**预期输出：**
```
[App] Message forwarded to bot clawbot_001
[Bot] Message from clawbot_001 to user_xxx
message_sent: { success: true }
```

---

### 测试 3：Bot 重连

**步骤：**
1. Clawbot 连接并配对
2. Clawbot 断开（Ctrl+C）
3. Clawbot 重新连接

**预期结果：**
- ✅ Clawbot 收到 `pairing_restored` 事件
- ✅ 不需要重新配对
- ✅ 可以直接收发消息

**验证命令：**
```bash
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 20 | grep -E '(Pairing restored|reconnecting)'"
```

**预期输出：**
```
[Bot] Clawbot xxx reconnecting, restoring pairing
[Bot] Pairing restored for clawbot_xxx, total bots: 1
```

---

## 📊 数据格式说明

### pairing_info 事件

```json
{
  "pairingId": "550e8400-e29b-41d4-a716-446655440000",
  "pairingCode": "ABC123",
  "qrImage": "data:image/png;base64,iVBORw0KGgo...",
  "expiresIn": 600
}
```

**字段说明：**
- `pairingId`：配对记录 ID（UUID）
- `pairingCode`：6 位大写配对码
- `qrImage`：二维码图片（Data URL）
- `expiresIn`：过期时间（秒）

---

### bot_message 事件（App → Clawbot）

```json
{
  "content": "你好",
  "contentType": "text",
  "mediaUrl": "https://...",
  "timestamp": 1234567890
}
```

**字段说明：**
- `content`：消息内容（必填）
- `contentType`：`text` | `image` | `video` | `file`
- `mediaUrl`：媒体 URL（可选，仅非 text 消息）
- `timestamp`：时间戳（毫秒）

---

### bot_message 事件（Clawbot → App）

```json
{
  "deviceId": "clawbot_001",
  "content": "收到！",
  "contentType": "text",
  "mediaUrl": "https://..."  // 可选
}
```

**字段说明：**
- `deviceId`：Clawbot 设备 ID（必填）
- `content`：消息内容（必填）
- `contentType`：`text` | `image` | `video` | `file`
- `mediaUrl`：媒体 URL（可选）

---

## 🔧 服务器配置

### 环境变量

```bash
NODE_ENV=production
PORT=8765
PAIRING_TOKEN_EXPIRY=600000  # 10 分钟（毫秒）
```

### 数据库

```bash
SQLite: /opt/clawbot-channel/data/pairing.db

表结构：
- pairings（配对记录）
- messages（消息记录）
```

---

## 📝 实现检查清单

### Clawbot 端必须实现

- [ ] Socket.io 客户端连接到 `ws://47.243.55.130:8765`
- [ ] 发送 `bot_request_pairing` 事件
- [ ] 监听 `pairing_info` 事件并处理
- [ ] 监听 `pairing_restored` 事件并处理
- [ ] 监听 `bot_message` 事件并处理
- [ ] 发送 `bot_message` 事件（回复消息）
- [ ] 监听 `message_sent` 事件（确认）
- [ ] 监听 `error` 事件并处理
- [ ] 实现心跳（每 30 秒 `ping`）
- [ ] 监听 `pong` 事件
- [ ] 实现自动重连
- [ ] 实现 AI 消息处理
- [ ] 错误处理和日志

### 服务器端（已完成）

- [x] `bot_request_pairing` 处理
- [x] `pair_with_code` 处理（含 Bot 在线检查）
- [x] `pair_with_token` 处理（含 Bot 在线检查）
- [x] `app_message` 处理
- [x] `bot_message` 处理
- [x] 心跳 `ping`/`pong` 处理
- [x] `error` 事件处理

### App 端（已完成）

- [x] `app_register` 注册
- [x] `pair_with_code` 发送
- [x] `pair_with_token` 发送
- [x] `app_message` 发送
- [x] `bot_message` 监听
- [x] `pairing_success` 监听
- [x] `error` 监听
- [x] 心跳实现

---

## 📞 故障排除

### 问题 1：Clawbot 无法连接

**检查：**
```bash
# 服务器状态
ssh root@47.243.55.130 "pm2 status"

# 端口监听
ssh root@47.243.55.130 "netstat -tlnp | grep 8765"
```

**预期输出：**
```
clawbot-channel: online
tcp6 :::8765 LISTEN 346131/node
```

---

### 问题 2：配对码"无效或过期"

**可能原因：**
1. 配对码已过期（10 分钟）
2. Clawbot 已断开
3. 数据库中配对码不存在

**检查：**
```bash
ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db \
  'SELECT pairing_code, status, expires_at, datetime(\"now\") as now \
   FROM pairings WHERE pairing_code=\"ABC123\"'"
```

**解决方案：**
- Clawbot 保持连接
- 重新生成配对码
- 在 10 分钟内完成配对

---

### 问题 3："Bot is offline"

**原因：** Clawbot socket 未在 `botSockets` 中

**检查：**
```bash
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 50 | \
  grep -E '(Bot.*Socket stored|Bot disconnected|Total bots)'"
```

**预期输出：**
```
[Bot] Socket stored for device clawbot_xxx, total bots: 1
```

**解决方案：**
- 确保 Clawbot 保持连接
- 检查网络稳定性
- 实现自动重连

---

## 📄 相关文档

- [SERVER_PAIRING_FIX_REPORT.md](SERVER_PAIRING_FIX_REPORT.md) - 配对功能修复报告
- [SERVER_BOT_ONLINE_CHECK_FIX.md](SERVER_BOT_ONLINE_CHECK_FIX.md) - Bot 在线检查修复
- [CLAWBOT_API.md](CLAWBOT_API.md) - API 文档
- [CLAWBOT_REPLY_IMPLEMENTATION.md](CLAWBOT_REPLY_IMPLEMENTATION.md) - 回复功能实现
- [CLAWBOT_PERSISTENT_CONNECTION.md](CLAWBOT_PERSISTENT_CONNECTION.md) - 持久连接要求

---

## ✅ 总结

**服务器端：** ✅ 已完成
- 所有 Socket.io 事件已实现
- Bot 在线检查已添加
- 所有已知 bug 已修复
- 配对和消息流程正常工作

**App 端：** ✅ 已完成
- ClawbotChannel 完整实现
- 所有事件监听和发送已实现
- UI 和状态管理已完成

**Clawbot 端：** ⏳ 待实现
- 需要实现 Socket.io 客户端
- 需要实现所有事件监听和发送
- 需要实现 AI 消息处理
- 需要实现心跳和重连

---

**本文档版本：** v1.0.0
**编写日期：** 2026-02-15
**编写人员：** 服务器技术团队
**服务器版本：** v1.0.2
**状态：** ✅ 服务器和 App 端完成，等待 Clawbot 端实现

---

## 📞 技术支持

如果在实现过程中遇到问题：

1. 查看本文档相关章节
2. 查看服务器日志：`pm2 logs clawbot-channel --lines 100`
3. 查看相关 API 文档
4. 联系服务器技术团队

**服务器地址：** ws://47.243.55.130:8765
**文档位置：** `docs/` 目录

---

**祝 Clawbot 技术团队实现顺利！** 🚀
