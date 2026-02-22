# OpenClaw 集成方案（历史归档）

> **状态**: 📦 归档文档
> **最后更新**: 2026-02-22
> **说明**: 本文档归档了 OpenClaw/Clawbot 的历史接入方案，当前项目已实现完整集成

---

## 当前实现方案

项目已完成 OpenClaw 集成，主要组件：

### 架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  TRIX App       │ ◄───────────────► │  Clawbot Channel │
│  (React)        │                    │  Server          │
└─────────────────┘                    └────────┬────────┘
                                                │
                                       WebSocket│
                                                ▼
                                       ┌─────────────────┐
                                       │  OpenClaw       │
                                       │  (本地)         │
                                       └─────────────────┘
```

### 核心文件

| 组件 | 文件路径 | 说明 |
|------|---------|------|
| App 连接桥 | `src/services/ClawbotChannelBridge.ts` | WebSocket 连接管理 |
| App Context | `src/contexts/ClawbotChannelContext.tsx` | 状态管理 |
| 配对服务 | `src/services/clawbotPairingService.ts` | 扫码配对 |
| 服务端 | `server/clawbot-channel/` | Node.js 后端 |
| API 文档 | `docs/api/new_clawbot_api.md` | HTTP/WebSocket API |

### 配对流程

1. **Bot 请求配对** → 服务器生成配对码
2. **App 扫码/输入** → 验证配对码
3. **配对成功** → 建立 WebSocket 通道
4. **消息收发** → 双向实时通信

---

## 历史方案归档

以下方案在开发过程中使用过，现已整合到当前实现中：

### 方案演进

| 阶段 | 方案 | 状态 |
|------|------|------|
| v1 | Nanobot 云端中转 | 已废弃 |
| v2 | Clawbot Channel 直连 | ✅ 当前使用 |
| v2.1 | 配对码优化 | ✅ 已集成 |
| v2.2 | 语音队列系统 | ✅ 已集成 |

### 废弃方案

1. **Nanobot 云端中转**
   - 原计划通过云端服务器中转消息
   - 问题：增加延迟、隐私担忧、单点故障
   - 决策：改用 P2P 直连方案

2. **旧版 API Bridge**
   - 原计划使用 HTTP 长轮询
   - 问题：实时性差、资源浪费
   - 决策：改用 WebSocket

---

## 技术细节

### WebSocket 协议

```typescript
// App 注册
socket.emit('app_register', { userId, deviceId });

// 发送消息
socket.emit('app_message', { content, contentType, messageId });

// 接收消息
socket.on('bot_message', (data) => { ... });

// 配对请求
socket.emit('request_pairing', { userId });
socket.on('pairing_code', ({ code, expiresIn }) => { ... });
```

### HTTP API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/tts/synthesize` | POST | TTS 合成 |
| `/upload` | POST | 文件上传 |
| `/oss/signed-url` | POST | 获取签名 URL |

---

## 参考文档

- 当前 API 文档: `docs/api/new_clawbot_api.md`
- 架构文档: `docs/development/ARCHITECTURE.md`
- 用户指南: `docs/guides/QR_PAIRING_USER_GUIDE.md`

---

**归档说明**: 本文档合并了以下历史文档的内容：
- `archive/clawbot/CLAWBOT_CHANNEL_GUIDE.md`
- `archive/clawbot/CLAWBOT_DEPLOYMENT.md`
- `archive/clawbot/CLAWBOT_PROTOCOL.md`
- `archive/OpenClaw-*.md` 系列
- `archive/三端接通架构文档.md`
- `archive/TRIX_INTEGRATION_GUIDE.md`
