# Clawbot Channel 集成指南

> **最后更新**: 2026-02-17
> **状态**: ✅ 生产环境使用
> **目标**: 通过 Clawbot Channel 实现 App 与本地 OpenClaw 的实时通信

---

## 📋 目录

1. [架构概述](#架构概述)
2. [快速开始](#快速开始)
3. [扫码配对流程](#扫码配对流程)
4. [服务器部署](#服务器部署)
5. [Clawbot 端集成](#clawbot-端集成)
6. [App 端集成](#app-端集成)
7. [API 参考](#api-参考)
8. [故障排查](#故障排查)

---

## 架构概述

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│  [App] m.jmtrick.com (localhost:5173)            │
│  React + Vite + TypeScript + Socket.io-client              │
│  - Supabase Auth (user.id)                                │
│  - 连接到 wss://TRIX_SERVER_HOST:8765                         │
└────────────────┬────────────────────────────────────────────┘
                 │ WebSocket (Socket.io)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  [服务器 TRIX_SERVER_HOST:8765]                                │
│  Node.js + Express + Socket.io + SQLite                    │
│  - 配对管理 (pairings 表)                                   │
│  - 消息转发 (messages 表)                                   │
│  - App Room (user_{userId})                                 │
│  - Clawbot Socket 存储 (Map: deviceId → socket)            │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTP Webhook + WebSocket Client
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  [Clawbot] 本地 OpenClaw                                    │
│  运行 Custom Channel 插件                                   │
│  - 显示配对码/二维码                                          │
│  - 接收服务器转发的 App 消息 → AI处理 → 回复服务器           │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

```
Frontend:  React 19.2.4 + TypeScript 5.8.2
Build:     Vite 6.2.0
Database:  Supabase (PostgreSQL)
Realtime:  Supabase Realtime + Socket.io
Server:   Node.js + Express + Socket.io + SQLite
```

---

## 快速开始

### 核心概念

**TRIX 3D Companion** 通过扫码方式接入 Clawbot Channel：

```
配对流程 (扫码配对)
─────────────────
1. 电脑端 Clawbot 启动 → 请求配对码
2. 服务器生成 6 位配对码 + 二维码
3. 手机 App 扫描二维码 / 输入配对码
4. 服务器建立配对关系
5. App ↔ 服务器 ↔ Clawbot 三端连通
```

### 5 分钟快速配置

#### 1. 配置服务器环境

```bash
# SSH 连接到服务器
ssh root@TRIX_SERVER_HOST

# 进入项目目录
cd /opt/clawbot-channel

# 复制环境变量配置
cp .env.example .env

# 编辑配置（根据实际情况修改）
nano .env
```

`.env` 配置示例：
```bash
PORT=8765
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=trix-companion
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
```

#### 2. 启动服务器

```bash
# 安装依赖
npm install

# 使用 PM2 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status
pm2 logs clawbot-channel
```

#### 3. Clawbot 端配置

使用 Socket.io 客户端连接到服务器：

```javascript
const io = require('socket.io-client');

const socket = io('ws://TRIX_SERVER_HOST:8765', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

// 请求配对
socket.emit('bot_request_pairing', {
  deviceId: 'clawbot-local-001'
});

// 监听配对信息
socket.on('pairing_info', (data) => {
  console.log('配对码:', data.pairingCode);
  console.log('二维码:', data.qrImage);
});

// 监听用户配对成功
socket.on('user_paired', (data) => {
  console.log('用户已配对:', data.userId);
});

// 接收 App 消息
socket.on('bot_message', (data) => {
  console.log('收到消息:', data.content);
  // 处理消息...
});
```

#### 4. App 端配置

```typescript
import { io } from 'socket.io-client';

const socket = io('wss://TRIX_SERVER_HOST:8765', {
  transports: ['websocket', 'polling']
});

// 使用配对码配对
socket.emit('pair_with_code', {
  code: 'X9N3MH',
  userId: user.id  // Supabase user.id
});

// 监听配对成功
socket.on('pairing_success', (data) => {
  console.log('配对成功！');
});

// 发送消息
socket.emit('send_message', {
  content: '你好 ClAWbot',
  contentType: 'text'
});
```

---

## 扫码配对流程

### 流程详解

```
┌──────────────────┐                           ┌──────────────────┐
│  本地 Clawbot    │                           │    手机 App      │
└────────┬─────────┘                           └────────┬─────────┘
         │                                               │
         │ 1. 连接服务器，请求配对                          │
         ├──────────────────────────────────────────────>│
         │                                               │
         │ 2. 返回配对码 + 二维码                           │
         │<──────────────────────────────────────────────┤
         │                                               │
         │ 3. 显示配对码: X9N3MH                          │
         │    显示二维码供扫描                             │
         │                                               │
         │                     4. App 扫码/输入配对码      │
         │<──────────────────────────────────────────────┤
         │                                               │
         │ 5. 验证配对码，建立配对关系                      │
         ├──────────────────────────────────────────────>│
         │                                               │
         │ 6. 通知 Clawbot 配对成功                        │
         │<──────────────────────────────────────────────┤
         │                                               │
         │ 7. 三端连通，可以开始通信                         │
         │<────────────────�─────────────────────────────>│
```

### 配对字段规范

App 扫码或输入配对码后，需要提供以下信息：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `code` | string | 6 位配对码 | `X9N3MH` |
| `userId` | string | Supabase 用户 ID | `bd49b054-...` |
| `deviceName` | string | 设备名称（可选） | `iPhone 13` |

---

## 服务器部署

### 部署位置

- **目录**: `/opt/clawbot-channel/`
- **用户**: root
- **进程管理**: PM2

### 文件结构

```
/opt/clawbot-channel/
├── server.js                  # 主服务器入口
├── package.json              # 依赖配置
├── ecosystem.config.js      # PM2 配置
├── .env                      # 环境变量
├── config/
│   └── database.js         # SQLite 配置
└── services/
    ├── pairingService.js   # 配对管理
    ├── messageService.js   # 消息存储
    └── ossService.js      # 阿里云 OSS
```

### PM2 配置

```javascript
module.exports = {
  apps: [{
    name: 'clawbot-channel',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8765
    }
  }]
};
```

### 常用命令

```bash
# 启动服务
pm2 start ecosystem.config.js

# 停止服务
pm2 stop clawbot-channel

# 重启服务
pm2 restart clawbot-channel

# 查看日志
pm2 logs clawbot-channel

# 查看状态
pm2 status

# 开机自启
pm2 startup
pm2 save
```

---

## Clawbot 端集成

### 核心功能实现

#### 1. 连接服务器

```javascript
const io = require('socket.io-client');

const socket = io('ws://TRIX_SERVER_HOST:8765', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('✅ 已连接到服务器');

  // 连接成功后立即请求配对
  socket.emit('bot_request_pairing', {
    deviceId: 'clawbot-local-' + Date.now()
  });
});
```

#### 2. 显示配对码和二维码

```javascript
socket.on('pairing_info', (data) => {
  const { pairingId, pairingCode, qrImage, expiresIn } = data;

  console.log('═══════════════════════════════════════');
  console.log('📱 配对码:', pairingCode);
  console.log('⏰ 有效期:', expiresIn, '秒');
  console.log('═══════════════════════════════════════');

  // 保存二维码图片
  const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
  require('fs').writeFileSync('pairing-qr.png', base64Data, 'base64');
  console.log('✅ 二维码已保存: pairing-qr.png');

  // 保存配对信息
  require('fs').writeFileSync('pairing-info.json', JSON.stringify(data, null, 2));
});
```

#### 3. 处理用户配对

```javascript
socket.on('user_paired', (data) => {
  const { pairingId, userId } = data;

  console.log('═══════════════════════════════════════');
  console.log('✅ 用户已配对！');
  console.log('📋 配对 ID:', pairingId);
  console.log('👤 用户 ID:', userId);
  console.log('═══════════════════════════════════════');

  // 更新状态
  state.isPaired = true;
  state.userId = userId;
  state.pairingId = pairingId;
});
```

#### 4. 接收和处理消息

```javascript
socket.on('bot_message', async (data) => {
  const { content, contentType, mediaUrl, timestamp } = data;

  console.log('📨 收到消息:', content);

  // TODO: 调用 AI 模型生成回复
  const reply = await generateAIReply(content);

  // 发送回复
  socket.emit('bot_message', {
    deviceId: state.deviceId,
    content: reply,
    contentType: 'text'
  });
});
```

#### 5. 心跳机制

```javascript
// 每 30 秒发送心跳
setInterval(() => {
  if (socket.connected) {
    socket.emit('ping', { timestamp: Date.now() });
    console.log('💓 心跳 ping');
  }
}, 30000);

// 监听心跳响应
socket.on('pong', (data) => {
  console.log('💓 心跳 pong:', data.timestamp);
});
```

#### 6. 自动重连

```javascript
socket.on('reconnect_attempt', (attempt) => {
  console.log(`🔄 尝试重连 (${attempt}/10)...`);
});

socket.on('reconnect', () => {
  console.log('✅ 重连成功！');

  // 重连后重新请求配对恢复
  if (state.pairingId) {
    socket.emit('bot_request_pairing', {
      deviceId: state.deviceId
    });
  }
});

socket.on('pairing_restored', (data) => {
  console.log('✅ 配对已恢复！');
  state.isPaired = true;
});
```

---

## App 端集成

### 使用配对码配对

```typescript
import { supabase } from '../config/supabase';
import { io } from 'socket.io-client';

class ClawbotChannelBridge {
  private socket: any;
  private userId: string | null = null;

  async connect() {
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    this.userId = user?.id || null;

    // 连接到服务器
    this.socket = io('wss://TRIX_SERVER_HOST:8765', {
      transports: ['websocket', 'polling']
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('✅ 已连接到服务器');
    });

    this.socket.on('pairing_success', (data) => {
      console.log('✅ 配对成功！');
      // 保存配对信息
      localStorage.setItem('clawbot_paired', 'true');
    });

    this.socket.on('bot_message', (data) => {
      console.log('收到 Clawbot 消息:', data.content);
      // 显示消息...
    });
  }

  // 使用配对码配对
  pairWithCode(code: string) {
    if (!this.userId) {
      throw new Error('用户未登录');
    }

    this.socket.emit('pair_with_code', {
      code: code.toUpperCase(),
      userId: this.userId
    });
  }

  // 发送消息
  sendMessage(content: string, contentType: string = 'text') {
    this.socket.emit('send_message', {
      content,
      contentType,
      timestamp: Date.now()
    });
  }
}
```

---

## API 参考

### 事件列表

#### Clawbot → 服务器

| 事件 | 数据 | 说明 |
|------|------|------|
| `bot_request_pairing` | `{ deviceId }` | 请求生成配对码 |
| `bot_message` | `{ deviceId, content, contentType }` | 发送消息给 App |
| `ping` | `{ timestamp }` | 心跳检测 |

#### 服务器 → Clawbot

| 事件 | 数据 | 说明 |
|------|------|------|
| `pairing_info` | `{ pairingId, pairingCode, qrImage, expiresIn }` | 配对信息 |
| `user_paired` | `{ pairingId, userId }` | 用户配对成功 |
| `pairing_restored` | `{ pairingId, deviceId }` | 重连后恢复配对 |
| `bot_message` | `{ content, contentType, mediaUrl }` | 收到 App 消息 |
| `message_sent` | `{ success, messageId }` | 消息发送确认 |
| `pong` | `{ timestamp }` | 心跳响应 |
| `error` | `{ message, hint }` | 错误信息 |

#### App → 服务器

| 事件 | 数据 | 说明 |
|------|------|------|
| `pair_with_code` | `{ code, userId }` | 使用配对码配对 |
| `send_message` | `{ content, contentType, mediaUrl }` | 发送消息 |

#### 服务器 → App

| 事件 | 数据 | 说明 |
|------|------|------|
| `pairing_success` | `{ pairingId }` | 配对成功 |
| `bot_message` | `{ content, contentType }` | 收到 Clawbot 消息 |
| `error` | `{ message }` | 错误信息 |

---

## 故障排查

### 常见问题

#### 1. Clawbot 无法连接服务器

**检查清单**:
```bash
# 检查服务器状态
ssh root@TRIX_SERVER_HOST "pm2 status"

# 检查端口监听
ssh root@TRIX_SERVER_HOST "netstat -tuln | grep 8765"

# 查看服务器日志
ssh root@TRIX_SERVER_HOST "pm2 logs clawbot-channel --lines 50"
```

#### 2. 配对码过期

**原因**: 配对码默认有效期为 10 分钟

**解决**: 重新请求配对码

#### 3. 消息发送失败

**检查**:
- Clawbot 是否在线
- App 是否已配对
- 网络连接是否正常

#### 4. 心跳超时

**现象**: 长时间无消息后连接断开

**解决**: 实现心跳机制（每 30 秒发送 ping）

---

## 总结

### 实现状态

| 组件 | 状态 | 说明 |
|------|------|------|
| 服务器端 | ✅ 完成 | Node.js + Socket.io + SQLite |
| Clawbot 端 | ✅ 完成 | Socket.io 客户端 + Custom Channel |
| App 端 | ✅ 完成 | Socket.io-client + Supabase Auth |

### 核心功能

- ✅ 扫码配对 / 配对码配对
- ✅ 实时消息收发
- ✅ 心跳保活
- ✅ 自动重连
- ✅ 消息确认
- ✅ 错误处理

---

**相关文档**:
- [三端接通架构文档.md](../三端接通架构文档.md)
- [OpenClaw最佳接入方案-MVP.md](../OpenClaw最佳接入方案-MVP.md)
