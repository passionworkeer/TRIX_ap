# 🔔 重要：Clawbot 回复功能已部署

## 📋 服务器配置

**服务器地址**：`ws://47.243.55.130:8765`

**新增功能**：
- ✅ 支持 Clawbot 通过 Socket.io 发送消息给 App
- ✅ 新增事件：`bot_message`

---

## 🎯 Clawbot 使用方式

### 方案 1：Socket.io（推荐）

**事件名称**：`bot_message`

**发送数据**：
```json
{
  "deviceId": "clawbot_001",
  "content": "你好！这是回复",
  "contentType": "text"
}
```

**回调事件**：`message_sent`

**返回数据**：
```json
{
  "success": true,
  "messageId": "1234567890"
}
```

**优点**：
- ✅ 无需认证
- ✅ 实时通信
- ✅ 已连接，无延迟

---

### 方案 2：HTTP Webhook（备选）

**接口地址**：`http://47.243.55.130:8765/webhook/clawbot`

**请求头**：
```http
X-Webhook-Secret: trix-2024-secret
Content-Type: application/json
```

**发送数据**：
```json
{
  "deviceId": "clawbot_001",
  "userId": "bd49b054-7e8d-45e0-863e-0a7d89d51bf3",
  "content": "你好！这是回复",
  "contentType": "text"
}
```

**返回**：
- 200 OK：消息发送成功
- 401 Unauthorized：Webhook Secret 错误
- 404 Not Found：配对不存在
- 500 Internal Server Error：服务器错误

---

## 🧪 测试方法

### 测试 Socket.io 方式

```python
import socketio

sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print('✅ 已连接到服务器')
    # 请求配对
    sio.emit('bot_request_pairing', {
        'deviceId': 'clawbot_001'
    })

@sio.on('pairing_info')
def on_pairing_info(data):
    print('📋 配对码:', data['pairingCode'])

@sio.on('app_message')
def on_app_message(data):
    print('📩 收到用户消息:', data)
    content = data['content']

    # 发送回复
    sio.emit('bot_message', {
        'deviceId': 'clawbot_001',
        'content': f'收到！你说：{content}',
        'contentType': 'text'
    })

@sio.on('message_sent')
def on_message_sent(data):
    if data.get('success'):
        print('✅ 消息已发送')
    else:
        print('❌ 发送失败:', data.get('error'))

sio.connect('ws://47.243.55.130:8765')
sio.wait()
```

### 测试 HTTP Webhook

```bash
curl -X POST http://47.243.55.130:8765/webhook/clawbot \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: trix-2024-secret" \
  -d '{
    "deviceId": "clawbot_001",
    "userId": "test-user",
    "content": "测试消息",
    "contentType": "text"
  }'
```

---

## 📊 两种方式对比

| 特性 | Socket.io | HTTP Webhook |
|------|----------|-------------|
| **认证** | 无需认证 | 需要 X-Webhook-Secret |
| **连接** | 已连接，实时 | 独立 HTTP 请求 |
| **延迟** | 低 | 中（网络请求） |
| **复杂度** | 简单 | 需要处理 HTTP |
| **推荐度** | ⭐⭐⭐⭐⭐ 强烈推荐 | ⭐⭐ 可选 |

---

## ⚠️ 常见问题

### 问题 1：401 Unauthorized

**原因**：Webhook Secret 错误或缺失

**解决方案**：
```python
# ✅ 正确
WEBHOOK_SECRET = 'trix-2024-secret'

# ❌ 错误
WEBHOOK_SECRET = 'wrong-secret'
```

### 问题 2：404 Pairing not found

**原因**：deviceId 未配对

**解决方案**：
1. Clawbot 连接后调用 `bot_request_pairing` 生成配对码
2. App 用户扫描或输入配对码
3. Clawbot 调用 `bot_confirm_pairing` 确认配对

### 问题 3：App 收不到消息

**检查步骤**：
1. 服务器日志：`pm2 logs clawbot-channel --lines 50`
2. 查看是否有 `bot_message` 事件记录
3. 查看 App 是否在正确的 Socket.io Room：`user_{userId}`

---

## 📄 相关文档

- **[CLAWBOT_REPLY_IMPLEMENTATION.md](CLAWBOT_REPLY_IMPLEMENTATION.md)** - 完整实现指南
- **[CLAWBOT_API.md](CLAWBOT_API.md)** - API 文档
- **[TEST_GUIDE.md](TEST_GUIDE.md)** - 测试指南
- **[CLAWBOT_PERSISTENT_CONNECTION.md](CLAWBOT_PERSISTENT_CONNECTION.md)** - 持久连接指南

---

**部署时间**：2026-02-15 14:00
**服务器版本**：v1.0.0
**状态**：✅ 已部署并可用
