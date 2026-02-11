# TRIX 3D Companion - Clawbot Gateway 集成指南

> **文档版本**: v1.0
> **最后更新**: 2026-02-11
> **目标读者**: Clawbot/Moltbot 开发者和集成工程师

---

## 目录

1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [集成方式](#集成方式)
4. [WebSocket 协议规范](#websocket-协议规范)
5. [配置指南](#配置指南)
6. [消息格式](#消息格式)
7. [故障排查](#故障排查)
8. [API 参考](#api-参考)

---

## 项目概述

### 什么是 TRIX 3D Companion？

**TRIX 3D Companion** 是一款移动端 AI 伴侣应用，采用 **Zero UI** 设计理念，提供沉浸式的 AI 交互体验。

### 核心特性

| 特性 | 描述 |
|------|------|
| **3D 角色展示** | 主页展示全屏 3D AI 角色，点击后显示功能面板 |
| **AI 对话** | 通过 WebSocket 连接本地 Clawbot Gateway，实现 AI 对话和桌面代理操控 |
| **学习计时器** | 番茄钟学习工具，支持状态同步和好友加入 |
| **社交功能** | 好友聊天、实时消息、通知系统 |
| **虚拟自习室** | 支持多人在线学习状态同步 |
| **语音交互** | 集成 Web Speech API 语音识别 |
| **多媒体支持** | 图片、文件、语音消息上传和发送 |

### 技术栈

```
Frontend:  React 19.2.4 + TypeScript 5.8.2
Build:     Vite 6.2.0
Database:  Supabase (PostgreSQL)
Realtime:  Supabase Realtime + WebSocket
Maps:      Leaflet 1.9.4
Animation: Framer Motion 12.33.0
```

---

## 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRIX 3D Mobile App                          │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  React Frontend (Vite)                                        │ │
│  │  ├── AuthContext (Supabase 认证)                              │ │
│  │  ├── WebSocketContext (Clawbot 连接)                          │ │
│  │  ├── Components (UI 组件)                                     │ │
│  │  └── Services (业务逻辑)                                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│         ┌────────────────────┼────────────────────┐                │
│         ▼                    ▼                    ▼                │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐         │
│  │ Supabase    │    │ Clawbot      │    │ Supabase     │         │
│  │ Realtime    │    │ Gateway      │    │ Storage      │         │
│  │ (好友状态)  │    │ (AI 对话)    │    │ (文件上传)   │         │
│  └─────────────┘    └──────────────┘    └──────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket
┌─────────────────────────────────────────────────────────────────────┐
│                    Clawbot Gateway (本地部署)                       │
│  - WebSocket Server (Port 18789)                                   │
│  - 认证机制 (Token)                                                │
│  - 流式响应 (Delta Streaming)                                      │
│  - AI Agent 代理                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 关键组件说明

#### 1. WebSocketContext (`src/contexts/WebSocketContext.tsx`)

负责与 Clawbot Gateway 的 WebSocket 连接管理：

```typescript
interface WebSocketContextValue {
  status: 'disconnected' | 'connecting' | 'connected' | 'authenticating' | 'error';
  fullResponse: string;           // Bot 完整响应
  currentStreamId: string | null;
  sendMessage: (text: string) => void;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}
```

**连接流程**:
1. 连接到 `ws://<gateway-host>:18789`
2. 接收 `connect.challenge` 握手挑战
3. 发送认证响应（包含 Token）
4. 接收 `hello-ok` 确认
5. 开始流式通信

#### 2. DatabaseService (`src/services/databaseService.ts`)

Supabase 数据库操作服务，提供：
- 好友管理（添加、查询、状态更新）
- 聊天记录（发送、查询、未读计数）
- 通知/邮件系统
- 学习记录管理
- 实时订阅（Supabase Realtime）

---

## 集成方式

### 方式一：直接 WebSocket 连接（推荐）

这是当前项目使用的方式，App 直接通过 WebSocket 协议与 Clawbot Gateway 通信。

#### 优点
- 无需额外中间层
- 低延迟
- 协议控制灵活

#### 配置步骤

**1. 在 Clawbot Gateway 配置文件中启用 webchat 频道**

编辑 `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "your-secure-token-here"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true,
      "pairing": {
        "enabled": true,
        "approvalMode": "auto"
      }
    }
  }
}
```

**2. 启动 Gateway**

```bash
# 直接启动
openclaw gateway

# 或后台运行
openclaw gateway --daemon
```

**3. 在 App 中配置环境变量**

编辑 `.env` 文件：

```env
# Clawbot Gateway WebSocket URL
VITE_PC_WEBSOCKET_URL=ws://192.168.1.100:18789

# Gateway 认证 Token
VITE_PC_AUTH_TOKEN=your-secure-token-here
```

### 方式二：通过 Vite 代理（开发环境）

Vite 开发服务器提供反向代理，解决跨域问题。

#### Vite 配置 (`vite.config.ts`)

```typescript
export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/gateway': {
        target: 'ws://127.0.0.1:18789',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
```

客户端连接时使用代理路径：
```typescript
const ws = new WebSocket('/gateway');
```

---

## WebSocket 协议规范

### 连接握手

#### 1. 客户端发起连接

```javascript
const ws = new WebSocket('ws://192.168.1.100:18789');

ws.onopen = () => {
  // 发送握手请求
  ws.send(JSON.stringify({
    type: 'req',
    id: 'nonce-12345',
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      role: 'operator',
      client: {
        id: 'trix-ios-device-uuid',
        mode: 'webchat',
        platform: 'ios',      // 或 'android'
        displayName: 'TRIX-iPhone',
        version: '1.0.0',
        instanceId: 'unique-device-id'
      },
      caps: [],
      auth: {
        token: 'your-auth-token'
      }
    }
  }));
};
```

#### 2. Gateway 响应挑战

```json
{
  "event": "connect.challenge",
  "payload": {
    "nonce": "challenge-nonce"
  }
}
```

#### 3. 客户端响应认证

```json
{
  "type": "req",
  "id": "challenge-nonce",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "role": "operator",
    "client": {
      "id": "trix-ios-device-uuid",
      "mode": "webchat",
      "platform": "ios",
      "displayName": "TRIX-iPhone",
      "version": "1.0.0",
      "instanceId": "unique-device-id"
    },
    "caps": [],
    "auth": {
      "token": "your-auth-token"
    }
  }
}
```

#### 4. Gateway 确认连接成功

```json
{
  "type": "res",
  "id": "challenge-nonce",
  "payload": {
    "type": "hello-ok",
    "protocols": [3],
    "selectedProtocol": 3
  }
}
```

### 消息发送

#### 发送文本消息

```json
{
  "type": "req",
  "id": "msg-12345",
  "method": "agent",
  "params": {
    "message": "你好，Clawbot！",
    "to": "self",
    "idempotencyKey": "unique-key-12345"
  }
}
```

#### 发送带媒体的消息

```json
{
  "type": "req",
  "id": "msg-12346",
  "method": "agent",
  "params": {
    "message": "[图片]",
    "media": {
      "type": "image",
      "uri": "https://cdn.supabase.com/...",
      "name": "photo.jpg",
      "mimeType": "image/jpeg",
      "size": 1024000
    },
    "to": "self"
  }
}
```

### 响应处理

#### 流式响应（增量）

```json
{
  "type": "res",
  "id": "msg-12345",
  "payload": {
    "stream": "assistant",
    "data": {
      "delta": "你"
    }
  }
}
```

后续增量数据：
```json
{"payload": {"data": {"delta": "好"}}}
{"payload": {"data": {"delta": "！"}}}
```

#### 响应完成

```json
{
  "type": "res",
  "id": "msg-12345",
  "payload": {
    "stream": "assistant",
    "data": {
      "delta": "",
      "finishReason": "stop"
    }
  }
}
```

### 心跳机制

建议实现心跳以保持连接活跃：

```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'req',
      id: `heartbeat-${Date.now()}`,
      method: 'ping',
      params: {
        timestamp: Date.now()
      }
    }));
  }
}, 30000); // 每 30 秒
```

---

## 配置指南

### 完整环境变量配置

```env
# ============================================
# Supabase 数据库配置
# ============================================
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# Clawbot Gateway 配置
# ============================================

# Gateway WebSocket URL (本地/局域网)
VITE_PC_WEBSOCKET_URL=ws://192.168.1.100:18789

# 移动端访问 URL (同一局域网)
VITE_PC_WEBSOCKET_URL_MOBILE=ws://192.168.1.100:18789

# Gateway 认证 Token (与 Gateway 配置一致)
VITE_PC_AUTH_TOKEN=your-secure-auth-token

# ============================================
# Supabase Storage (文件上传)
# ============================================
VITE_SUPABASE_STORAGE_PATH=trix-uploads

# ============================================
# 开发配置
# ============================================
VITE_DEBUG=true
```

### 网络配置

#### 本地开发（同一台机器）

```env
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
VITE_PC_WEBSOCKET_URL_MOBILE=ws://localhost:18789
```

#### 局域网访问（PC 和手机在同一 WiFi）

1. 获取 PC 的局域网 IP：
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

2. 配置环境变量：
```env
VITE_PC_WEBSOCKET_URL=ws://192.168.1.100:18789
```

3. 确保防火墙允许 18789 端口

#### 公网访问（需要 Ngrok 或类似服务）

```bash
# 使用 Ngrok 暴露本地端口
ngrok http 18789
```

配置环境变量：
```env
VITE_PC_WEBSOCKET_URL=wss://abc123.ngrok.io
```

---

## 消息格式

### 客户端 → Gateway

#### 基础消息结构

```typescript
interface WebSocketMessage {
  type: 'req' | 'res' | 'event' | 'error';
  id?: string;              // 请求唯一 ID
  method?: string;          // 方法名 (agent, ping, etc.)
  params?: any;             // 方法参数
  event?: string;           // 事件名
  payload?: any;            // 响应数据
  data?: any;               // 事件数据
}
```

#### 支持的方法

| 方法 | 参数 | 描述 |
|------|------|------|
| `connect` | client, auth, role | 建立连接和认证 |
| `agent` | message, to, media | 发送 AI 消息 |
| `ping` | timestamp | 心跳检测 |

### Gateway → 客户端

#### 事件类型

| 事件 | 描述 |
|------|------|
| `connect.challenge` | 握手挑战 |
| `connect.error` | 连接错误 |
| `agent.delta` | AI 增量响应 |
| `agent.complete` | AI 响应完成 |
| `agent.error` | AI 处理错误 |
| `pong` | 心跳响应 |

#### 错误响应

```json
{
  "type": "error",
  "id": "msg-12345",
  "payload": {
    "code": "AUTH_FAILED",
    "message": "Invalid authentication token"
  }
}
```

---

## 故障排查

### 常见问题

#### 1. 连接失败 (Error Code: 1006)

**症状**: WebSocket 无法建立连接

**排查步骤**:

```bash
# 1. 检查 Gateway 是否运行
curl http://127.0.0.1:18789/health

# 2. 检查端口是否被占用
lsof -i :18789  # macOS/Linux
netstat -ano | findstr :18789  # Windows

# 3. 检查防火墙
# macOS
sudo /usr/libexec/ApplicationHelper/Contents/MacOS/OpenFirewall --list

# Windows
netsh advfirewall show allprofiles

# 4. 查看 Gateway 日志
tail -f ~/.openclaw/openclaw.log
```

**解决方案**:
- 确保 Clawbot Gateway 正在运行
- 检查 18789 端口是否开放
- 确认防火墙允许该端口

#### 2. 认证失败 (401/403)

**症状**: 握手阶段返回认证错误

**排查步骤**:

```bash
# 检查 Token 配置
echo $VITE_PC_AUTH_TOKEN

# 对比 Gateway 配置
cat ~/.openclaw/openclaw.json | grep token
```

**解决方案**:
- 确保 `.env` 中的 Token 与 Gateway 配置一致
- 检查 Token 是否过期（如果有时效性设置）

#### 3. 跨域错误 (CORS)

**症状**: 浏览器控制台显示 CORS 错误

**解决方案**:

**方式一**: 使用 Vite 代理（开发环境）

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/gateway': {
        target: 'ws://127.0.0.1:18789',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
```

**方式二**: 在 Gateway 配置中添加 CORS 规则

```json
{
  "gateway": {
    "cors": {
      "allowedOrigins": ["http://localhost:5173", "http://192.168.1.*"],
      "allowedMethods": ["GET", "POST"],
      "allowedHeaders": ["*"]
    }
  }
}
```

#### 4. 连接频繁断开

**症状**: WebSocket 连接建立后很快断开

**可能原因**:
- 网络不稳定
- 缺少心跳机制
- Gateway 超时设置过短

**解决方案**:

实现客户端心跳：

```typescript
// 在 WebSocketContext 中添加
useEffect(() => {
  if (isConnected) {
    const heartbeat = setInterval(() => {
      ws.send(JSON.stringify({
        type: 'req',
        id: `heartbeat-${Date.now()}`,
        method: 'ping',
        params: { timestamp: Date.now() }
      }));
    }, 30000); // 每 30 秒

    return () => clearInterval(heartbeat);
  }
}, [isConnected]);
```

#### 5. 消息发送无响应

**症状**: 消息发送成功但没有收到响应

**排查步骤**:

1. 检查消息格式是否正确
2. 查看 Gateway 日志
3. 确认 AI Agent 是否正常工作

**调试代码**:

```typescript
ws.onmessage = (event) => {
  console.log('[WebSocket] 收到消息:', event.data);
  const message = JSON.parse(event.data);
  console.log('[WebSocket] 解析后:', message);
};
```

### 调试工具

项目内置诊断页面：

- **基础诊断**: `/diagnostic` - 连接状态和基本信息
- **高级诊断**: `/diagnostic-advanced` - WebSocket 事件详情

---

## API 参考

### WebSocketContext API

```typescript
interface WebSocketContextValue {
  // 连接状态
  status: ConnectionStatus;
  isConnected: boolean;
  fullResponse: string;        // AI 完整响应
  currentStreamId: string | null;

  // 方法
  sendMessage: (text: string) => void;
  connect: () => void;
  disconnect: () => void;
}

type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';
```

### 使用示例

```typescript
import { useWebSocket } from '../contexts/WebSocketContext';

function ChatComponent() {
  const { sendMessage, isConnected, status } = useWebSocket();

  const handleSend = (text: string) => {
    if (isConnected) {
      sendMessage(text);
    } else {
      console.error('未连接到 Gateway');
    }
  };

  return (
    <div>
      <p>状态: {status}</p>
      <button onClick={() => handleSend('Hello!')}>发送消息</button>
    </div>
  );
}
```

---

## 附录

### A. 项目文件结构

```
e:\desktop\trix-3d-companion/
├── src/
│   ├── contexts/
│   │   └── WebSocketContext.tsx      # WebSocket 连接管理
│   ├── services/
│   │   ├── databaseService.ts        # Supabase 数据库操作
│   │   └── projectService.ts         # 项目管理（localStorage）
│   ├── screens/
│   │   ├── ChatDetail.tsx            # 聊天详情（Bot 对话）
│   │   ├── Pairing.tsx               # 配对页面
│   │   ├── Diagnostic.tsx            # 连接诊断
│   │   └── DiagnosticAdvanced.tsx    # 高级诊断
│   ├── config/
│   │   └── supabase.ts               # Supabase 客户端配置
│   └── hooks/
│       ├── useCamera.ts              # 相机 Hook
│       └── useSpeechToText.ts        # 语音识别 Hook
├── .env                              # 环境变量配置
├── .env.example                      # 环境变量模板
├── vite.config.ts                    # Vite 配置
└── package.json                      # 项目依赖
```

### B. 关键配置文件

#### `.env.example`

```env
# Supabase 配置
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Clawbot Gateway 配置
VITE_PC_WEBSOCKET_URL=ws://localhost:18789
VITE_PC_WEBSOCKET_URL_MOBILE=ws://192.168.1.100:18789
VITE_PC_AUTH_TOKEN=your-auth-token
```

#### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/gateway': {
        target: 'ws://127.0.0.1:18789',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: { '@': './src' }
  }
});
```

### C. 相关资源

- **项目地址**: [TRIX 3D Companion](https://github.com/your-repo/trix-3d-companion)
- **Clawbot 文档**: [Molt.bot](https://molt.bot)
- **Supabase 文档**: [supabase.com/docs](https://supabase.com/docs)
- **WebSocket 协议**: [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)

### D. 联系方式

如有集成问题，请通过以下方式联系：

- **GitHub Issues**: [项目 Issues 页面]
- **Email**: your-email@example.com

---

**文档维护**: TRIX 3D Companion 开发团队
**最后更新**: 2026-02-11
