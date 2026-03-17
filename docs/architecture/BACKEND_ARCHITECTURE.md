# 后端架构文档

> 📚 TRIX 3D Companion 后端服务架构
> 🎯 基于 Node.js + Express + Socket.io
> **最后更新**: 2026-03-17

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
│                    │   + Socket.io │                              │
│                    └──────┬───────┘                              │
│                           │                                       │
│         ┌─────────────────┼─────────────────┐                     │
│         ▼                 ▼                 ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pairing    │  │   Message    │  │     TTS      │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │                    │
│         └─────────────────┼─────────────────┘                    │
│                           ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Data Layer                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │   SQLite     │  │  Supabase    │  │   Aliyun     │      │   │
│  │  │  (Local)     │  │ (PostgreSQL) │  │     OSS      │      │   │
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
| POST | /api/pairings | 生成配对码 |
| GET | /api/pairings/:code | 查询配对状态 |
| POST | /api/pairings/:code/claim | 确认配对 |
| POST | /api/auth | 认证 |
| POST | /api/messages/from-plugin | 发送消息 |
| GET | /api/messages/to-plugin | 拉取消息 |
| POST | /api/upload | 文件上传 |

### WebSocket 端点

| 路径 | 描述 |
|------|------|
| /ws/phone?code=XXX | iOS 连接，实时接收消息 |
| /ws/plugin?token=XXX | OpenClaw Plugin 连接 |

---

## 2. 技术栈

| 类别 | 技术 | 版本 |
|-----|------|-----|
| 运行时 | Node.js | 18+ |
| 框架 | Express | 4.18+ |
| WebSocket | Socket.IO | 4.7+ |
| 数据库 | SQLite | 3.x |
| 远程数据库 | Supabase | - |
| 文件存储 | 阿里云 OSS | - |
| 语音合成 | 豆包 TTS API | - |
| 部署 | PM2 | - |

---

## 3. 目录结构

```
packages/trix-openclaw-native/          # TRIX Native Channel 插件
├── src/
│   ├── plugin/                         # OpenClaw 插件接口
│   │   ├── plugin.ts                   # 插件主入口
│   │   ├── accounts.ts                 # 账号管理
│   │   ├── inbound.ts                  # 消息入站
│   │   └── outbound.ts                 # 消息出站
│   ├── server/                        # TRIX Native Server
│   │   ├── TrixNativeServer.ts        # 服务器主入口
│   │   ├── routes/                    # API 路由
│   │   └── websocket/                 # WebSocket 处理
│   ├── pairing/                       # 配对服务
│   │   └── PairingService.ts
│   ├── storage/                       # 存储服务
│   │   └── JsonStateStore.ts          # JSON 状态存储
│   └── types.ts                       # 类型定义
├── cli.ts                             # CLI 入口
├── package.json                       # 依赖配置
└── README.md
```

> **注意**: 旧版 `server/clawbot-channel/` 已废弃，相关功能已迁移到 `packages/trix-openclaw-native/`

---

## 4. 核心服务

### 4.1 配对服务 (pairingService.js)

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

### 4.2 消息服务 (messageService.js)

**功能**: 处理用户消息的存储和转发。

```javascript
class MessageService {
  // 发送消息
  sendMessage(from, to, content, type)

  // 获取消息历史
  getMessageHistory(userId, friendId, limit, offset)

  // 标记已读
  markAsRead(userId, friendId)

  // 删除消息
  deleteMessage(messageId)

  // 获取未读数
  getUnreadCount(userId, friendId)
}
```

**数据库表**:
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

---

### 4.3 TTS 服务 (ttsService.js)

**功能**: 调用豆包 TTS API 生成语音。

```javascript
class TTSService {
  // 合成语音
  async synthesize(text, voice, speed)

  // 获取可用语音列表
  async getVoices()
}
```

**支持的语音**:
- `alex`: 青年女声
- `jenny`: 温柔女声
- `guy`: 成熟男声
- `lucas`: 活力男声

---

### 4.4 OSS 服务 (ossService.js)

**功能**: 阿里云 OSS 文件上传和管理。

```javascript
class OSSService {
  // 上传文件
  async uploadFile(file, options)

  // 获取签名 URL
  async getSignedUrl(filePath, expires)

  // 删除文件
  async deleteFile(filePath)
}
```

---

### 4.5 学习室服务 (studyRoomService.js)

**功能**: 管理学习室和成员。

```javascript
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

### 5.1 HTTP API

#### 认证
| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 当前用户 |

#### 配对
| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /api/pairing/generate | 生成配对码 |
| POST | /api/pairing/validate | 验证配对码 |
| POST | /api/pairing/establish | 建立配对 |
| POST | /api/pairing/unpair | 解除配对 |
| GET | /api/pairing/status | 配对状态 |

#### 消息
| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /api/messages/:friendId | 获取消息历史 |
| POST | /api/messages/send | 发送消息 |
| PUT | /api/messages/:id/read | 标记已读 |
| DELETE | /api/messages/:id | 删除消息 |
| GET | /api/messages/sync | 同步消息 |

#### 文件
| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /api/oss/upload | 上传文件 |
| GET | /api/oss/signed-url | 获取签名 URL |
| DELETE | /api/oss/:key | 删除文件 |

#### TTS
| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /api/tts/synthesize | 语音合成 |
| GET | /api/tts/voices | 可用语音列表 |

#### 学习室
| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /api/study-rooms | 房间列表 |
| POST | /api/study-rooms | 创建房间 |
| POST | /api/study-rooms/:id/join | 加入房间 |
| POST | /api/study-rooms/:id/leave | 离开房间 |

---

### 5.2 WebSocket 事件

#### 客户端 → 服务器
| 事件 | 描述 |
|------|------|
| `connect` | 连接 |
| `disconnect` | 断开 |
| `message` | 发送消息 |
| `typing` | 正在输入 |
| `pairing_request` | 配对请求 |
| `pairing_confirm` | 配对确认 |
| `study_room_join` | 加入学习室 |
| `study_room_leave` | 离开学习室 |

#### 服务器 → 客户端
| 事件 | 描述 |
|------|------|
| `connected` | 连接成功 |
| `message` | 新消息 |
| `typing` | 对方正在输入 |
| `pairing_update` | 配对状态更新 |
| `study_room_update` | 学习室更新 |
| `bot_response` | 机器人响应 |
| `error` | 错误通知 |

---

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

```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: 'Too many requests'
});
```

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

```javascript
const io = new Server(server, {
  pingInterval: 30000,      // 30秒心跳间隔
  pingTimeout: 60000,       // 60秒超时
  upgradeTimeout: 30000      // 30秒升级超时
});
```

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
TRIX_NATIVE_PUBLIC_BASE_URL=http://TRIX_SERVER_HOST:8788
TRIX_NATIVE_STORAGE_DIR=./.trix-native-channel

# OpenClaw Gateway
GATEWAY_URL=ws://127.0.0.1:18789
GATEWAY_AUTH_TOKEN=your-auth-token
```

# Aliyun OSS
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_BUCKET=xxx
ALIYUN_ENDPOINT=oss-cn-hangzhou.aliyuncs.com

# TTS_API_KEY=OUBAO_Txxx
DOUTS
DBAO_TTS_APP_ID=xxx
```

---

## 9. 性能优化

### 9.1 WebSocket 心跳 连接管理

-s)
- 自动保活 (30重连
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
    "socket.io": "^4.7.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "express-rate-limit": "^7.1.5",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1",
    "ali-oss": "^6.20.0",
    "axios": "^1.6.2"
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
| 配对码过期 | 30 分钟有效期 |

---

## 13. 性能指标

| 指标 | 目标值 |
|-----|--------|
| WebSocket 并发 | 1000+ |
| 消息吞吐量 | 100 msg/s |
| 消息延迟 | < 100ms |
| API 响应 (p95) | < 500ms |

---

**最后更新**: 2026-03-17
**版本**: 3.1
