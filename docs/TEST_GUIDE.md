# Clawbot 配对测试指南

## ✅ 已修复的问题

**问题**：Clawbot 没有收到 `user_paired` 事件

**原因**：服务器在 `bot_request_pairing` 事件处理中，没有将 Clawbot 的 socket 存储到 `botSockets` Map 中，导致后续无法发送 `user_paired` 事件

**修复内容**：
1. ✅ 在 `bot_request_pairing` 中添加了 socket 存储逻辑
2. ✅ 添加了详细的调试日志
3. ✅ 服务器已重启并运行正常

---

## 🧪 测试步骤

### 第一步：Clawbot 连接并请求配对

```python
import socketio

sio = socketio.Client()

@sio.on('pairing_info')
def on_pairing_info(data):
    print('✅ 收到配对信息:')
    print('  配对码:', data['pairingCode'])
    print('  配对ID:', data['pairingId'])
    print('  过期时间:', data['expiresIn'], '秒')
    # TODO: 显示二维码

sio.connect('ws://47.243.55.130:8765')
sio.emit('bot_request_pairing', {
    'deviceId': 'clawbot-test-' + str(timestamp)  # 使用唯一ID
}, callback=lambda res: print('配对请求已发送' if res.get('success') else '配对请求失败'))

sio.wait()  # 保持连接，不要断开！
```

**关键点**：
- Clawbot 必须保持连接（使用 `sio.wait()` 或类似方法）
- 不要在发送 `bot_request_pairing` 后立即断开

---

### 第二步：App 输入配对码

1. 打开 App
2. 进入配对页面
3. 点击"输入配对码"
4. 输入第一步中显示的 6 位配对码（例如：`MVMC8C`）
5. 点击"验证配对码"

**预期结果**：
- App 控制台显示：`[ClawbotChannel] 配对码验证成功，等待 Bot 连接`
- **Clawbot 控制台显示**：
  ```
  👤 用户已配对: bd49b054-7e8d-45e0-863e-0a7d89d51bf3
  🆔 配对ID: 550e8400-e29b-41d4-a716-4466554400000
  ```

---

### 第三步：Clawbot 确认配对

```python
@sio.on('user_paired')
def on_user_paired(data):
    print('🎉 用户已配对！')
    print('  用户ID:', data['userId'])
    print('  配对ID:', data['pairingId'])

    # 自动确认配对
    sio.emit('bot_confirm_pairing', {
        'deviceId': 'clawbot-test-' + str(timestamp),
        'pairingId': data['pairingId']
    }, callback=on_pairing_confirmed)

def on_pairing_confirmed(response):
    if response.get('success'):
        print('✅ 配对完成！')
        # TODO: 更新UI，开始通信
    else:
        print('❌ 配对失败:', response.get('error'))
```

**预期结果**：
- Clawbot 控制台显示：`✅ 配对完成！`
- App 页面显示：配对成功，可以开始聊天

---

## 📊 服务器日志查看

### 实时查看日志

```bash
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 0"
```

### 查看最近 50 行

```bash
ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 50"
```

### 预期日志输出

**成功的配对流程**：
```
[Bot] Pairing generated: MVMC8C for device clawbot-test-123
[Bot] Socket stored for device clawbot-test-123, total bots: 1
[App] Pair with code: MVMC8C, userId: bd49b054-7e8d-45e0-863e-0a7d89d51bf3
[App] User bd49b054-7e8d-45e0-863e-0a7d89d51bf3 bound to pairing 550e8400-...
[App] Looking for device clawbot-test-123 for pairing 550e8400-...
[App] Sending user_paired event to bot clawbot-test-123
[Bot] Pairing confirmed: clawbot-test-123 with user bd49b054-7e8d-45e0-863e-0a7d89d51bf3
```

**如果出现问题**：
```
[App] Bot not found: deviceId=clawbot-test-123, hasSocket=false, totalBots=0
```
→ 说明 Clawbot 的 socket 没有正确存储或已断开连接

---

## ⚠️ 常见问题

### 问题 1：Clawbot 收不到 `user_paired` 事件

**可能原因**：
1. Clawbot 发送 `bot_request_pairing` 后立即断开连接
2. Clawbot 使用了不同的 `deviceId`

**解决方案**：
1. 确保 Clawbot 保持连接（使用 `sio.wait()`）
2. 检查 `deviceId` 是否一致

---

### 问题 2：App 显示"配对码验证成功"但 Clawbot 无反应

**检查项**：
1. 服务器日志中是否有 `[App] Sending user_paired event`？
2. 如果显示 `[App] Bot not found`，说明 Clawbot socket 丢失

**解决方案**：
1. 重启 Clawbot，重新发起配对请求
2. 确保 Clawbot 保持连接

---

### 问题 3：配对码过期

**症状**：
- App 输入配对码后显示"配对码无效或已过期"

**解决方案**：
- Clawbot 重新请求配对（`bot_request_pairing`）
- App 使用新的配对码

---

## 🔍 调试命令

### 查看当前配对记录

```bash
ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT id, pairing_code, device_id, user_id, status FROM pairings ORDER BY created_at DESC LIMIT 5'"
```

### 查看连接的 Clawbot 数量

在服务器日志中查找：
```
[Bot] Socket stored for device xxx, total bots: N
```

### 重启服务器

```bash
ssh root@47.243.55.130 "pm2 restart clawbot-channel"
```

---

## 📞 技术支持

如果问题仍未解决，请提供以下信息：
1. 服务器日志（`pm2 logs clawbot-channel --lines 100`）
2. Clawbot 控制台输出
3. App 控制台输出
4. 数据库配对记录

---

**更新时间**：2026-02-15 12:00
**服务器版本**：v1.0.0（已修复 socket 存储问题）
