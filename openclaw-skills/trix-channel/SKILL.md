---
id: trix-app
owner_id: trix-team
name: TRIX App Channel
description: TRIX 3D Companion App Channel for OpenClaw - 实时双向通信，类似 WhatsApp Web
version: 1.1.0
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

# TRIX App Channel - OpenClaw 集成文档

> 🎮 TRIX 3D Companion 的 OpenClaw Channel，提供实时双向通信能力
> **版本**: 1.1.0
> **最后更新**: 2026-03-04

---

## 1. 概述

TRIX App Channel 是 TRIX 3D Companion 应用与 OpenClaw Gateway 之间的桥梁，负责：

- 🔄 **实时消息转发**: App ↔ Server ↔ OpenClaw Gateway
- 📱 **设备配对管理**: iOS 与 Web 端配对
- 🤖 **AI 响应路由**: 将用户消息转发给 AI 机器人

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRIX 系统架构                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐                      ┌─────────────────┐              │
│  │     iOS     │                      │       Web       │              │
│  │  (SwiftUI)  │                      │  (React + TS)   │              │
│  └──────┬──────┘                      └────────┬────────┘              │
│         │                                        │                         │
│         └────────────────┬───────────────────────┘                        │
│                          ▼                                                │
│              ┌─────────────────────────┐                                │
│              │  clawbot-channel Server │                                │
│              │    (47.243.55.130:8765) │                                │
│              └────────────┬────────────┘                                │
│                           │                                              │
│          ┌─────────────────┴─────────────────┐                          │
│          ▼                                   ▼                           │
│  ┌─────────────────────┐        ┌─────────────────────┐             │
│  │   SQLite (本地)     │        │    OpenClaw          │             │
│  │   (配对数据)        │        │    Gateway           │             │
│  │                     │        │    (ws://127.0.0.1:  │             │
│  └─────────────────────┘        │    18789)           │             │
│                                  └─────────────────────┘             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 组件说明

| 组件 | 描述 | 位置 |
|------|------|------|
| **TRIX App** | iOS/Web 客户端 | 用户设备 |
| **clawbot-channel Server** | 中继服务器 | 47.243.55.130:8765 |
| **SQLite** | 本地配对数据库 | server/clawbot-channel/data/ |
| **OpenClaw Gateway** | AI 消息路由 | 127.0.0.1:18789 |

---

## 3. 安装

### 3.1 作为 OpenClaw Skill 安装

```bash
cd ~/.openclaw/skills
git clone <repo-url> trix-channel
cd trix-channel
npm install
```

### 3.2 独立运行

```bash
cd openclaw-skills/trix-channel
npm install
node index.js
```

---

## 4. 使用方法

### 4.1 启动 Channel

**在 OpenClaw 中**:
```
启动 TRIX Channel
```

**或手动启动**:
```bash
node ~/.openclaw/skills/trix-channel/index.js
```

### 4.2 生成配对码

**在 OpenClaw 中**:
```
生成 TRIX 配对码
```

返回：
```
✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：ABC123
⏰ 有效期：5分钟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.3 在 TRIX App 中配对

1. 打开 TRIX App
2. 进入配对页面
3. 输入配对码：`ABC123`
4. 点击确认配对
5. 配对成功！

### 4.4 查看 Channel 状态

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

---

## 5. 消息流程

### 5.1 用户 → AI

```
TRIX App
    │
    ▼ WebSocket
clawbot-channel Server
    │
    ▼ HTTP/WebSocket
OpenClaw Gateway
    │
    ▼
OpenClaw Agent (AI)
```

### 5.2 AI → 用户

```
OpenClaw Agent (AI)
    │
    ▼
OpenClaw Gateway
    │
    ▼ HTTP/WebSocket
clawbot-channel Server
    │
    ▼ WebSocket
TRIX App
```

### 5.3 消息格式

**App → OpenClaw**:
```json
{
  "event": "user_message",
  "data": {
    "text": "你好",
    "userId": "user_xxx",
    "threadId": "thread_xxx",
    "messageId": "msg_xxx"
  }
}
```

**OpenClaw → App**:
```json
{
  "event": "bot_response",
  "data": {
    "response": "你好！有什么可以帮助你的吗？",
    "messageId": "msg_xxx",
    "actions": [
      {
        "type": "suggestion",
        "label": "继续学习",
        "action": "start_study"
      }
    ]
  }
}
```

---

## 6. 配置

### 6.1 环境变量

```bash
# clawbot-channel 服务器地址
export CLAWBOT_SERVER_URL="http://47.243.55.130:8765"

# OpenClaw Gateway 地址
export GATEWAY_URL="ws://127.0.0.1:18789"

# OpenClaw API Token
export GATEWAY_TOKEN="your_token_here"
```

### 6.2 OpenClaw 配置

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

---

## 7. API 参考

### 7.1 HTTP 端点

| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /api/pairing/generate | 生成配对码 |
| POST | /api/pairing/validate | 验证配对码 |
| POST | /api/pairing/establish | 建立配对 |
| POST | /api/pairing/unpair | 解除配对 |
| GET | /api/pairing/status | 配对状态 |

### 7.2 WebSocket 事件

| 事件 | 方向 | 描述 |
|------|------|------|
| `connect` | C→S | 连接 |
| `disconnect` | C→S | 断开 |
| `user_message` | C→S | 用户消息 |
| `bot_response` | S→C | AI 响应 |
| `typing` | C↔S | 输入状态 |
| `pairing_update` | S→C | 配对状态更新 |

---

## 8. 故障排除

### 8.1 Channel 无法启动

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

### 8.2 无法连接到服务器

**检查网络**:
```bash
ping 47.243.55.130
```

**检查服务器状态**:
```bash
curl http://47.243.55.130:8765/health
```

### 8.3 App 无法配对

1. 确认 OpenClaw Channel 正在运行
2. 确认配对码未过期（5分钟）
3. 检查 App 日志中的错误信息

---

## 9. 安全

| 安全措施 | 说明 |
|---------|------|
| 配对码有效期 | 5 分钟 |
| 设备身份验证 | 基于 Device ID |
| Gateway 认证 | Token 验证 |
| 消息权限 | 仅允许已配对用户通信 |

---

## 10. 日志

Channel 输出详细日志：

```
[TRIXChannel] 🚀 启动 TRIX App Channel...
[TRIXChannel] ✅ 已连接到 clawbot-channel 服务器
[TRIXChannel] 🆕 新配对码: ABC123
[TRIXChannel] 📩 收到 App 消息: 你好
[TRIXChannel] ➡️  已转发到 Gateway
[TRIXChannel] ⬅️  已转发到 App
[TRIXChannel] ⚠️  Gateway 连接断开，尝试重连...
[TRIXChannel] ✅ Gateway 重连成功
```

---

## 11. 性能

| 指标 | 目标值 |
|-----|--------|
| 消息延迟 | < 100ms |
| 并发连接 | 1000+ |
| 重连时间 | < 5s |

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|-----|------|-----|
| 1.1.0 | 2026-03-04 | 更新文档，增强错误处理 |
| 1.0.0 | 2026-02-27 | 初始版本 |

---

## 13. 相关资源

- [TRIX 3D Companion](https://github.com/trix-team/trix-3d-companion)
- [OpenClaw 文档](https://docs.openclaw.ai)
- [clawbot-channel 服务器](https://github.com/trix-team/clawbot-channel)

---

**维护者**: TRIX Team
**最后更新**: 2026-03-04
