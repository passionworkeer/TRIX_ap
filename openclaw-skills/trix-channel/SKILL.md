---
id: trix-app
owner_id: trix-team
name: TRIX App Channel
description: TRIX 3D Companion App Channel for OpenClaw - 实时双向通信，类似 WhatsApp Web
version: 1.0.0
icon: "🎮"
author: TRIX Team
metadata:
  clawdbot:
    emoji: "🎮"
    requires:
      bins: []
    install:
      - id: node
        kind: node
        package: 'trix-channel'
        bins: []
        label: Install TRIX Channel via npm
---

# TRIX App Channel

这是 TRIX 3D Companion App 的 OpenClaw Channel，提供实时双向通信能力。

## 🎯 功能

### 实时通信
- ✅ **持久化 WebSocket 连接** - 保持长连接，实时收发消息
- ✅ **双向消息流** - App ↔ Server ↔ OpenClaw Gateway
- ✅ **自动重连** - 断线自动重连，保持在线状态
- ✅ **心跳机制** - 每 30 秒心跳，确保连接活跃

### 配对功能
- 📱 **生成配对码** - 6位字母数字配对码
- 🔗 **配对验证** - App 输入配对码完成绑定
- ♻️  **恢复配对** - 断线重连后自动恢复配对状态

### 集成能力
- 🌐 **OpenClaw Gateway** - 与 Gateway 无缝集成
- 🔌 **Channel Plugin API** - 遵循 OpenClaw 标准 Channel API
- 📨 **消息路由** - 自动路由 App 和 OpenClaw 之间的消息

## 📦 安装

### 方法 1: 作为 OpenClaw Skill 安装

```bash
cd ~/.openclaw/skills
git clone <repo-url> trix-channel
cd trix-channel
npm install
```

### 方法 2: 独立运行

```bash
cd openclaw-skills/trix-channel
npm install
node index.js
```

## 🚀 使用方法

### 1. 启动 Channel

**在 OpenClaw 中**:
```
启动 TRIX Channel
```

**或手动启动**:
```bash
node ~/.openclaw/skills/trix-channel/index.js
```

### 2. 生成配对码

**在 OpenClaw 中**:
```
生成 TRIX 配对码
```

你会看到：
```
✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：ABC123
⏰ 有效期：5分钟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. 在 TRIX App 中配对

1. 打开 TRIX App
2. 进入配对页面
3. 输入配对码：`ABC123`
4. 点击确认配对
5. 配对成功！

### 4. 开始聊天

现在你可以在 TRIX App 中与 OpenClaw 实时聊天了！

**消息流程**:
```
TRIX App → clawbot-channel Server → OpenClaw Gateway → OpenClaw Agent
                                                          ↓
TRIX App ← clawbot-channel Server ← OpenClaw Gateway ← OpenClaw Agent
```

## ⚙️ 配置

### 环境变量

```bash
# clawbot-channel 服务器地址
export CLAWBOT_SERVER_URL="http://TRIX_SERVER_HOST:8765"

# OpenClaw Gateway 地址
export GATEWAY_URL="ws://127.0.0.1:18789"
```

### OpenClaw 配置

在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "channels": {
    "trixApp": {
      "enabled": true,
      "accounts": {
        "default": {
          "accountId": "default"
        }
      }
    }
  }
}
```

## 🔧 故障排除

### Channel 无法启动

**检查依赖**:
```bash
cd ~/.openclaw/skills/trix-channel
npm install
```

**检查端口**:
```bash
# 检查 Gateway 是否运行（端口 18789）
netstat -ano | findstr 18789
```

### 无法连接到服务器

**检查网络**:
```bash
ping TRIX_SERVER_HOST
```

**检查服务器状态**:
```bash
curl http://TRIX_SERVER_HOST:8765/health
```

### App 无法配对

1. 确认 OpenClaw Channel 正在运行
2. 确认配对码未过期（5分钟）
3. 检查 App 日志中的错误信息

## 📊 状态监控

**查看 Channel 状态**:
```
查看 TRIX Channel 状态
```

返回：
```json
{
  "isConnectedToServer": true,
  "isConnectedToGateway": true,
  "deviceId": "trix_12345_1739280000000",
  "pairingId": "pair_abc123",
  "message": "✅ 运行中"
}
```

## 🏗️ 架构

### 组件

1. **TRIX Channel** (`index.js`)
   - Socket.IO 客户端（连接 clawbot-channel）
   - WebSocket 客户端（连接 OpenClaw Gateway）
   - 消息路由逻辑

2. **clawbot-channel Server** (TRIX_SERVER_HOST:8765)
   - 中继服务器
   - 配对管理
   - 消息转发

3. **OpenClaw Gateway** (127.0.0.1:18789)
   - 消息路由
   - Agent 调度
   - 事件广播

### 消息格式

**App → OpenClaw**:
```json
{
  "event": "user_message",
  "data": {
    "text": "你好",
    "userId": "user_xxx",
    "threadId": "thread_xxx"
  }
}
```

**OpenClaw → App**:
```json
{
  "event": "bot_response",
  "data": {
    "response": "你好！有什么可以帮助你的吗？",
    "messageId": "msg_xxx"
  }
}
```

## 🔒 安全

- ✅ 配对码有效期 5 分钟
- ✅ 基于 Device ID 的身份验证
- ✅ Gateway Token 认证
- ✅ 仅允许已配对用户通信

## 📝 日志

Channel 会输出详细日志：

```
[TRIXChannel] 🚀 启动 TRIX App Channel...
[TRIXChannel] ✅ 已连接到 clawbot-channel 服务器
[TRIXChannel] 🆕 新配对码: ABC123
[TRIXChannel] 📩 收到 App 消息: 你好
[TRIXChannel] ➡️  已转发到 Gateway
[TRIXChannel] ⬅️  已转发到 App
```

## 🤝 贡献

TRIX Team

## 📄 许可证

MIT

---

**相关资源**:
- [TRIX 3D Companion](https://github.com/trix-team/trix-3d-companion)
- [OpenClaw 文档](https://docs.openclaw.ai)
- [clawbot-channel 服务器](https://github.com/trix-team/clawbot-channel)
