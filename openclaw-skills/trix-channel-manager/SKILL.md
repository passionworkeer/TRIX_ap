---
id: trix-channel-manager
owner_id: trix-team
name: TRIX Channel Manager
description: TRIX App Channel Manager - 管理和启动 TRIX App 与 OpenClaw 的实时双向通信
version: 1.0.0
icon: "🎮"
author: TRIX Team
metadata:
  clawdbot:
    emoji: "🎮"
    requires:
      bins: []
---

# TRIX Channel Manager

这是 TRIX App Channel 的管理 Skill，用于在 OpenClaw 中启动和管理 TRIX Channel。

## 🎯 功能

- 🚀 **启动 Channel** - 启动 TRIX Channel 长连接服务
- 📱 **生成配对码** - 生成 App 配对码
- 📊 **查看状态** - 查看连接状态
- 🛑 **停止服务** - 停止 Channel

## 📦 使用方法

### 启动 Channel

在 OpenClaw 中输入：
```
启动 TRIX Channel
```

### 生成配对码

在 OpenClaw 中输入：
```
生成 TRIX 配对码
```

你会看到：
```
✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：ABC123
🔗 配对ID：xxx
⏰ 有效期：5分钟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 查看状态

在 OpenClaw 中输入：
```
查看 TRIX Channel 状态
```

### 停止 Channel

在 OpenClaw 中输入：
```
停止 TRIX Channel
```

## 🔧 架构

```
OpenClaw (Skill) → Manager → TRIX Channel (Process)
                              ↓
                    clawbot-channel Server
                              ↓
                         OpenClaw Gateway
```

## 📝 相关

- [TRIX Channel](../trix-channel/) - 核心 Channel 实现
- [OpenClaw 文档](https://docs.openclaw.ai)
