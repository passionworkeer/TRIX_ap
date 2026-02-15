# ⚠️ 重要：Clawbot 必须保持持久连接

## 🔍 问题说明

**时间**：2026-02-15 12:30

**问题描述**：
- 用户配对成功后，App 刷新页面尝试发送消息
- 收到错误：`{message: "Bot is offline"}`
- 无法发送消息

**根本原因**：
- **Clawbot 在配对完成后断开了 Socket.io 连接**
- 服务器删除了 Clawbot 的 socket：`botSockets.delete(deviceId)`
- App 发送消息时，服务器找不到 Clawbot 的 socket

---

## ✅ 解决方案

### 方案 1：保持持久连接（推荐）

**Clawbot 必须保持 Socket.io 连接不断开！**

```python
import socketio

sio = socketio.Client()

@sio.event
def connect():
    print('✅ 已连接到服务器')
    # 请求配对或恢复配对
    sio.emit('bot_request_pairing', {
        'deviceId': 'clawbot-001'
    })

@sio.on('pairing_info')
def on_pairing_info(data):
    print('📋 配对码:', data['pairingCode'])
    # 显示二维码...

@sio.on('pairing_restored')
def on_pairing_restored(data):
    print('✅ 配对已恢复！')
    print('用户ID:', data['userId'])

@sio.on('user_paired')
def on_user_paired(data):
    print('👤 用户已配对')
    # 确认配对
    sio.emit('bot_confirm_pairing', {
        'deviceId': 'clawbot-001',
        'pairingId': data['pairingId']
    })

@sio.on('app_message')
def on_app_message(data):
    print('📩 收到用户消息:', data['content'])
    # 处理消息...

# 连接并保持
try:
    sio.connect('ws://TRIX_SERVER_HOST:8765')
    sio.wait()  # ← 关键：保持连接，不要退出！
except Exception as e:
    print('❌ 连接失败:', e)
    # 重连逻辑...
```

**关键点**：
- ✅ 使用 `sio.wait()` 或类似方法保持连接
- ✅ 监听 `app_message` 事件接收用户消息
- ✅ 如果程序需要退出，确保重连时调用 `bot_request_pairing` 恢复配对

---

### 方案 2：实现重连恢复（已支持）

**服务器已支持自动恢复配对！**

当 Clawbot 重新连接并发送 `bot_request_pairing` 时：
1. 服务器检查 `deviceId` 是否已有配对记录
2. 如果配对状态为 `paired`，自动恢复连接
3. 发送 `pairing_restored` 事件通知 Clawbot

**Clawbot 代码示例**：

```python
@sio.on('pairing_restored')
def on_pairing_restored(data):
    print('✅ 配对已恢复！')
    print('用户ID:', data['userId'])
    print('配对ID:', data['pairingId'])
    # 更新UI状态：已连接到用户

@sio.on('disconnect')
def on_disconnect():
    print('❌ 断开连接，准备重连...')
    # 自动重连
    time.sleep(2)
    sio.connect('ws://TRIX_SERVER_HOST:8765')
```

**重连流程**：
```
Clawbot 断开连接
    ↓
Clawbot 重新连接
    ↓
发送 bot_request_pairing (deviceId: xxx)
    ↓
服务器检测到已有配对记录
    ↓
发送 pairing_restored 事件
    ↓
Clawbot 恢复配对状态
    ↓
可以正常收发消息
```

---

## 📊 服务器日志示例

### 正常配对流程

```
[Bot] Pairing generated: A63HKZ for device clawbot-001
[Bot] Socket stored for device clawbot-001, total bots: 1
[App] Pair with code: A63HKZ, userId: bd49b054-...
[App] Sending user_paired event to bot clawbot-001
[Bot] Pairing confirmed: clawbot-001 with user bd49b054-...
[App] Message forwarded to bot clawbot-001  ✅ 成功
```

### Clawbot 断开后的问题

```
[Bot] Clawbot disconnected: clawbot-001
[Bot] Total bots remaining: 0
[App] Message from user bd49b054-...
[App] Bot offline: clawbot-001, total bots: 0
[App] Error sent: Bot is offline  ❌ 失败
```

### Clawbot 重连恢复

```
[Bot] Clawbot reconnecting, restoring pairing
[Bot] Pairing restored for clawbot-001, total bots: 1
[App] Message from user bd49b054-...
[App] Message forwarded to bot clawbot-001  ✅ 成功
```

---

## 🚨 当前状态

**服务器端**：
- ✅ 已添加自动恢复配对功能
- ✅ 已增强错误提示信息
- ✅ 已添加详细的调试日志

**App 端**：
- ✅ 已修复 `userId` 传递问题
- ✅ 正常发送消息

**Clawbot 端**（需要修复）：
- ❌ 配对后断开连接
- ❌ 没有保持持久连接
- ❌ 缺少重连恢复逻辑

---

## 🎯 行动清单

### 立即行动

1. **修改 Clawbot 代码**：
   - 保持 Socket.io 连接（使用 `sio.wait()`）
   - 添加断线重连逻辑

2. **测试步骤**：
   - Clawbot 连接并发起配对
   - App 输入配对码
   - **保持 Clawbot 运行**
   - App 刷新页面，发送测试消息
   - 应该能正常接收

3. **验证服务器日志**：
   ```bash
   ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel --lines 0"
   ```
   确认看到：`[App] Message forwarded to bot xxx`

---

### 可选优化

1. **心跳检测**（可选）：
   ```python
   import threading

   def heartbeat():
       while True:
           time.sleep(30)
           sio.emit('ping', callback=lambda res: print('心跳成功'))

   threading.Thread(target=heartbeat, daemon=True).start()
   ```

2. **自动重连**（推荐）：
   ```python
   @sio.event
   def disconnect():
       print('断开连接，5秒后重连...')
       time.sleep(5)
       sio.connect('ws://TRIX_SERVER_HOST:8765')
   ```

3. **错误处理**：
   ```python
   @sio.on('error')
   def on_error(data):
       print('服务器错误:', data['message'])
       if 'Bot is offline' in data.get('hint', ''):
           print('提示：需要保持连接状态')
   ```

---

## 📞 技术支持

**服务器地址**：`ws://TRIX_SERVER_HOST:8765`

**查看服务器日志**：
```bash
ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel --lines 50"
```

**查看当前连接的 Clawbot**：
```bash
ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel --lines 200 | grep 'Total bots'"
```

**查看配对记录**：
```bash
ssh root@TRIX_SERVER_HOST "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT device_id, user_id, status FROM pairings WHERE status=\"paired\"'"
```

---

**更新时间**：2026-02-15 12:30
**状态**：等待 Clawbot 团队实现持久连接
**优先级**：🔴 高（影响用户使用）
