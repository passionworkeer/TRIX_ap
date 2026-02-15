# Clawbot 消息回复实现指南

## 🎯 目标

让 Clawbot 能够回复 App 发送的消息，完成双向通信。

---

## ✅ 已完成

- ✅ App → 服务器 → Clawbot：消息接收正常
- ✅ 服务器已支持两种回复方式

---

## 🔧 方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Socket.io** | 无需认证，实时，简单 | 需要保持连接 | ⭐⭐⭐⭐⭐ 强烈推荐 |
| **HTTP Webhook** | 无状态，独立请求 | 需要认证，额外 HTTP | ⭐⭐⭐ 可用 |

---

## 📡 方案 1：Socket.io（推荐）

### 为什么推荐 Socket.io？

1. **无需认证**：Clawbot 已通过 `bot_request_pairing` 建立连接
2. **实时通信**：消息立即送达，无延迟
3. **代码简单**：使用现有连接，无需额外 HTTP 请求
4. **自动重连**：Socket.io 内置重连机制

---

### 完整实现代码

#### Python 示例

```python
import socketio
import time

# 创建 Socket.io 客户端
sio = socketio.Client()

# 配置
DEVICE_ID = 'clawbot-001'
SERVER_URL = 'ws://47.243.55.130:8765'

# ========== 1. 连接和配对 ==========

@sio.event
def connect():
    print('✅ 已连接到服务器')
    # 连接成功后立即请求配对或恢复配对
    sio.emit('bot_request_pairing', {
        'deviceId': DEVICE_ID
    })

@sio.on('pairing_info')
def on_pairing_info(data):
    """收到配对信息"""
    print('📋 配对码:', data['pairingCode'])
    print('🆔 配对ID:', data['pairingId'])
    # 显示二维码...

@sio.on('pairing_restored')
def on_pairing_restored(data):
    """配对已恢复（重连时）"""
    print('✅ 配对已恢复！')
    print('用户ID:', data['userId'])

@sio.on('user_paired')
def on_user_paired(data):
    """用户已配对"""
    print('👤 用户已配对:', data['userId'])
    # 确认配对
    sio.emit('bot_confirm_pairing', {
        'deviceId': DEVICE_ID,
        'pairingId': data['pairingId']
    }, callback=on_pairing_confirmed)

def on_pairing_confirmed(response):
    """配对确认回调"""
    if response.get('success'):
        print('✅ 配对完成！')
    else:
        print('❌ 配对失败:', response.get('error'))

# ========== 2. 接收消息 ==========

@sio.on('app_message')
def on_app_message(data):
    """收到用户消息"""
    print('📩 收到用户消息:', data)
    user_id = data.get('userId')
    content = data.get('content')
    content_type = data.get('contentType', 'text')

    # 处理消息（调用 AI 模型）
    reply = process_message(content, content_type)

    # 发送回复
    send_reply(DEVICE_ID, reply, 'text')

# ========== 3. 发送消息（Socket.io 方式）==========

def send_reply(device_id, content, content_type='text', media_url=None):
    """发送回复给用户（通过 Socket.io）"""
    try:
        message_data = {
            'deviceId': device_id,
            'content': content,
            'contentType': content_type
        }

        if media_url:
            message_data['mediaUrl'] = media_url

        sio.emit('bot_message', message_data)
        print('✅ 消息已发送:', content)

    except Exception as e:
        print('❌ 发送消息失败:', e)

@sio.on('message_sent')
def on_message_sent(response):
    """消息发送结果"""
    if response.get('success'):
        print('✅ 服务器确认消息已发送')
    else:
        print('❌ 消息发送失败:', response.get('error'))

# ========== 4. AI 处理 ==========

def process_message(content, content_type):
    """
    处理用户消息，生成回复
    TODO: 替换为实际的 AI 模型调用
    """
    if content_type == 'text':
        # 示例：简单的回复逻辑
        if '你好' in content or 'hello' in content.lower():
            return '你好！我是 TRIX Bot，很高兴为您服务！'
        elif '帮助' in content or 'help' in content.lower():
            return '我可以帮助您解答问题、提供建议。请告诉我您需要什么帮助？'
        else:
            return f'收到您的消息："{content}"。我正在思考如何回复...'

    elif content_type == 'image':
        return '我收到了您发送的图片。'

    return '收到！'

# ========== 5. 错误处理和重连 ==========

@sio.on('error')
def on_error(data):
    """服务器错误"""
    print('❌ 服务器错误:', data)

@sio.event
def disconnect():
    """断开连接"""
    print('❌ 已断开连接，准备重连...')
    time.sleep(5)
    try:
        sio.connect(SERVER_URL)
    except Exception as e:
        print('❌ 重连失败:', e)
        time.sleep(10)
        sio.connect(SERVER_URL)

# ========== 6. 心跳检测（可选）==========

import threading

def heartbeat():
    """定期发送心跳"""
    while True:
        time.sleep(30)
        try:
            sio.emit('ping', callback=lambda res: print('💓 心跳成功'))
        except:
            pass

# 启动心跳线程
threading.Thread(target=heartbeat, daemon=True).start()

# ========== 7. 主程序 ==========

if __name__ == '__main__':
    try:
        print('🚀 启动 Clawbot...')
        sio.connect(SERVER_URL)
        sio.wait()  # 保持连接
    except KeyboardInterrupt:
        print('\n👋 正在关闭...')
        sio.disconnect()
    except Exception as e:
        print('❌ 启动失败:', e)
        # 自动重连
        time.sleep(10)
        sio.connect(SERVER_URL)
        sio.wait()
```

---

## 🌐 方案 2：HTTP Webhook（备选）

### 使用场景

如果 Clawbot 无法保持 Socket.io 连接，可以使用 HTTP Webhook。

---

### 服务器配置

**Webhook Secret**: `trix-2024-secret`

**接口地址**: `http://47.243.55.130:8765/webhook/clawbot`

---

### 完整实现代码

#### Python 示例

```python
import requests
import json

# 配置
WEBHOOK_URL = 'http://47.243.55.130:8765/webhook/clawbot'
WEBHOOK_SECRET = 'trix-2024-secret'
DEVICE_ID = 'clawbot-001'

def send_reply_via_webhook(content, content_type='text', media_url=None):
    """通过 HTTP Webhook 发送回复"""

    headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET  # ⚠️ 必须包含认证头
    }

    payload = {
        'deviceId': DEVICE_ID,
        'content': content,
        'contentType': content_type
    }

    if media_url:
        payload['mediaUrl'] = media_url

    try:
        response = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)

        if response.status_code == 200:
            result = response.json()
            print('✅ 消息已发送:', content)
            return True
        elif response.status_code == 401:
            print('❌ 认证失败：Webhook Secret 错误')
            return False
        elif response.status_code == 404:
            print('❌ 配对不存在：请先配对')
            return False
        else:
            print(f'❌ 发送失败: {response.status_code} - {response.text}')
            return False

    except requests.exceptions.Timeout:
        print('❌ 请求超时')
        return False
    except Exception as e:
        print('❌ 发送失败:', e)
        return False

# 示例：发送文本消息
send_reply_via_webhook('你好！这是来自 Clawbot 的回复。')

# 示例：发送图片
send_reply_via_webhook('图片已生成', content_type='image', media_url='https://example.com/image.jpg')
```

---

### 错误处理

| 状态码 | 错误 | 原因 | 解决方案 |
|--------|------|------|----------|
| 401 | Unauthorized | Webhook Secret 错误或缺失 | 检查 `X-Webhook-Secret` 请求头 |
| 404 | Pairing not found | deviceId 未配对 | 先调用 `bot_request_pairing` 配对 |
| 500 | Internal Server Error | 服务器错误 | 查看服务器日志，联系管理员 |

---

## 🧪 测试步骤

### 测试 1：Socket.io 方式

1. **启动 Clawbot**：
   ```bash
   python clawbot.py
   ```

2. **Clawbot 连接并配对**：
   - 查看控制台输出配对码
   - 显示二维码

3. **App 发送消息**：
   - 打开 App，进入聊天界面
   - 发送消息："你好"

4. **Clawbot 自动回复**：
   - 控制台显示：`📩 收到用户消息: 你好`
   - 控制台显示：`✅ 消息已发送: 你好！我是 TRIX Bot...`

5. **App 收到回复**：
   - App 界面显示 Clawbot 的回复

---

### 测试 2：HTTP Webhook 方式

1. **手动测试 Webhook**：
   ```bash
   curl -X POST http://47.243.55.130:8765/webhook/clawbot \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: trix-2024-secret" \
     -d '{"deviceId":"clawbot-001","content":"测试消息","contentType":"text"}'
   ```

2. **预期返回**：
   ```json
   {"success": true}
   ```

3. **App 收到消息**：
   - 检查 App 是否收到测试消息

---

## 📊 完整流程图

```
App                    Server                  Clawbot
 │                        │                        │
 │  app_message           │                        │
 │────────────────────────>│                        │
 │  {content: "你好"}     │                        │
 │                        │  app_message           │
 │                        │────────────────────────>│
 │                        │  {content: "你好"}     │
 │                        │                        │
 │                        │                        │  AI 处理
 │                        │                        │  生成回复
 │                        │                        │
 │                        │  bot_message           │
 │                        │<────────────────────────│
 │                        │  {content: "你好！..."}│
 │                        │                        │
 │  bot_message           │                        │
 │<────────────────────────│                        │
 │  {content: "你好！..."}│                        │
 │                        │                        │
 │  显示回复              │                        │
```

---

## 🚨 常见问题

### 问题 1：Clawbot 发送消息后没有确认

**症状**：`bot_message` 发送后，没有收到 `message_sent` 事件

**可能原因**：
1. Clawbot 未配对
2. Socket.io 连接断开
3. 服务器错误

**解决方案**：
```python
# 添加超时检测
import time

def send_reply_with_timeout(device_id, content):
    sio.emit('bot_message', {
        'deviceId': device_id,
        'content': content,
        'contentType': 'text'
    })

    # 等待确认（3秒超时）
    time.sleep(3)
    print('⚠️ 未收到服务器确认，但消息可能已发送')
```

---

### 问题 2：Webhook 返回 401 Unauthorized

**原因**：`X-Webhook-Secret` 请求头错误

**解决方案**：
```python
# ✅ 正确
headers = {
    'X-Webhook-Secret': 'trix-2024-secret'  # 使用正确的 secret
}

# ❌ 错误
headers = {
    'X-Webhook-Secret': 'wrong-secret'  # secret 错误
}
```

---

### 问题 3：App 收不到消息

**检查步骤**：

1. **检查 Clawbot 是否已配对**：
   ```bash
   ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT device_id, user_id, status FROM pairings WHERE device_id=\"clawbot-001\"'"
   ```

2. **检查 App 是否已加入 Room**：
   - 查看服务器日志：`[App] App registered: user_xxx`

3. **检查消息是否发送成功**：
   - 查看服务器日志：`[Bot] Message from clawbot-001`

---

## 🔧 调试命令

### 查看服务器日志

```bash
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 50"
```

### 查看配对记录

```bash
ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT * FROM pairings WHERE status=\"paired\"'"
```

### 查看消息记录

```bash
ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT * FROM messages ORDER BY created_at DESC LIMIT 10'"
```

---

## 📝 Clawbot 团队待办事项

### 立即行动

- [ ] 选择消息发送方式（推荐 Socket.io）
- [ ] 实现消息接收处理（`app_message` 事件）
- [ ] 实现 AI 回复逻辑
- [ ] 实现消息发送函数（`bot_message` 事件）
- [ ] 测试完整流程

### 可选优化

- [ ] 实现心跳检测（30秒一次）
- [ ] 实现自动重连
- [ ] 实现离线消息缓存
- [ ] 实现消息发送重试
- [ ] 添加日志记录

---

## 🎯 推荐架构

### 方案 A：简单实现（推荐新手）

```python
# 1. 连接服务器
sio.connect('ws://47.243.55.130:8765')

# 2. 请求配对
sio.emit('bot_request_pairing', {'deviceId': 'clawbot-001'})

# 3. 监听消息
@sio.on('app_message')
def on_app_message(data):
    # 简单回复
    sio.emit('bot_message', {
        'deviceId': 'clawbot-001',
        'content': '收到！',
        'contentType': 'text'
    })

# 4. 保持连接
sio.wait()
```

---

### 方案 B：生产级实现（推荐）

```python
# 完整功能：
# - 自动重连
# - 心跳检测
# - 错误处理
# - 消息队列
# - AI 模型集成
# - 日志记录

# 参考：上面的完整代码示例
```

---

**更新时间**：2026-02-15 14:00
**服务器版本**：v1.0.0（已支持 Socket.io 和 Webhook）
**状态**：✅ 已部署并可用
