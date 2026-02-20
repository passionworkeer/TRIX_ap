# 🎯 三端联通测试步骤（2026-02-20）

## ✅ 当前状态

### 服务器端（TRIX_SERVER_HOST:8765）
- ✅ 服务运行：`online` (PM2)
- ✅ 端口监听：`8765`
- ✅ 健康检查：正常
- ✅ 数据库表：`pairings`, `chat_messages` 已创建
- ✅ 消息落库：已配置

### PC 端（TRIX Channel）
- ✅ 服务器连接：成功
- ✅ 配对码生成：工作正常
- ✅ 持久化：已保存
- ⚠️ Gateway 连接：失败（暂时跳过，不影响基本功能）

### 待测试
- ⏳ App 端配对
- ⏳ 消息流（App ↔ Server）
- ⏳ 离线消息同步

---

## 🧪 测试步骤

### 第 1 步：启动 TRIX Channel（PC 端）

```bash
cd e:/desktop/trix-3d-companion/openclaw-skills/trix-channel
node index.js
```

**预期输出**：
```
[TRIXChannel] 🚀 启动 TRIX App Channel...
[TRIXChannel] 📡 服务器: http://TRIX_SERVER_HOST:8765
[TRIXChannel] ✅ 已连接到 clawbot-channel 服务器
[TRIXChannel] 🆕 新配对码: XXXXXX
[TRIXChannel] 💾 认证信息已保存
```

**注意**：忽略 Gateway 连接失败的错误，这不影响 Socket.IO 通信。

**记录配对码**：`XXXXXX`（6位字母数字）

---

### 第 2 步：App 端配对

1. **打开 TRIX App**
2. **进入配对页面**
3. **输入配对码**：输入第 1 步生成的 6 位配对码
4. **点击确认配对**

**预期结果**：
```
✅ 配对成功
✅ App 显示已配对状态
✅ App 收到 pairing_success 事件
```

**服务器日志验证**：
```bash
ssh root@TRIX_SERVER_HOST
pm2 logs clawbot-channel --lines 20
```

应该看到：
```
[PairingService] ✅ 配对成功: userId=xxx, deviceId=xxx
[Server] ✅ 用户已配对: userId=xxx
```

---

### 第 3 步：测试基本消息流

#### 测试 3.1：App → Server

**操作**：在 App 中发送消息："测试消息 1"

**服务器日志**：
```
[Server] 📩 收到 App 消息: 测试消息 1
[Server] ✅ 用户消息已保存到数据库
```

#### 测试 3.2：Server → App

**操作**：模拟服务器向 App 发送消息

**预期**：App 收到 `bot_message` 事件并显示消息

#### 测试 3.3：双向消息流

**操作**：
1. App 发送："你好"
2. 等待响应
3. 检查是否收到回复

**预期**：
- ✅ App 发送成功
- ✅ 服务器接收并保存
- ✅ 如果有 Bot 响应，App 收到

---

### 第 4 步：测试离线消息同步（关键功能！）

这是**消息黑洞修复**的核心测试。

#### 步骤：
1. **App 发送消息**："离线测试消息"
2. **立即锁屏/切后台**（模拟 App 被系统挂起）
3. **等待 10 秒**
4. **切回 App/解锁**

#### 预期结果：

**服务器日志**（App 离线时）：
```
[Server] 📩 收到 App 消息: 离线测试消息
[Server] ⚠️  App 离线，消息已保存，等待 App 拉取
```

**App 端**（重连后）：
```
[ClawbotChannel] 📱 App 切回前台，检查连接...
[ClawbotChannel] ✅ 已触发消息同步
[ClawbotChannel] 📩 收到消息同步指令，开始拉取遗漏消息...
[ClawbotChannel] ✅ 拉取到 X 条遗漏消息
```

**验证**：
- ✅ App 自动重连
- ✅ App 自动拉取遗漏消息
- ✅ 消息显示在聊天界面

---

## 📊 查看服务器日志

### 实时日志
```bash
ssh root@TRIX_SERVER_HOST
pm2 logs clawbot-channel --lines 100
```

### 搜索特定日志
```bash
# 查看 App 消息
pm2 logs clawbot-channel --lines 1000 | grep "App 消息"

# 查看消息保存
pm2 logs clawbot-channel --lines 1000 | grep "消息已保存"

# 查看配对日志
pm2 logs clawbot-channel --lines 1000 | grep "配对"
```

### 检查数据库
```bash
ssh root@TRIX_SERVER_HOST
sqlite3 /opt/clawbot-channel/data/clawbot.db

# 查看配对
SELECT * FROM pairings;

# 查看消息
SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 10;
```

---

## 🎯 成功标准

### 最低标准（P0）
- ✅ App 能成功配对
- ✅ App 发送消息能在服务器看到
- ✅ 服务器保存消息到数据库

### 完整标准（P1）
- ✅ App ↔ Server 双向消息流
- ✅ 离线消息自动同步
- ✅ 消息不丢失

### 理想标准（P2）
- ✅ Gateway 连接成功（与 OpenClaw 深度集成）
- ✅ Bot 自动响应
- ✅ 多媒体消息支持

---

## 🐛 故障排除

### App 无法配对
**检查**：
1. 服务器是否运行：`curl http://TRIX_SERVER_HOST:8765/health`
2. 配对码是否过期（5 分钟有效期）
3. 查看 App 控制台错误

**解决**：
```bash
# 重启 TRIX Channel 生成新配对码
cd e:/desktop/trix-3d-companion/openclaw-skills/trix-channel
node index.js
```

### 消息收不到
**检查**：
1. 服务器日志是否收到消息
2. App 是否已配对
3. Socket.IO 连接状态

**调试**：
```javascript
// App 端
console.log('Pairing status:', clawbotChannelBridge.isPaired());
console.log('Socket connected:', clawbotChannelBridge.isConnected());
```

### 离线消息不同步
**检查**：
1. `chat_messages` 表中是否有消息
2. App 是否触发了 `sync_missed_messages` 事件
3. 消息同步 API 是否工作

**手动测试 API**：
```bash
curl "http://TRIX_SERVER_HOST:8765/api/messages/sync?userId=YOUR_USER_ID&lastTimestamp=0"
```

---

## 📝 测试记录模板

### 测试日期：2026-02-20
### 测试人员：[你的名字]

| 测试项 | 结果 | 备注 |
|--------|------|------|
| PC 端启动 | ⏳ | |
| 配对码生成 | ⏳ | 配对码：XXXXXX |
| App 配对 | ⏳ | |
| App → Server 消息 | ⏳ | |
| Server → App 消息 | ⏳ | |
| 离线消息同步 | ⏳ | |

### 发现的问题：
1.
2.
3.

### 下一步计划：
1.
2.
3.

---

## 🚀 开始测试

**准备就绪！**

1. **PC 端**：启动 TRIX Channel
2. **App 端**：输入配对码
3. **开始测试**：按照上述步骤逐一验证

**祝测试顺利！** 🎉
