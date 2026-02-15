# Clawbot 配对问题诊断报告

## 📊 问题时间线

### 第一次测试（失败）
- **时间**：2026-02-15 11:00
- **症状**：Clawbot 没有收到 `user_paired` 事件
- **原因**：服务器端没有存储 Clawbot 的 socket

### 第二次测试（失败）
- **时间**：2026-02-15 12:00
- **症状**：App 显示"配对码验证成功，等待 Bot 连接"，但无法连接
- **原因**：App 端发送配对码时没有传递 `userId`

---

## 🔍 完整问题诊断

### 问题 1：服务器端缺少 socket 存储

**文件**：`server/clawbot-channel/server.js:166-192`

**问题代码**：
```javascript
socket.on('bot_request_pairing', async (data, callback) => {
  // ... 生成配对码 ...
  pairingToDevice.set(pairing.id, deviceId);

  // ❌ 缺少：没有存储 Clawbot 的 socket
  // botSockets.set(deviceId, socket);

  socket.emit('pairing_info', {...});
});
```

**结果**：
- 当 App 验证配对码时，服务器找不到 Clawbot 的 socket
- `user_paired` 事件无法发送

**修复**：
```javascript
// 存储 Clawbot socket（重要！）
botSockets.set(deviceId, socket);
socket.deviceId = deviceId;
socket.isBot = true;
socket.pairingId = pairing.id;
```

---

### 问题 2：App 端缺少 userId 参数

**文件**：`src/services/ClawbotChannelBridge.ts:292`

**问题代码**：
```typescript
pairWithCode(code: string): Promise<any> {
  this.socket.emit('pair_with_code', { code: code.toUpperCase() }, (response) => {
    // ❌ 缺少 userId 参数
  });
}
```

**服务器日志**：
```
[App] Pair with code: A63HKZ, userId: undefined
[App] User undefined bound to pairing e6c667c9-...
[Bot] Pairing confirmed: clawbot_1771129594080 with user null
```

**结果**：
- 数据库中 `user_id` 为 NULL
- 配对状态异常（status='paired'，但 user_id 为空）
- App 和 Clawbot 无法正常通信

**修复**：
```typescript
if (!this.userId) {
  reject(new Error('用户未登录'));
  return;
}

this.socket.emit('pair_with_code', {
  code: code.toUpperCase(),
  userId: this.userId  // ✅ 添加 userId
}, (response) => {...});
```

---

## ✅ 修复内容总结

### 服务器端修复

1. **添加 socket 存储**（`server.js:178-182`）
   ```javascript
   botSockets.set(deviceId, socket);
   socket.deviceId = deviceId;
   socket.isBot = true;
   socket.pairingId = pairing.id;
   ```

2. **添加调试日志**
   - 配对码生成时记录 socket 数量
   - App 验证时记录查找 Clawbot 的过程
   - 发送事件时记录成功/失败

### App 端修复

1. **修复 `pairWithCode` 方法**（`ClawbotChannelBridge.ts:292`）
   - 添加 `userId` 检查
   - 在 `pair_with_code` 事件中传递 `userId`

2. **修复 `pairWithToken` 方法**（`ClawbotChannelBridge.ts:317`）
   - 添加 `userId` 检查
   - 在 `pair_with_token` 事件中传递 `userId`

---

## 🧪 验证步骤

### 清理旧数据（可选）

```bash
ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db 'DELETE FROM pairings WHERE status=\"paired\" AND user_id IS NULL'"
```

### 测试流程

1. **重新构建 App**
   ```bash
   npm run build
   ```

2. **Clawbot 发起配对**
   - 连接到 `ws://47.243.55.130:8765`
   - 发送 `bot_request_pairing`
   - **保持连接**，等待 `user_paired` 事件

3. **App 输入配对码**
   - 打开配对页面
   - 输入 6 位配对码
   - 点击"验证配对码"

4. **查看服务器日志**
   ```bash
   ssh root@47.243.55.130 "pm2 logs clawbot-channel --lines 0"
   ```

   **预期输出**：
   ```
   [Bot] Pairing generated: XXX for device xxx
   [Bot] Socket stored for device xxx, total bots: 1
   [App] Pair with code: XXX, userId: bd49b054-7e8d-45e0-863e-0a7d89d51bf3
   [App] User bd49b054-7e8d-45e0-863e-0a7d89d51bf3 bound to pairing xxx
   [App] Looking for device xxx for pairing xxx
   [App] Sending user_paired event to bot xxx
   [Bot] Pairing confirmed: xxx with user bd49b054-7e8d-45e0-863e-0a7d89d51bf3
   ```

5. **验证数据库**
   ```bash
   ssh root@47.243.55.130 "sqlite3 /opt/clawbot-channel/data/pairing.db 'SELECT pairing_code, device_id, user_id, status FROM pairings ORDER BY created_at DESC LIMIT 1'"
   ```

   **预期结果**：
   ```
   XXX|clawbot_xxx|bd49b054-7e8d-45e0-863e-0a7d89d51bf3|paired
   ```

---

## 📋 问题清单

| 问题 | 状态 | 修复位置 | 部署状态 |
|------|------|----------|----------|
| 数据库 `user_id` NOT NULL 约束 | ✅ 已修复 | `config/database.js` | ✅ 已部署 |
| 服务器未存储 Clawbot socket | ✅ 已修复 | `server.js:178-182` | ✅ 已部署 |
| 服务器缺少调试日志 | ✅ 已修复 | `server.js` 多处 | ✅ 已部署 |
| App 未传递 userId（pairWithCode） | ✅ 已修复 | `ClawbotChannelBridge.ts:292` | ⚠️ 需重新构建 |
| App 未传递 userId（pairWithToken） | ✅ 已修复 | `ClawbotChannelBridge.ts:317` | ⚠️ 需重新构建 |

---

## 🎯 下一步行动

1. **重新构建并部署 App**
   ```bash
   npm run build
   # 部署到你的平台
   ```

2. **通知 Clawbot 团队**
   - 告知问题已修复
   - 提醒他们保持 Socket.io 连接
   - 提供最新的 API 文档

3. **重新测试完整流程**
   - Clawbot 生成配对码
   - App 输入配对码
   - Clawbot 收到 `user_paired` 事件
   - Clawbot 确认配对
   - 配对成功，开始通信

---

**报告生成时间**：2026-02-15 12:30
**负责人**：Claude (AI 助手)
**状态**：所有问题已修复，等待测试验证
