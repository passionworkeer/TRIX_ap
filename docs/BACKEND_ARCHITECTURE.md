# 后端架构文档

> 📚 TRIX 3D Companion 后端服务架构
> 🎯 基于 Node.js + Express + Socket.io

---

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                   Backend Architecture                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Browser   │    │    iOS      │    │   Android   │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │            │
│         └───────────────────┼───────────────────┘            │
│                             ▼                                │
│                    ┌──────────────┐                           │
│                    │  Express    │                           │
│                    │  + Socket.io│                           │
│                    └──────┬───────┘                           │
│                           │                                   │
│         ┌─────────────────┼─────────────────┐              │
│         ▼                 ▼                 ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Pairing     │  │  Message     │  │    OSS       │     │
│  │  Service    │  │  Service     │  │  Service     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           ▼                                  │
│                    ┌──────────────┐                          │
│                    │  PostgreSQL  │                          │
│                    │  (Supabase)  │                          │
│                    └──────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 目录结构

```
server/clawbot-channel/
├── server.js                # 主服务器入口
├── config/
│   └── database.js          # 数据库配置
├── services/
│   ├── pairingService.js    # 配对服务
│   ├── messageService.js    # 消息服务
│   ├── ossService.js        # 阿里云 OSS
│   ├── ttsService.js        # 语音合成
│   └── studyRoomService.js  # 学习室服务
├── tests/
│   └── *.test.js            # 测试文件
├── .env                     # 环境变量
├── package.json             # 依赖配置
└── ecosystem.config.js    # PM2 配置
```

---

## 🔌 核心功能

### 1. 配对服务 (`pairingService.js`)

```javascript
// 配对流程
class PairingService {
  // 生成配对码
  generatePairingCode() { ... }

  // 验证配对码
  validatePairingCode(code) { ... }

  // 建立配对
  establishPairing(deviceId, code) { ... }

  // 解除配对
  unpair(deviceId) { ... }

  // 获取配对状态
  getPairingStatus(deviceId) { ... }
}
```

### 2. 消息服务 (`messageService.js`)

```javascript
class MessageService {
  // 发送消息
  sendMessage(from, to, content) { ... }

  // 获取消息历史
  getMessageHistory(userId, friendId, limit) { ... }

  // 标记已读
  markAsRead(userId, friendId) { ... }

  // 删除消息
  deleteMessage(messageId) { ... }
}
```

### 3. OSS 服务 (`ossService.js`)

```javascript
class OSSService {
  // 上传文件
  async uploadFile(file, options) { ... }

  // 获取签名 URL
  async getSignedUrl(filePath) { ... }

  // 删除文件
  async deleteFile(filePath) { ... }

  // 列出文件
  async listFiles(prefix) { ... }
}
```

### 4. TTS 服务 (`ttsService.js`)

```javascript
class TTSService {
  // 合成语音
  async synthesize(text, options) { ... }

  // 获取语音文件
  async getAudio(text, voice) { ... }

  // 获取可用语音列表
  async getVoices() { ... }
}
```

### 5. 学习室服务 (`studyRoomService.js`)

```javascript
class StudyRoomService {
  // 创建学习室
  createRoom(name, capacity) { ... }

  // 加入学习室
  joinRoom(roomId, userId) { ... }

  // 离开学习室
  leaveRoom(roomId, userId) { ... }

  // 获取房间列表
  listRooms() { ... }

  // 房间成员管理
  manageMembers(roomId, action) { ... }
}
```

---

## 🌐 API 端点

### HTTP API

#### 认证
```
POST   /api/auth/register     # 注册
POST   /api/auth/login        # 登录
POST   /api/auth/logout      # 登出
GET    /api/auth/me          # 当前用户
```

#### 配对
```
POST   /api/pairing/generate  # 生成配对码
POST   /api/pairing/validate # 验证配对码
POST   /api/pairing/establish # 建立配对
POST   /api/pairing/unpair    # 解除配对
GET    /api/pairing/status    # 配对状态
```

#### 消息
```
GET    /api/messages/:friendId     # 获取消息历史
POST   /api/messages/send           # 发送消息
PUT    /api/messages/:id/read       # 标记已读
DELETE /api/messages/:id             # 删除消息
```

#### 文件
```
POST   /api/oss/upload         # 上传文件
GET    /api/oss/signed-url     # 获取签名 URL
DELETE /api/oss/:key            # 删除文件
```

#### TTS
```
POST   /api/tts/synthesize     # 语音合成
GET    /api/tts/voices         # 可用语音列表
```

#### 学习室
```
GET    /api/study-rooms        # 房间列表
POST   /api/study-rooms        # 创建房间
POST   /api/study-rooms/:id/join   # 加入房间
POST   /api/study-rooms/:id/leave   # 离开房间
```

### WebSocket 事件

#### 客户端 → 服务器
```
connect              # 连接
disconnect          # 断开
message             # 发送消息
typing              # 正在输入
pairing_request     # 配对请求
pairing_confirm     # 配对确认
study_room_join     # 加入学习室
study_room_leave    # 离开学习室
```

#### 服务器 → 客户端
```
connected           # 连接成功
message             # 新消息
typing              # 对方正在输入
pairing_update      # 配对状态更新
study_room_update   # 学习室更新
bot_response        # 机器人响应
error               # 错误通知
```

---

## 🔐 安全机制

### CORS 配置
```javascript
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  credentials: true
};
```

### 速率限制
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: 'Too many requests'
});
```

### 消息去重
```javascript
const DEDUP_TTL_MS = 10000; // 10秒内不重复处理

function seenRecently(key) {
  if (dedupCache.has(key)) return true;
  dedupCache.set(key, Date.now() + DEDUP_TTL_MS);
  return false;
}
```

---

## 📊 数据流

### 消息流程
```
1. 用户发送消息
      │
      ▼
2. WebSocket 接收
      │
      ▼
3. 验证消息 (去重 + 权限)
      │
      ├──▶ 4a. 存储到数据库
      │         │
      │         ▼
      │     5a. 广播给接收者
      │
      ▼
4b. 转发给配对的机器人
          │
          ▼
      5b. 机器人响应
          │
          ▼
      6. 返回响应给用户
```

### 配对流程
```
1. 用户扫描 QR 码 / 输入 Token
      │
      ▼
2. 发送配对请求
      │
      ▼
3. 服务器验证
      │
      ├──▶ 验证成功 → 4a. 建立 WebSocket 连接
      │                   │
      │                   ▼
      │               5a. 通知双方配对成功
      │
      ▼
4b. 验证失败 → 返回错误
```

---

## 🧪 测试

### API 测试
```javascript
describe('API Tests', () => {
  it('should authenticate user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });
    expect(response.status).toBe(200);
  });
});
```

### WebSocket 测试
```javascript
it('should handle messages', (done) => {
  const socket = io.connect(serverUrl);
  socket.on('message', (msg) => {
    expect(msg.content).toBe('Hello');
    done();
  });
  socket.emit('message', { content: 'Hello' });
});
```

---

## 🚀 部署

### PM2 配置
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'clawbot-channel',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 启动命令
```bash
# 开发环境
npm start

# 生产环境 (PM2)
pm2 start ecosystem.config.js --env production

# 日志查看
pm2 logs clawbot-channel

# 重启
pm2 restart clawbot-channel
```

---

## 📈 性能优化

### 连接管理
- WebSocket 心跳保活 (30s)
- 自动重连
- 连接池复用

### 消息处理
- 消息去重缓存 (10s TTL)
- 批量写入数据库
- 异步处理非关键逻辑

### 资源优化
- Gzip 压缩
- 静态资源缓存
- 数据库连接池

---

**最后更新**: 2026-03-01
**版本**: 2.0
