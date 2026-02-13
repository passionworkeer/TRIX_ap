# TRIX 3D Companion - Clawbot 快速集成指南

> **文档版本**: v2.0
> **最后更新**: 2026-02-11
> **目标读者**: Clawbot/Moltbot 开发者和集成工程师

---

## 目录

1. [快速开始](#快速开始)
2. [扫码配对流程](#扫码配对流程)
3. [安全隔离方案](#安全隔离方案)
4. [简化版实现](#简化版实现)
5. [完整版实现](#完整版实现)
6. [故障排查](#故障排查)

---

## 快速开始

### 核心概念

**TRIX 3D Companion** 通过扫码方式接入 Clawbot Gateway：

```
┌─────────────────────────────────────────────────────────────┐
│                    配对流程 (反向扫码)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 电脑端 Gateway 启动 → 生成二维码                          │
│  2. 手机 App 打开 → 扫描二维码                               │
│  3. 电脑端显示配对请求 → 用户点击"允许"                       │
│  4. 配对成功 → 建立 WebSocket 长连接                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

```
Frontend:  React 19.2.4 + TypeScript 5.8.2
Build:     Vite 6.2.0
Database:  Supabase (PostgreSQL)
Realtime:  Supabase Realtime + WebSocket (Clawbot)
```

---

## 扫码配对流程

### 流程图

```
┌──────────────────┐                           ┌──────────────────┐
│  电脑端 Gateway  │                           │    手机 App      │
│  (Clawbot)       │                           │  (TRIX 3D)       │
└────────┬─────────┘                           └────────┬─────────┘
         │                                               │
         │ 1. 启动 Gateway，生成配对 Token               │
         │                                               │
         │ 2. 生成二维码 (包含 URL + Token)              │
         ├────────────────────┐                        │
         │                    │                        │
         │    显示二维码       │                        │
         │                    │                        │
         └────────────────────┘                        │
                         │                               │
                         │ 3. 用户扫描二维码              │
                         │◄──────────────────────────────┤
                         │                               │
         │ 4. 接收配对请求 (device_id, device_name)      │
         │                                               │
         │ 5. 显示配对确认弹窗                            │
         │    "iPhone 13 请求连接"                       │
         │    [允许] [拒绝]                              │
         │                                               │
         │ 6. 用户点击"允许"                             │
         │                                               │
         │ 7. 生成设备专用 Token                         │
         ├──────────────────────────────────────────────>│
         │     返回: device_token                       │
         │                                               │
         │                                    8. 使用 Token 建立
         │                                       WebSocket 连接
         │                                               │
         │ 9. 连接成功，开始通信                          │
         ├──────────────────────────────────────────────>│
         │                                               │
```

### 二维码内容格式

电脑端生成的二维码包含以下信息：

```json
{
  "action": "pairing_request",
  "gateway_url": "ws://192.168.1.100:18789",
  "pairing_token": "temp-token-abc123",
  "gateway_id": "clawbot-pc-001",
  "expires_at": "2026-02-11T12:00:00Z"
}
```

### 配对消息协议

#### 手机 → Gateway (配对请求)

```json
{
  "type": "req",
  "id": "pair-req-001",
  "method": "pairing.request",
  "params": {
    "device_id": "trix-ios-device-uuid",
    "device_name": "iPhone 13",
    "device_type": "mobile",
    "platform": "ios",
    "app_version": "1.0.0"
  }
}
```

#### Gateway → 手机 (配对成功)

```json
{
  "type": "res",
  "id": "pair-req-001",
  "payload": {
    "status": "approved",
    "device_token": "device-specific-token-xyz789",
    "gateway_info": {
      "name": "我的电脑",
      "version": "1.0.0"
    }
  }
}
```

---

## 安全隔离方案

### 1. 设备隔离

每个配对的设备拥有独立的 Token 和权限：

```typescript
interface DeviceIdentity {
  device_id: string;        // 设备唯一标识
  device_token: string;     // 设备专用 Token
  permissions: string[];    // 权限列表
  paired_at: number;        // 配对时间
  last_seen: number;        // 最后活跃时间
}
```

**权限级别**：

| 级别 | 权限 | 描述 |
|------|------|------|
| `basic` | 发送消息、接收响应 | 基础对话功能 |
| `full` | + 媒体上传、语音 | 完整功能 |
| `admin` | + 设备管理、配对审批 | 管理员权限 |

### 2. Token 管理

```typescript
// Token 类型
interface TokenConfig {
  // 主 Gateway Token (配置在 openclaw.json)
  masterToken: string;

  // 临时配对 Token (二维码用，5分钟有效)
  pairingToken: {
    token: string;
    expiresAt: number;
  };

  // 设备专用 Token (配对成功后生成，长期有效)
  deviceTokens: Map<string, {
    token: string;
    deviceId: string;
    permissions: string[];
    createdAt: number;
  }>;
}
```

**Token 生成策略**：

```typescript
// 生成临时配对 Token (5分钟有效)
function generatePairingToken(): string {
  const randomBytes = crypto.randomBytes(32);
  const token = randomBytes.toString('base64');
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟

  return `${token}.${expiresAt}`;
}

// 生成设备专用 Token (长期有效)
function generateDeviceToken(deviceId: string): string {
  const payload = {
    deviceId,
    permissions: ['basic', 'full'],
    createdAt: Date.now()
  };

  // 使用 masterToken 签名
  return sign(payload, masterToken);
}
```

### 3. 网络隔离

```json
// Gateway 配置 (~/.openclaw/openclaw.json)
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bindAddress": "0.0.0.0",  // 允许局域网访问
    "auth": {
      "mode": "token",
      "token": "master-token-change-me"
    },
    "security": {
      "allowedNetworks": ["192.168.1.0/24", "10.0.0.0/8"],
      "maxConnectionsPerDevice": 3,
      "rateLimiting": {
        "enabled": true,
        "maxRequestsPerMinute": 100
      }
    }
  }
}
```

### 4. 消息隔离

每个设备的消息会话完全隔离：

```typescript
interface MessageSession {
  sessionId: string;
  deviceId: string;
  messages: Message[];
  createdAt: number;
  lastActivity: number;
}

// 消息路由
function routeMessage(message: Message, deviceId: string) {
  const session = sessions.get(deviceId);

  if (!session) {
    throw new Error('设备未配对或会话已过期');
  }

  // 验证设备权限
  if (!hasPermission(session.deviceId, 'agent:send')) {
    throw new Error('权限不足');
  }

  // 路由到 AI Agent
  return agent.process(message, { sessionId: session.sessionId });
}
```

### 5. 审计日志

```typescript
interface AuditLog {
  timestamp: number;
  deviceId: string;
  action: 'pairing_request' | 'pairing_approved' | 'pairing_denied' | 'message_sent' | 'message_received';
  details: any;
}

function logAudit(action: string, deviceId: string, details: any) {
  const log: AuditLog = {
    timestamp: Date.now(),
    deviceId,
    action,
    details
  };

  // 保存到日志文件
  fs.appendFileSync('audit.log', JSON.stringify(log) + '\n');

  // 可选：发送到远程监控
  if (config.remoteLogging) {
    sendToRemoteMonitoring(log);
  }
}
```

---

## 简化版实现

### 目标

快速实现基本连接功能，适合开发测试阶段。

### 实现步骤

#### 步骤 1: 配置 Gateway

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "trix-simple-token-12345"
    }
  },
  "channels": {
    "webchat": {
      "enabled": true
    }
  }
}
```

#### 步骤 2: 启动 Gateway

```bash
# 启动 Gateway
openclaw gateway

# 验证运行
curl http://127.0.0.1:18789/health
```

#### 步骤 3: 手机 App 简单连接

```typescript
// src/services/simpleGatewayConnection.ts

interface SimpleConnectionConfig {
  gatewayUrl: string;    // 从二维码解析或用户输入
  authToken: string;     // 从二维码解析或用户输入
}

class SimpleGatewayConnection {
  private ws: WebSocket | null = null;
  private config: SimpleConnectionConfig;

  constructor(config: SimpleConnectionConfig) {
    this.config = config;
  }

  /**
   * 简单连接（无重连、无队列）
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.gatewayUrl);

        this.ws.onopen = () => {
          console.log('[SimpleWS] 连接成功');

          // 发送认证握手
          this.ws!.send(JSON.stringify({
            type: 'req',
            id: 'auth-001',
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              role: 'operator',
              client: {
                id: 'trix-mobile-' + Date.now(),
                mode: 'webchat',
                platform: 'ios',
                displayName: 'TRIX Mobile',
                version: '1.0.0',
                instanceId: 'trix-instance'
              },
              caps: [],
              auth: {
                token: this.config.authToken
              }
            }
          }));
        };

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          // 处理握手挑战
          if (message.event === 'connect.challenge') {
            this.ws!.send(JSON.stringify({
              type: 'req',
              id: message.payload?.nonce || '1',
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                role: 'operator',
                client: {
                  id: 'trix-mobile-' + Date.now(),
                  mode: 'webchat',
                  platform: 'ios',
                  displayName: 'TRIX Mobile',
                  version: '1.0.0',
                  instanceId: 'trix-instance'
                },
                caps: [],
                auth: {
                  token: this.config.authToken
                }
              }
            }));
          }

          // 握手成功
          if (message.type === 'res' && message.payload?.type === 'hello-ok') {
            console.log('[SimpleWS] 认证成功');
            resolve();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[SimpleWS] 连接错误:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[SimpleWS] 连接关闭');
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 发送消息
   */
  sendMessage(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('未连接');
    }

    this.ws.send(JSON.stringify({
      type: 'req',
      id: 'msg-' + Date.now(),
      method: 'agent',
      params: {
        message: text,
        to: 'self'
      }
    }));
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

#### 步骤 4: 使用示例

```typescript
// 从二维码或用户输入获取连接信息
const connection = new SimpleGatewayConnection({
  gatewayUrl: 'ws://192.168.1.100:18789',
  authToken: 'trix-simple-token-12345'
});

// 连接
await connection.connect();

// 发送消息
connection.sendMessage('Hello, Clawbot!');

// 断开连接
connection.disconnect();
```

### 简化版特点

| 特性 | 简化版 | 完整版 |
|------|--------|--------|
| 代码复杂度 | 低 (~100行) | 高 (~500行) |
| 扫码配对 | 手动输入 URL/TOKEN | 完整扫码流程 |
| 自动重连 | ❌ | ✅ |
| 心跳机制 | ❌ | ✅ |
| 消息队列 | ❌ | ✅ |
| 设备隔离 | 基础 (Token) | 完整 (设备ID + 权限) |
| 错误处理 | 基础 | 完整 |
| 适用场景 | 开发测试 | 生产环境 |

---

## 完整版实现

### 功能列表

- ✅ **扫码配对**：电脑生成二维码，手机扫描配对
- ✅ **自动重连**：断线后指数退避重连
- ✅ **心跳机制**：30秒心跳保持连接活跃
- ✅ **消息队列**：离线消息缓存，重连后发送
- ✅ **设备隔离**：每个设备独立 Token 和会话
- ✅ **权限管理**：多级权限控制
- ✅ **审计日志**：完整的操作日志记录
- ✅ **多媒体支持**：图片、文件、语音消息

### 实现文档

完整版实现请参考：
- **[CLAWBOT_INTEGRATION_GUIDE.md](./CLAWBOT_INTEGRATION_GUIDE.md)** - 详细实现方案
- **[CLAWBOT_GATEWAY_INTEGRATION.md](./CLAWBOT_GATEWAY_INTEGRATION.md)** - WebSocket 协议规范

---

## 故障排查

### 常见问题

#### 1. 扫码后无法连接

**可能原因**：
- 手机和电脑不在同一网络
- Gateway 未启动或端口被占用
- 防火墙阻止连接

**解决方案**：

```bash
# 1. 检查 Gateway 运行状态
curl http://127.0.0.1:18789/health

# 2. 检查端口占用
lsof -i :18789  # macOS/Linux
netstat -ano | findstr :18789  # Windows

# 3. 检查防火墙
# macOS
sudo /usr/libexec/ApplicationHelper/Contents/MacOS/OpenFirewall --list

# Windows
netsh advfirewall show allprofiles
```

#### 2. 配对请求超时

**可能原因**：
- 二维码中的 Token 已过期
- 网络延迟过高

**解决方案**：
- 重新生成二维码
- 确保网络稳定

#### 3. 设备频繁掉线

**可能原因**：
- 缺少心跳机制
- 网络不稳定
- Gateway 超时设置过短

**解决方案**：
- 实现心跳机制（完整版）
- 启用自动重连
- 检查网络质量

---

## 附录

### A. 环境变量配置

```env
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Clawbot Gateway 配置
VITE_CLAWBOT_GATEWAY_URL=ws://192.168.1.100:18789
VITE_CLAWBOT_GATEWAY_TOKEN=your-token-here
```

### B. 项目文件结构

```
e:\desktop\trix-3d-companion/
├── src/
│   ├── contexts/
│   │   ├── WebSocketContext.tsx          # 简单版连接
│   │   └── EnhancedWebSocketContext.tsx  # 完整版连接
│   ├── services/
│   │   ├── simpleGatewayConnection.ts    # 简单版服务
│   │   ├── clawbotPairingService.ts      # 配对服务
│   │   └── mediaUploadService.ts        # 媒体上传
│   └── screens/
│       ├── ChatDetail.tsx                # 聊天界面
│       └── QRScan.tsx                    # 扫码界面
├── docs/
│   ├── CLAWBOT_QUICK_START.md           # 本文档
│   ├── CLAWBOT_GATEWAY_INTEGRATION.md   # 协议规范
│   └── CLAWBOT_INTEGRATION_GUIDE.md     # 完整实现
└── package.json
```

### C. 相关资源

- **项目地址**: [TRIX 3D Companion](https://github.com/your-repo/trix-3d-companion)
- **Clawbot 文档**: [Molt.bot](https://molt.bot)
- **Supabase 文档**: [supabase.com/docs](https://supabase.com/docs)

---

**文档维护**: TRIX 3D Companion 开发团队
**最后更新**: 2026-02-11
**版本**: v2.0
