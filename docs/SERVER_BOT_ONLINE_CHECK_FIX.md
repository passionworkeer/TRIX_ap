# 服务器 Bot 在线检查修复报告

## 📋 问题描述

**用户报告：**
- ❌ 配对码立即显示"过期或无效"
- ❌ 配对"成功"后无法发送消息
- ❌ 控制台：`Bot is offline`
- ❌ 从聊天界面进入还是配对界面
- ❌ 配对码"失效"

**服务器日志分析（15:04-15:08）：**
```
15:04:41 [Bot] Socket stored for device clawbot_1771139079740, total bots: 1
15:05:40 [Bot] Clawbot disconnected: clawbot_1771139079740  ← 1分钟后断开
15:05:47 [App] Pair with code: FGQTEP, userId: bd49b054...
15:05:47 [App] User bound to pairing a628d22d...
15:05:47 [App] Pairing success: FGQTEP, user: bd49b054...  ← 配对"成功"
15:08:28 [App] Bot offline: clawbot_1771139079740, total bots: 0  ← 但实际离线！
```

**问题本质：**
- 服务器允许配对完成（数据库 status='paired'）
- 但 Bot socket 实际上已经断开（不在 botSockets 中）
- App 尝试发送消息时发现 Bot offline
- **配对码失效**（因为 Bot 不在线，无法重新验证）

---

## 🔍 根本原因

### 问题 1：服务器不检查 Bot 在线状态

**修复前的代码（第 305 行）：**
```javascript
// 绑定 userId 到配对记录
await pairingService.bindUserToPairing(result.pairing.id, userId);

// ❌ 直接完成配对，不检查 Bot 是否在线
await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);
```

**问题：**
- 没有检查 `botSockets.has(result.pairing.device_id)`
- 即使 Bot 已离线，配对仍然"成功"
- 数据库更新为 status='paired'
- 但 Bot socket 不在，无法收发消息

### 问题 2：App 配对后仍然显示配对界面

**原因：**
- App 收到 `pairing_success` 事件
- 但服务器实际上没有正确完成配对
- `isPaired` 状态可能没有正确设置
- 导致 App 仍在配对界面

---

## ✅ 修复内容

### 修复：Bot 在线检查（pair_with_code）

**位置：** server.js:300-313 行

**修复后的代码：**
```javascript
// 绑定 userId 到配对记录
await pairingService.bindUserToPairing(result.pairing.id, userId);
console.log(`[App] User ${userId} bound to pairing ${result.pairing.id}`);

// ✅ 检查 Bot 是否在线
if (!botSockets.has(result.pairing.device_id)) {
  console.log(`[App] Bot offline, cannot complete pairing: ${result.pairing.device_id}`);
  console.log(`[App] Total bots online: ${botSockets.size}`);
  if (typeof callback === 'function') {
    return callback({
      success: false,
      error: 'Clawbot is offline. Please ensure Clawbot is connected and try pairing again.'
    });
  }
  return;
}

console.log(`[App] Bot online (${result.pairing.device_id}), completing pairing...`);

// ✅ 直接完成配对（不再等待 Clawbot 额外确认）
await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);
```

**同样修复：pair_with_token（第 365-380 行）**

---

## 📊 修复效果

### 修复前：
```
✅ Clawbot 连接 → 生成配对码 FGQTEP
❌ Clawbot 1分钟后断开
✅ App 输入配对码 → 服务器完成配对
✅ 数据库 status='paired'
❌ App 尝试发送消息 → "Bot is offline"
❌ 配对码"失效"（Bot 不在线无法验证）
```

### 修复后：
```
✅ Clawbot 连接 → 生成配对码 FGQTEP
❌ Clawbot 1分钟后断开
✅ App 输入配对码
❌ 服务器检查 Bot socket → 不在线！
❌ 返回错误："Clawbot is offline"
✅ App 收到明确错误提示
❌ 配对不完成（数据库 status 仍是 'pending'）
✅ 用户可以让 Clawbot 重连后再配对
```

---

## 🧪 测试验证

### 测试 1：Bot 在线时配对

**步骤：**
1. Clawbot 连接到服务器
2. 生成配对码
3. App 输入配对码（Bot 仍在线）
4. 验证配对成功

**预期日志：**
```
[Bot] Pairing generated: ABC123, total bots: 1
[App] Pair with code: ABC123, userId: xxx
[App] User xxx bound to pairing yyy
[App] Bot online (clawbot_xxx), completing pairing...
[App] Pairing success: ABC123, user: xxx
```

**预期结果：**
✅ 配对成功
✅ 可以发送消息
✅ Bot socket 在线

---

### 测试 2：Bot 离线时配对

**步骤：**
1. Clawbot 连接到服务器
2. 生成配对码
3. **Clawbot 断开**
4. App 输入配对码（Bot 已离线）

**预期日志：**
```
[Bot] Pairing generated: ABC123, total bots: 1
[Bot] Clawbot disconnected: clawbot_xxx
[Bot] Total bots remaining: 0
[App] Pair with code: ABC123, userId: xxx
[App] Bot offline, cannot complete pairing: clawbot_xxx
[App] Total bots online: 0
```

**预期结果：**
✅ App 收到错误：`Clawbot is offline`
✅ 配对不完成
✅ 不会出现"配对成功但无法发消息"的情况
✅ 用户可以重新让 Clawbot 连接后再配对

---

## 📝 验证命令

### 检查修复已部署：
```bash
ssh root@TRIX_SERVER_HOST "grep '检查 Bot 是否在线' /opt/clawbot-channel/server.js"
```

**预期输出：**
```
// ✅ 检查 Bot 是否在线
      if (!botSockets.has(result.pairing.device_id)) {
```

### 检查服务状态：
```bash
ssh root@TRIX_SERVER_HOST "pm2 status"
```

**预期输出：**
```
clawbot-channel: online
```

---

## 🎯 修复确认

- [x] 分析服务器日志
- [x] 识别根本原因（不检查 Bot 在线状态）
- [x] 在 pair_with_code 添加 Bot 在线检查
- [x] 在 pair_with_token 添加 Bot 在线检查
- [x] 返回明确的错误提示
- [x] 部署修复到服务器
- [x] 验证代码已部署

---

## ✅ 修复效果

**修复前的问题：**
- ❌ 配对"成功"但实际无法工作
- ❌ "Bot is offline" 错误
- ❌ 配对码"失效"
- ❌ App 显示错误的界面

**修复后的行为：**
- ✅ Bot 离线时明确拒绝配对
- ✅ 返回清晰的错误提示
- ✅ 不会完成无效的配对
- ✅ 用户知道需要重连 Bot

---

**修复时间：** 2026-02-15 15:10
**修复人员：** 服务器技术团队
**服务器版本：** v1.0.2（bot-online-check）
**状态：** ✅ 已修复并部署

---

## 🚀 下一步

**请重新测试配对流程：**

1. 确保 **Clawbot 保持连接**
2. App 输入配对码时 Bot 必须在线
3. 配对成功后测试发送消息

如果仍有问题，请提供：
- 服务器日志（`pm2 logs clawbot-channel --lines 50`）
- 具体错误信息
- Bot 是否在线

---

**服务器技术团队**
2026-02-15
