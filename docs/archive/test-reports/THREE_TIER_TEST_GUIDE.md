# 🎉 三端联通测试指南

## ✅ 已完成的服务器配置

### 1. 消息落库（解决消息黑洞）
- ✅ 创建 `messageService.js`（使用 SQLite）
- ✅ `chat_messages` 表已创建
- ✅ `bot_response` 事件处理已添加
- ✅ 自动保存所有 Bot 响应到数据库

### 2. 会话路由映射
- ✅ `app_message` → Bot 路由（已存在）
- ✅ `bot_response` → App 路由（新增）
- ✅ 离线消息保存（App 不在线时保存到数据库）

### 3. 配对协议兼容
- ✅ `bot_request_pairing`（Bot 端）
- ✅ `pair_with_code`（App 端）
- ✅ 配对状态检查

### 4. 消息同步 API
- ✅ `GET /api/messages/sync?userId=xxx&lastTimestamp=0`
- ✅ 返回遗漏的消息列表

## 🧪 三端联通测试步骤

### 第一阶段：PC 端（OpenClaw + TRIX Channel v2.0.0）

#### 1. 启动 TRIX Channel

```bash
# 方法 A: 在 OpenClaw 中输入
启动 TRIX Channel

# 方法 B: 手动启动
cd ~/.openclaw/skills/trix-channel
node index.js
```

**预期输出**:
```
[TRIXChannel] 🚀 启动 TRIX App Channel...
[TRIXChannel] 📡 服务器: http://47.243.55.130:8765
[TRIXChannel] 🌐 Gateway: ws://127.0.0.1:18789
[TRIXChannel] ✅ 已连接到 clawbot-channel 服务器
[TRIXChannel] 🆕 新配对码: ABC123
[TRIXChannel] ✅ TRIX Channel 已启动
```

#### 2. 验证持久化

```bash
# 重启 Channel
# Ctrl+C 停止
node index.js

# 应该看到：
[TRIXChannel] ♻️  恢复设备 ID: trix_hostname_...
[TRIXChannel] ♻️  恢复配对: pair_xxx
# ✅ 不需要重新配对！
```

### 第二阶段：App 端

#### 1. 连接到服务器

```typescript
// App 自动连接
// ClawbotChannelBridge.ts 已配置
// 服务器：47.243.55.130:8765
```

#### 2. 输入配对码

```
1. 打开 TRIX App
2. 进入配对页面
3. 输入 PC 端显示的配对码：ABC123
4. 点击确认配对
```

**预期结果**:
```
✅ 配对成功
✅ App 收到 pairing_success 事件
✅ PC 端收到 user_paired 事件
```

### 第三阶段：消息流测试

#### 测试 1: App → PC (基本消息)

**App 端**:
```
发送消息："你好，测试消息"
```

**PC 端（OpenClaw）**:
```
✅ 应该收到消息
[TRIXChannel] 📩 收到 App 消息: 你好，测试消息
```

#### 测试 2: PC → App (Bot 响应)

**PC 端（OpenClaw 响应）**:
```
OpenClaw 自动回复
```

**服务器日志**:
```
[Server] 📩 收到 Bot 响应: ...
[MessageService] ✅ 消息已保存: msg_xxx
[Server] ➡️  已转发给 App
```

**App 端**:
```
✅ 应该收到 bot_message 事件
✅ 消息显示在聊天界面
```

#### 测试 3: 消息黑洞修复（关键！）

**步骤**:
```
1. App 发送消息："测试离线消息"
2. 立即锁屏或切后台（模拟离线）
3. PC 端响应
4. 等待 10 秒
5. 解锁/切回 App
```

**预期结果**:

**服务器日志**:
```
[Server] ⚠️  App 离线，消息已保存，等待 App 拉取
```

**App 端（重连后）**:
```
[ClawbotChannel] 📱 App 切回前台，检查连接...
[ClawbotChannel] ✅ 已触发消息同步，UI 层应从 Supabase 拉取遗漏消息
[ClawbotChannel] 📩 收到消息同步指令，开始拉取遗漏消息...
✅ 消息应该出现在聊天界面
```

#### 测试 4: 消息同步 API

```bash
# 手动测试 API
curl "http://47.243.55.130:8765/api/messages/sync?userId=YOUR_USER_ID&lastTimestamp=0"

# 预期返回：
{
  "success": true,
  "messages": [
    {
      "id": 1,
      "user_id": "xxx",
      "content": "Bot 响应内容",
      "sender": "bot",
      "timestamp": 1234567890,
      ...
    }
  ]
}
```

## 📊 验证清单

### PC 端（TRIX Channel v2.0.0）
- [ ] 可以启动 Channel
- [ ] 可以生成配对码
- [ ] 重启后自动恢复配对
- [ ] Gateway 断线自动重连
- [ ] 收到 App 消息
- [ ] 可以发送 Bot 响应

### 服务器端
- [ ] bot_response 事件处理正常
- [ ] 消息保存到数据库
- [ ] App 离线时消息不丢失
- [ ] 消息同步 API 返回正确数据

### App 端
- [ ] 可以连接到服务器
- [ ] 可以配对成功
- [ ] 可以发送消息
- [ ] 可以接收消息
- [ ] 切后台重连后消息同步
- [ ] 消息不丢失

## 🐛 故障排除

### PC 端问题

**问题**: Gateway Token 获取失败
```bash
# 解决方案：
export GATEWAY_TOKEN="your-token"
# 或在 ~/.openclaw/openclaw.json 中配置
```

**问题**: 配对码无效
```bash
# 检查服务器连接
curl http://47.243.55.130:8765/health

# 检查日志
pm2 logs clawbot-channel
```

### 服务器问题

**问题**: 消息未保存
```bash
# 检查消息表
ssh root@47.243.55.130
sqlite3 /opt/clawbot-channel/data/clawbot.db
SELECT * FROM chat_messages LIMIT 5;
```

**问题**: App 收不到消息
```bash
# 检查服务器日志
pm2 logs clawbot-channel --lines 100

# 查找关键词：
# bot_response
# 消息已保存
# 已转发给 App
```

### App 端问题

**问题**: 配对失败
```typescript
// 检查日志
console.log('[Pairing] Error:', error);

// 检查 userId 是否正确
// 必须是 Supabase UUID (36 字符)
```

**问题**: 重连后消息丢失
```typescript
// 检查 sync_missed_messages 事件
clawbotChannelBridge.on('sync_missed_messages', async () => {
  console.log('📩 开始同步消息...');
  // 实现 Supabase 拉取逻辑
});
```

## 🎯 完整流程图

```
App                    Server                    PC (TRIX Channel)
 │                        │                             │
 │──── pair_with_code ───>│                             │
 │                        │<─── bot_request_pairing ────│
 │                        │                             │
 │<─── pairing_success ───│──── user_paired ───────────>│
 │                        │                             │
 │──── app_message ──────>│                             │
 │                        │──── user_message ──────────>│
 │                        │                             │
 │                        │<─── bot_response ───────────│
 │<─── bot_message ───────│                             │
 │                        │                             │
 │ [保存到数据库]          │                             │
 │                        │                             │
 │ [App 离线]             │                             │
 │                        │<─── bot_response ───────────│
 │                        │ [保存到数据库]               │
 │                        │ [App 离线，不转发]          │
 │                        │                             │
 │ [App 重连]             │                             │
 │──── connect ──────────>│                             │
 │<─── connected ─────────│                             │
 │<── sync_missed_events ─│                             │
 │                        │                             │
 │── GET /api/messages ──>│                             │
 │<── messages[] ─────────│                             │
 │ [显示遗漏消息]          │                             │
```

## 🎉 测试成功标志

当你看到以下所有日志时，说明三端联通成功：

**PC 端**:
```
✅ TRIX Channel 已启动
♻️  恢复配对: pair_xxx
📩 收到 App 消息: ...
```

**服务器端**:
```
✅ 消息表已就绪
📩 收到 Bot 响应: ...
✅ Bot 消息已保存到数据库
➡️  已转发给 App
```

**App 端**:
```
✅ 已连接到服务器
✅ 配对成功
📱 App 切回前台，检查连接...
📩 收到消息同步指令，开始拉取遗漏消息...
```

---

**测试完成后请告知结果！** 🚀
