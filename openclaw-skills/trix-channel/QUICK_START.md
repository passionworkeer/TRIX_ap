# 🚀 TRIX Channel 快速使用指南

## 📋 前置条件

✅ OpenClaw 已安装
✅ OpenClaw Gateway 正在运行（端口 18789）
✅ TRIX Channel Skills 已安装（自动完成）

## 🎯 三步开始使用

### 步骤 1: 启动 TRIX Channel

在 OpenClaw 中输入：
```
启动 TRIX Channel
```

你会看到：
```
✅ TRIX Channel 已启动

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务器: http://47.243.55.130:8765
🌐 Gateway: ws://127.0.0.1:18789
✅ 状态: 运行中
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 步骤 2: 生成配对码

在 OpenClaw 中输入：
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

### 步骤 3: 在 App 中配对

1. 打开 TRIX App
2. 进入配对页面
3. 输入配对码：`ABC123`
4. 点击确认配对
5. **配对成功！**

## 💬 开始聊天

现在你可以在 TRIX App 中与 OpenClaw 实时聊天了！

### 消息流程

```
你的消息:
TRIX App → 服务器 → TRIX Channel → OpenClaw Gateway → OpenClaw Agent
                                                             ↓
OpenClaw 回复:                                               │
TRIX App ← 服务器 ← TRIX Channel ← OpenClaw Gateway ←────────┘
```

### 测试方法

1. 在 App 中发送：`你好`
2. OpenClaw 会实时回复

## 📊 查看状态

在 OpenClaw 中输入：
```
查看 TRIX Channel 状态
```

你会看到：
```
✅ TRIX Channel 状态

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务器连接: ✅
🌐 Gateway 连接: ✅
🔑 Device ID: trix_12345_1739280000000
🔗 配对 ID: pair_abc123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🛑 停止服务

在 OpenClaw 中输入：
```
停止 TRIX Channel
```

## 🐛 常见问题

### Q: 配对码过期了怎么办？

**A**: 在 OpenClaw 中重新生成：
```
生成 TRIX 配对码
```

### Q: App 显示"无法连接"？

**A**: 检查以下几点：
1. OpenClaw Gateway 是否运行（端口 18789）
2. TRIX Channel 是否启动
3. 网络是否正常

**解决方案**:
```
# 重启 Channel
停止 TRIX Channel
启动 TRIX Channel
```

### Q: 消息发送后没有回复？

**A**: 检查状态：
```
查看 TRIX Channel 状态
```

确保：
- ✅ 服务器连接正常
- ✅ Gateway 连接正常

### Q: Gateway 连接失败？

**A**: 确保 OpenClaw Gateway 正在运行：
```bash
# 检查 Gateway 端口
netstat -ano | findstr 18789
```

如果未运行，启动 OpenClaw 即可。

## 💡 高级功能

### 环境变量配置

你可以通过环境变量自定义配置：

```bash
# clawbot-channel 服务器地址
export CLAWBOT_SERVER_URL="http://47.243.55.130:8765"

# OpenClaw Gateway 地址
export GATEWAY_URL="ws://127.0.0.1:18789"

# Gateway Token（从 ~/.openclaw/openclaw.json 获取）
export GATEWAY_TOKEN="your-token-here"
```

### 手动启动

如果不想通过 OpenClaw 命令，也可以手动启动：

```bash
# Windows
cd e:\desktop\trix-3d-companion\openclaw-skills\trix-channel
start-trix-channel.bat

# Linux/Mac
cd openclaw-skills/trix-channel
./start-trix-channel.sh

# 或者直接运行
node ~/.openclaw/skills/trix-channel/index.js
```

### 测试脚本

运行集成测试：
```bash
cd openclaw-skills/trix-channel
node integration-test.js
```

## 📚 详细文档

- [完整文档](SKILL.md) - 详细功能说明
- [部署报告](../../TRIX_CHANNEL_DEPLOYMENT.md) - 部署详情
- [解决方案](../../OPENCLAW_LONG_CONNECTION_FIX.md) - 技术架构

## 🎉 特性

✅ **持久化连接** - 像 WhatsApp Web 一样保持在线
✅ **实时通信** - 毫秒级消息传递
✅ **自动重连** - 断线自动重连
✅ **双向消息** - App ↔ OpenClaw 实时同步
✅ **状态监控** - 随时查看连接状态
✅ **详细日志** - 实时输出运行状态

---

**下一步**:
1. 在 OpenClaw 中：`启动 TRIX Channel`
2. 然后：`生成 TRIX 配对码`
3. 在 App 中输入配对码
4. 开始实时聊天！🎉
