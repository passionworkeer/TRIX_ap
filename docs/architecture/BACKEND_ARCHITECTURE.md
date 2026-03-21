# 后端架构文档

> 📚 TRIX 3D Companion 后端服务架构
> 🎯 基于 Node.js + Express + 原生 WebSocket
> **最后更新**: 2026-03-21

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Backend Architecture                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  │    iOS       │    │     Web      │    │  OpenClaw    │    │   Mobile     │
│  │  (HTTP/WS)   │    │  (HTTP/WS)   │    │  (WebSocket) │    │   (Native)   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┼───────────────────┘
│                             ▼                                       │
│                    ┌──────────────┐                              │
│                    │   Express     │                              │
│                    │ Server (:8788)│                              │
│                    └──────┬───────┘                              │
│                           │                                       │
│         ┌─────────────────┼─────────────────┐                     │
│         ▼                 ▼                 ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pairing    │  │   Message    │  │     TTS      │      │
│  │   Service    │  │   Service    │  │  (Edge TTS)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                 │                    │
│         └─────────────────┼─────────────────┘                    │
│                           ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Data Layer                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │   SQLite     │  │  Supabase    │  │    OSS       │      │   │
│  │  │  (Local)     │  │ (PostgreSQL) │  │   (可选)      │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 服务端口

| 服务 | 端口 | 描述 |
|------|------|------|
| Clawbot Channel | 8765 | ~~AI 对话服务~~ (已废弃) |
| TRIX Native Server | 8788 | iOS-Web 消息同步 |
| Gateway | 18789 | 设备网关 |

---

## 2. TRIX Native Server 架构

TRIX Native Server (端口 8788) 提供 iOS 设备与 Web 前端的双向消息同步。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  TRIX Native Server (端口 8788)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │     iOS      │    │   Web 前端   │    │  OpenClaw    │              │
│  │  (配对码)    │    │  (配对码)    │    │   Plugin     │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                         │
│         └───────────────────┼───────────────────┘                         │
│                             ▼                                           │
│                    ┌──────────────┐                                    │
│                    │   Express    │                                    │
│                    │   Server     │                                    │
│                    └──────┬───────┘                                    │
│                           │                                             │
│         ┌─────────────────┼─────────────────┐                          │
│         ▼                 ▼                 ▼                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  Pairing     │  │  Message     │  │   Upload     │                │
│  │  Service     │  │  Service     │  │  Service     │                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                 │                            │
│         └─────────────────┼─────────────────┘                          │
│                           ▼                                             │
│                    ┌──────────────┐                                    │
│                    │   SQLite     │                                    │
│                    │  (Local DB)  │                                    │
│                    └──────────────┘                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 主要 API 端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /health | 健康检查 |
| POST | /api/pairings | 生成配对码 |
| GET | /api/pairings | 列出所有配对（需 Admin Token） |
| GET | /api/pairings/:code | 查询配对状态 |
| POST | /api/pairings/:code/claim | 认领配对 |
| POST | /api/messages | 发送消息 |
| POST | /api/uploads | 上传附件 |
| GET | /api/conversations/:id/messages | 历史消息 |
| POST | /api/study-rooms | 创建学习房间 |
| GET | /api/study-rooms | 列出房间 |
| POST | /api/study-rooms/:roomCode/join | 加入房间 |
| POST | /api/tts/synthesize | Edge TTS 语音合成 |

> 完整协议见 [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md)。

### WebSocket 端点

连接 URL（生产: `https://trix.love`）：
```
wss://trix.love/ws?role=user&conversationId=xxx&clientId=xxx&clientToken=xxx  # 用户端
wss://trix.love/api/service/ws?accountId=xxx&serviceToken=xxx               # Service/Plugin
```

---

## 2. 技术栈

| 类别 | 技术 | 版本 |
|-----|------|-----|
| 运行时 | Node.js | 18+ |
| 框架 | Express | 4.18+ |
| WebSocket | 原生 WebSocket（`ws` 库） | 8.x |
| 数据库 | SQLite | 3.x |
| 远程数据库 | Supabase (PostgreSQL) | - |
| 文件存储 | OSS（可选） | - |
| 语音合成 | Edge TTS（`node-edge-tts`） | - |
| 部署 | PM2 | - |

> ⚠️ 旧版 Clawbot Channel (Socket.IO, 端口 8765) 已废弃，当前使用 TRIX Native Server（端口 8788）。

---

## 3. 目录结构

```
packages/trix-openclaw-native/          # TRIX Native Channel 插件
├── src/
│   ├── plugin/                         # OpenClaw 插件接口
│   │   ├── plugin.ts                   # 插件主入口（含 startAccount）
│   │   ├── accounts.ts                 # 账号管理
│   │   ├── inbound.ts                 # 消息入站（startInboundMonitor）
│   │   └── outbound.ts                # 消息出站（postReply）
│   ├── server/                        # TRIX Native Server
│   │   └── TrixNativeServer.ts        # HTTP/WebSocket 服务器主入口
│   ├── pairing/                       # 配对服务
│   │   └── PairingService.ts         # 配对码生成、认领、状态管理
│   ├── storage/                       # 存储服务
│   │   └── JsonStateStore.ts          # JSON 状态持久化
│   ├── utils/                         # 工具函数
│   │   ├── ids.ts                    # ID 生成
│   │   ├── network.ts                 # 网络工具
│   │   └── http.ts                    # HTTP 客户端
│   ├── account.ts                    # 账号抽象
│   ├── bindings.ts                    # 绑定管理
│   ├── channel.ts                     # Channel 抽象
│   ├── monitor.ts                     # Monitor 抽象
│   ├── normalize.ts                   # 消息标准化
│   ├── probe.ts                       # 健康检查
│   ├── setup.ts                      # 配置初始化
│   ├── types.ts                       # 类型定义
│   ├── cli.ts                         # CLI 入口
│   ├── index.ts                       # npm 包主入口
│   └── entry-compat.ts               # 兼容入口
├── test/
│   ├── pairing.test.ts               # 配对服务测试
│   ├── server.test.ts                # 服务器测试
│   └── attachments.test.ts           # 附件测试
├── openclaw.plugin.json              # OpenClaw 插件声明
└── package.json                       # 依赖配置（含 openclaw peerDependency）
```

> **注意**: 旧版 `server/clawbot-channel/` 已废弃，相关功能已迁移到本包。消息/OSS/TTS 等功能通过 Supabase 或前端服务实现，非独立后端服务。

---

## 4. 核心服务

### 4.1 配对服务 (PairingService.ts)

**功能**: 管理 iOS 设备与 Web 端的配对关系。

```javascript
class PairingService {
  // 生成配对码 (6位字母数字)
  generatePairingCode()

  // 验证配对码
  validatePairingCode(code)

  // 建立配对
  establishPairing(deviceId, code)

  // 解除配对
  unpair(deviceId)

  // 获取配对状态
  getPairingStatus(deviceId)

  // 恢复配对
  restorePairing(deviceId, pairingId)
}
```

**数据库表**:
```sql
CREATE TABLE pairings (
  id TEXT PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  pairing_code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

---

### 4.2 消息服务

消息收发逻辑集成在 `TrixNativeServer.ts` 中，由 `startInboundMonitor` 和 `postReply` 实现。消息通过 Supabase 持久化，通过 WebSocket 实时推送。详见 [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md)。

---

### 4.3 TTS / OSS 服务

TTS 和 OSS 功能：
- **TTS**: `packages/trix-openclaw-native/src/server/TrixNativeServer.ts` → 使用 `node-edge-tts`（Edge TTS），非豆包 TTS
- **OSS**: `src/services/OSSService.ts` / `serverOssUploadService.ts` → 阿里云 OSS（可选）

---

### 4.4 学习室服务 (Supabase)

**功能**: 管理学习室和成员（Supabase `study_rooms` / `study_room_members` 表）。

```typescript
class StudyRoomService {
  // 创建学习室
  createRoom(hostId, name)

  // 加入学习室
  joinRoom(roomId, userId)

  // 离开学习室
  leaveRoom(roomId, userId)

  // 获取房间列表
  listRooms()

  // 更新成员状态
  updateMemberStatus(roomId, userId, status)
}
```

---

## 5. API 端点

> **说明**: 大部分功能（消息、认证、商城、位置等）通过 **Supabase**（`@supabase/supabase-js`）实现。独立 TRIX Native Server（端口 8788）仅提供配对相关 API。

### 5.1 TRIX Native Server HTTP API（端口 8788）

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /health | 健康检查（含 agentOnline） |
| POST | /api/pairings | 创建配对码 |
| GET | /api/pairings | 列出所有配对（需 Admin Token） |
| GET | /api/pairings/:code | 查询配对状态（配对码有效期 1 小时） |
| POST | /api/pairings/:code/claim | 认领配对 |
| POST | /api/messages | 发送消息 |
| POST | /api/uploads | 上传附件 |
| GET | /api/conversations/:id/messages | 历史消息 |
| POST | /api/study-rooms | 创建学习房间 |
| POST | /api/tts/synthesize | Edge TTS 语音合成 |

### 5.2 WebSocket 协议

> 完整协议见 [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md)。

WebSocket 连接（生产 `wss://trix.love`）：

| 角色 | URL 参数 | 用途 |
|------|---------|------|
| user | `role=user&conversationId=...&clientId=...&clientToken=...` | 用户端消息 |
| service | `role=service&accountId=...&serviceToken=...` | OpenClaw Plugin 端 |


## 6. 网络安全

### 6.1 CORS 配置

```javascript
const parseCorsOrigins = (envValue) => {
  if (!envValue || typeof envValue !== 'string') {
    return '*';
  }
  const origins = envValue.split(',').map(o => o.trim()).filter(Boolean);
  return origins.length > 0 ? origins : '*';
};

const CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGINS);
```

### 6.2 速率限制

> 完整限流配置见 [TRIX_NATIVE_CHANNEL.md](../TRIX_NATIVE_CHANNEL.md)（可配置限制，非固定 100 次）。

每端点独立限流（默认）：

### 6.3 消息去重

```javascript
const DEDUP_TTL_MS = 10000; // 10秒内不重复处理

function seenRecently(key) {
  if (dedupCache.has(key)) return true;
  dedupCache.set(key, Date.now() + DEDUP_TTL_MS);
  return false;
}
```

### 6.4 心跳机制

WebSocket 原生心跳（`ws` 库）：

---

## 7. 数据流

### 7.1 消息流程

```
1. 用户发送消息
      │
      ▼
2. WebSocket 接收
      │
      ▼
3. 验证消息 (去重 + 权限)
      │
      ├──▶ 4a. 存储到 SQLite
      │         │
      │         ▼
      │     5a. 存储到 Supabase
      │         │
      │         ▼
      │     6a. 广播给接收者
      │
      ▼
4b. 转发给配对的机器人
          │
          ▼
      5b. 转发到 OpenClaw Gateway
          │
          ▼
      6b. 接收 AI 响应
          │
          ▼
      7b. 返回响应给用户
```

### 7.2 配对流程

```
1. 用户扫描 QR 码 / 输入配对码
      │
      ▼
2. 发送配对请求
      │
      ▼
3. 服务器验证配对码
      │
      ├──▶ 验证成功 → 4a. 建立配对关系
      │                   │
      │                   ▼
      │               5a. WebSocket 长连接建立
      │                   │
      │                   ▼
      │               6a. 通知双方配对成功
      │
      ▼
4b. 验证失败 → 返回错误
```

---

## 8. 部署

### 8.1 PM2 配置 (TRIX Native Server)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'trix-native',
    script: './dist/server/TrixNativeServer.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 8788
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8788
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
```

### 8.2 启动命令

```bash
# 开发环境
cd packages/trix-openclaw-native
npm run cli -- server start --port 8788

# 生产环境 (PM2)
pm2 start ecosystem.config.js --env production

# 日志查看
pm2 logs trix-native

# 重启
pm2 restart trix-native

# 停止
pm2 stop trix-native
```

### 8.3 环境变量

```bash
# Server
PORT=8788
NODE_ENV=production

# TRIX Native
TRIX_NATIVE_ADMIN_TOKEN=your-admin-token
TRIX_NATIVE_PUBLIC_BASE_URL=https://trix.love
TRIX_NATIVE_STORAGE_DIR=./.trix-native-channel

# OpenClaw Gateway
GATEWAY_URL=ws://127.0.0.1:18789
GATEWAY_AUTH_TOKEN=your-auth-token

# OSS（可选）
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_BUCKET=xxx
ALIYUN_ENDPOINT=oss-cn-hangzhou.aliyuncs.com

# Edge TTS（已内置，无需额外配置）
```

---

## 9. 性能优化

### 9.1 WebSocket 心跳连接管理

- 自动保活（30s 重连）
- 连接池复用

### 9.2 消息处理

- 消息去重缓存 (10s TTL)
- 批量写入数据库
- 异步处理非关键逻辑

### 9.3 资源优化

- Gzip 压缩
- 静态资源缓存
- 数据库连接池

---

## 10. 监控与日志

### 10.1 日志输出

```javascript
console.log(`[CORS] Allowed origins: ${origins}`);
console.log(`[Pairing] Device ${deviceId} paired successfully`);
console.log(`[Message] New message from ${from} to ${to}`);
```

### 10.2 健康检查

```bash
# 检查服务状态
curl http://TRIX_SERVER_HOST:8788/health
```

---

## 11. 依赖清单

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.19.0",
    "qrcode": "^1.5.4",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "express-rate-limit": "^7.1.5",
    "dotenv": "^16.3.1",
    "ali-oss": "^6.20.0",
    "axios": "^1.6.2",
    "node-edge-tts": "^3.1.0"
  },
  "devDependencies": {
    "pm2": "^5.3.0"
  }
}
```

---

## 12. 安全措施

| 安全措施 | 实现 |
|---------|------|
| CORS 白名单 | 环境变量配置 |
| 速率限制 | express-rate-limit |
| 消息去重 | 内存缓存 (10s TTL) |
| SQL 参数化 | better-sqlite3 预处理 |
| Token 验证 | WebSocket 认证 |
| 配对码过期 | 1 小时有效期 |

---

## 13. 性能指标

| 指标 | 目标值 |
|-----|--------|
| WebSocket 并发 | 1000+ |
| 消息吞吐量 | 100 msg/s |
| 消息延迟 | < 100ms |
| API 响应 (p95) | < 500ms |

---

**最后更新**: 2026-03-21
**版本**: 3.2
