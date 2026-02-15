好的，信息够了。以下是完整的三端开发文档：

---

# Clawdbot Custom Channel - 完整开发文档

## 一、架构最终确认

```
┌─────────────────────────────────────────────────────────────────┐
│  [Web App] m.jmtrick.com                                         │
│  React + Vite + TypeScript                                       │
│  - 用户登录 (Supabase Auth) → 获取 user.id                       │
│  - 配对页面显示二维码/配对码                                      │
│  - WebSocket 连接 wss://m.jmtrick.com                            │
└────────────────┬────────────────────────────────────────────────┘
                 │ WebSocket (Socket.io)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [服务器 TRIX_SERVER_HOST:8765]                                     │
│  Ubuntu + Node.js + Socket.io + SQLite                           │
│                                                                  │
│  - 接收 App WebSocket 连接 (Socket.io Room: user_${userId})      │
│  - 接收 Clawbot HTTP Webhook 回调                                │
│  - 消息转发：App Room → Clawbot Webhook                          │
│  - 配对管理：生成配对码/Token，验证，绑定 userId ↔ deviceId        │
│  - 数据库：SQLite (WAL模式) 存配对关系                            │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP Webhook + WebSocket Client
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  [MacBook] Clawdbot                                              │
│  运行 Custom Channel 插件                                        │
│                                                                  │
│  - 启动时连接服务器 WebSocket (作为 Client)                       │
│  - 显示配对二维码/配对码                                          │
│  - 接收服务器转发的 App 消息 → AI处理 → 回复服务器                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、服务器端开发

### 2.1 目录结构

```
/opt/clawbot-channel/
├── server.js
├── package.json
├── .env
├── ecosystem.config.js          # PM2 配置
├── config/
│   └── database.js
├── services/
│   ├── pairingService.js
│   ├── messageService.js
│   └── ossService.js
└── middleware/
    └── auth.js
```

### 2.2 package.json

```json
{
  "name": "clawbot-channel-server",
  "version": "1.0.0",
  "description": "Clawdbot Custom Channel Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop ecosystem.config.js",
    "pm2:restart": "pm2 restart ecosystem.config.js",
    "pm2:logs": "pm2 logs clawbot-channel"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "cors": "^2.8.5",
    "sqlite3": "^5.1.6",
    "uuid": "^9.0.0",
    "qrcode": "^1.5.3",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 2.3 .env 配置文件

```env
# 服务器配置
NODE_ENV=production
PORT=8765
HOST=0.0.0.0

# 数据库
DATABASE_PATH=./data/pairing.db

# 配对配置
PAIRING_CODE_EXPIRY=300000      # 配对码有效期 5分钟
PAIRING_TOKEN_EXPIRY=600000     # 配对Token有效期 10分钟

# Clawbot Webhook 密钥（用于验证回调）
CLAWBOT_WEBHOOK_SECRET=your-webhook-secret-here

# 阿里云 OSS（App上传文件后，服务器生成预签名URL给Clawbot下载）
OSS_REGION=oss-cn-hangzhou
OSS_BUCKET=your-bucket-name
OSS_ACCESS_KEY_ID=your-access-key
OSS_ACCESS_KEY_SECRET=your-access-secret
```

### 2.4 config/database.js

```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './data/pairing.db';

// 确保目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite database');
    // 开启 WAL 模式提升并发性能
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA synchronous = NORMAL;');
  }
});

// 初始化表
function initDatabase() {
  db.serialize(() => {
    // 配对关系表
    db.run(`
      CREATE TABLE IF NOT EXISTS pairings (
        id TEXT PRIMARY KEY,
        pairing_code TEXT UNIQUE,
        pairing_token TEXT UNIQUE,
        user_id TEXT NOT NULL,
        device_id TEXT,
        device_name TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        paired_at DATETIME,
        expires_at DATETIME,
        socket_id TEXT
      )
    `);

    // 消息表（临时缓存，定期清理）
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        pairing_id TEXT NOT NULL,
        direction TEXT NOT NULL, -- 'app_to_bot' 或 'bot_to_app'
        content TEXT,
        content_type TEXT DEFAULT 'text',
        media_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered BOOLEAN DEFAULT 0
      )
    `);

    // 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairings(pairing_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_id ON pairings(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_device_id ON pairings(device_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_status ON pairings(status)');
  });
}

// 工具函数：Promise 包装
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  dbRun,
  dbGet,
  dbAll
};
```

### 2.5 services/pairingService.js

```javascript
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { dbRun, dbGet } = require('../config/database');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
const CODE_LENGTH = 6;

class PairingService {
  // 生成配对码
  generatePairingCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  // 创建新的配对请求
  async createPairing(userId, deviceName = 'Mobile App') {
    const id = uuidv4();
    const pairingCode = this.generatePairingCode();
    const pairingToken = uuidv4();
    const expiryMs = parseInt(process.env.PAIRING_TOKEN_EXPIRY) || 600000;
    const expiresAt = new Date(Date.now() + expiryMs).toISOString();

    await dbRun(`
      INSERT INTO pairings (id, pairing_code, pairing_token, user_id, device_name, status, expires_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [id, pairingCode, pairingToken, userId, deviceName, expiresAt]);

    return {
      id,
      pairingCode,
      pairingToken,
      expiresAt
    };
  }

  // 生成二维码数据
  async generateQRCodeData(pairingToken) {
    const qrData = JSON.stringify({
      type: 'clawbot_pairing',
      version: '1.0',
      server: 'm.jmtrick.com',
      token: pairingToken,
      timestamp: Date.now()
    });

    // 生成二维码图片（Data URL）
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return { qrData, qrImage };
  }

  // 验证配对码
  async verifyPairingCode(code) {
    const pairing = await dbGet(`
      SELECT * FROM pairings 
      WHERE pairing_code = ? AND status = 'pending' AND expires_at > datetime('now')
    `, [code]);

    if (!pairing) {
      return { success: false, error: 'Invalid or expired pairing code' };
    }

    return { success: true, pairing };
  }

  // 验证配对Token（二维码）
  async verifyPairingToken(token) {
    const pairing = await dbGet(`
      SELECT * FROM pairings 
      WHERE pairing_token = ? AND status = 'pending' AND expires_at > datetime('now')
    `, [token]);

    if (!pairing) {
      return { success: false, error: 'Invalid or expired pairing token' };
    }

    return { success: true, pairing };
  }

  // 完成配对（Clawbot连接后调用）
  async completePairing(pairingId, deviceId, socketId) {
    await dbRun(`
      UPDATE pairings 
      SET status = 'paired', device_id = ?, socket_id = ?, paired_at = datetime('now')
      WHERE id = ?
    `, [deviceId, socketId, pairingId]);

    // 使 Token 失效（一次性）
    await dbRun(`
      UPDATE pairings SET pairing_token = NULL WHERE id = ?
    `, [pairingId]);

    return await dbGet('SELECT * FROM pairings WHERE id = ?', [pairingId]);
  }

  // 通过 deviceId 获取配对信息
  async getPairingByDeviceId(deviceId) {
    return await dbGet(`
      SELECT * FROM pairings 
      WHERE device_id = ? AND status = 'paired'
    `, [deviceId]);
  }

  // 通过 userId 获取配对信息
  async getPairingByUserId(userId) {
    return await dbGet(`
      SELECT * FROM pairings 
      WHERE user_id = ? AND status = 'paired'
    `, [userId]);
  }

  // 解绑
  async unpair(pairingId) {
    await dbRun(`
      UPDATE pairings SET status = 'unpaired', socket_id = NULL WHERE id = ?
    `, [pairingId]);
  }

  // 清理过期配对
  async cleanupExpired() {
    await dbRun(`
      DELETE FROM pairings 
      WHERE status = 'pending' AND expires_at < datetime('now')
    `);
  }
}

module.exports = new PairingService();
```

### 2.6 services/messageService.js

```javascript
const { dbRun, dbGet, dbAll } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class MessageService {
  // 保存消息
  async saveMessage(pairingId, direction, content, contentType = 'text', mediaUrl = null) {
    const id = uuidv4();
    await dbRun(`
      INSERT INTO messages (id, pairing_id, direction, content, content_type, media_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, pairingId, direction, content, contentType, mediaUrl]);
    return id;
  }

  // 标记消息已送达
  async markDelivered(messageId) {
    await dbRun('UPDATE messages SET delivered = 1 WHERE id = ?', [messageId]);
  }

  // 获取未送达消息
  async getUndeliveredMessages(pairingId, direction) {
    return await dbAll(`
      SELECT * FROM messages 
      WHERE pairing_id = ? AND direction = ? AND delivered = 0
      ORDER BY created_at ASC
    `, [pairingId, direction]);
  }

  // 清理旧消息（保留最近7天）
  async cleanupOldMessages() {
    await dbRun(`
      DELETE FROM messages 
      WHERE created_at < datetime('now', '-7 days')
    `);
  }
}

module.exports = new MessageService();
```

### 2.7 services/ossService.js

```javascript
const OSS = require('ali-oss');

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

class OSSService {
  // 生成预签名URL（供Clawbot下载）
  async getSignedUrl(objectKey, expires = 3600) {
    const url = client.signatureUrl(objectKey, {
      expires: expires,
      method: 'GET'
    });
    return url;
  }

  // 验证URL是否有效
  async validateObjectExists(objectKey) {
    try {
      await client.head(objectKey);
      return true;
    } catch (err) {
      return false;
    }
  }
}

module.exports = new OSSService();
```

### 2.8 server.js（主入口）

```javascript
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { initDatabase } = require('./config/database');
const pairingService = require('./services/pairingService');
const messageService = require('./services/messageService');
const ossService = require('./services/ossService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // 生产环境建议限制为 m.jmtrick.com
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// 存储 Clawbot socket 连接
const botSockets = new Map(); // deviceId -> socket

// 中间件
app.use(cors());
app.use(express.json());

// 初始化数据库
initDatabase();

// ===== HTTP API =====

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Clawbot Webhook回调（接收AI回复）
app.post('/webhook/clawbot', async (req, res) => {
  const { deviceId, content, contentType, mediaUrl } = req.body;
  
  // 验证密钥
  const authHeader = req.headers['x-webhook-secret'];
  if (authHeader !== process.env.CLAWBOT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const pairing = await pairingService.getPairingByDeviceId(deviceId);
  if (!pairing) {
    return res.status(404).json({ error: 'Pairing not found' });
  }

  // 保存消息
  await messageService.saveMessage(pairing.id, 'bot_to_app', content, contentType, mediaUrl);

  // 转发到 App（通过 Socket.io Room）
  io.to(`user_${pairing.user_id}`).emit('bot_message', {
    content,
    contentType,
    mediaUrl,
    timestamp: Date.now()
  });

  res.json({ success: true });
});

// 获取预签名URL（供Clawbot下载文件）
app.get('/oss/signed-url', async (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing key' });
  }

  try {
    const url = await ossService.getSignedUrl(key);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Socket.io =====

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // App 注册（配对前）
  socket.on('app_register', async (data) => {
    const { userId } = data;
    socket.userId = userId;
    socket.join(`user_${userId}`);
    console.log(`App registered: user_${userId}`);
  });

  // 请求配对（生成配对码/二维码）
  socket.on('request_pairing', async (data, callback) => {
    try {
      const { userId, deviceName } = data;
      const pairing = await pairingService.createPairing(userId, deviceName);
      const { qrData, qrImage } = await pairingService.generateQRCodeData(pairing.pairingToken);
      
      callback({
        success: true,
        pairingCode: pairing.pairingCode,
        qrImage,
        expiresIn: parseInt(process.env.PAIRING_TOKEN_EXPIRY) / 1000
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // 通过配对码配对
  socket.on('pair_with_code', async (data, callback) => {
    try {
      const { code } = data;
      const result = await pairingService.verifyPairingCode(code);
      
      if (!result.success) {
        return callback(result);
      }

      // 等待 Clawbot 连接完成配对
      callback({
        success: true,
        pairingId: result.pairing.id,
        status: 'waiting_for_bot'
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // 通过二维码Token配对
  socket.on('pair_with_token', async (data, callback) => {
    try {
      const { token } = data;
      const result = await pairingService.verifyPairingToken(token);
      
      if (!result.success) {
        return callback(result);
      }

      callback({
        success: true,
        pairingId: result.pairing.id,
        status: 'waiting_for_bot'
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // Clawbot 连接（配对完成后）
  socket.on('bot_connect', async (data, callback) => {
    try {
      const { deviceId, pairingId } = data;
      
      // 完成配对
      const pairing = await pairingService.completePairing(pairingId, deviceId, socket.id);
      
      // 存储连接
      botSockets.set(deviceId, socket);
      socket.deviceId = deviceId;
      socket.isBot = true;

      // 通知 App 配对成功
      io.to(`user_${pairing.user_id}`).emit('pairing_success', {
        deviceId,
        deviceName: pairing.device_name
      });

      console.log(`Bot connected: ${deviceId} for user ${pairing.user_id}`);
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // App 发送消息
  socket.on('app_message', async (data) => {
    try {
      const { content, contentType, mediaUrl } = data;
      const userId = socket.userId;
      
      const pairing = await pairingService.getPairingByUserId(userId);
      if (!pairing || !pairing.device_id) {
        socket.emit('error', { message: 'Not paired with any bot' });
        return;
      }

      // 保存消息
      await messageService.saveMessage(pairing.id, 'app_to_bot', content, contentType, mediaUrl);

      // 转发给 Clawbot（通过 Webhook）
      const botSocket = botSockets.get(pairing.device_id);
      if (botSocket) {
        botSocket.emit('app_message', {
          userId,
          content,
          contentType,
          mediaUrl
        });
      } else {
        socket.emit('error', { message: 'Bot is offline' });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // 应用层心跳
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // 解绑
  socket.on('unpair', async () => {
    if (socket.userId) {
      const pairing = await pairingService.getPairingByUserId(socket.userId);
      if (pairing) {
        await pairingService.unpair(pairing.id);
        io.to(`user_${socket.userId}`).emit('unpaired');
        console.log(`Unpaired: ${pairing.id}`);
      }
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.deviceId) {
      botSockets.delete(socket.deviceId);
    }
  });
});

// 定期清理过期配对和消息
setInterval(() => {
  pairingService.cleanupExpired();
  messageService.cleanupOldMessages();
}, 5 * 60 * 1000); // 每5分钟

const PORT = process.env.PORT || 8765;
server.listen(PORT, () => {
  console.log(`Clawbot Channel Server running on port ${PORT}`);
});
```

### 2.9 ecosystem.config.js（PM2配置）

```javascript
module.exports = {
  apps: [{
    name: 'clawbot-channel',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // 自动重启
    autorestart: true,
    // 崩溃后延迟重启
    restart_delay: 3000,
    // 最大重启次数
    max_restarts: 10,
    // 最小运行时间
    min_uptime: '10s'
  }]
};
```

### 2.10 部署脚本（deploy.sh）

```bash
#!/bin/bash

set -e

echo "🚀 Deploying Clawbot Channel Server..."

# 1. 创建目录
sudo mkdir -p /opt/clawbot-channel
sudo chown -R $USER:$USER /opt/clawbot-channel

# 2. 复制文件（假设在本地开发后上传）
# 实际使用时用 scp 或 git
# scp -r ./* ubuntu@TRIX_SERVER_HOST:/opt/clawbot-channel/

# 3. 进入目录
cd /opt/clawbot-channel

# 4. 安装依赖
npm install

# 5. 创建数据目录
mkdir -p data logs

# 6. 配置环境变量（手动编辑）
if [ ! -f .env ]; then
  echo "⚠️  Please create .env file with your configuration"
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

# 7. 使用 PM2 启动
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd

echo "✅ Deployment complete!"
echo "   View logs: pm2 logs clawbot-channel"
echo "   Status: pm2 status"
```

---

## 三、Clawbot Channel 插件开发

### 3.1 目录结构

```
~/.openclaw/skills/custom-app-channel/
├── SKILL.md
├── manifest.json
├── index.js
├── lib/
│   ├── websocket-client.js
│   ├── pairing-display.js
│   └── message-handler.js
├── package.json
└── config.json
```

### 3.2 manifest.json

```json
{
  "id": "custom-app-channel",
  "name": "Custom App Channel",
  "version": "1.0.0",
  "description": "连接自定义手机 App 的 Channel",
  "author": "Your Name",
  "main": "index.js",
  "config": "config.json",
  "dependencies": [],
  "hooks": {
    "onBoot": "onBoot",
    "onShutdown": "onShutdown"
  }
}
```

### 3.3 config.json

```json
{
  "serverUrl": "ws://TRIX_SERVER_HOST:8765",
  "webhookSecret": "your-webhook-secret-here",
  "pairing": {
    "autoGenerate": true,
    "displayMode": "both"
  },
  "reconnect": {
    "enabled": true,
    "maxAttempts": 100,
    "initialDelay": 2000,
    "maxDelay": 60000
  }
}
```

### 3.4 package.json

```json
{
  "name": "clawbot-custom-app-channel",
  "version": "1.0.0",
  "dependencies": {
    "ws": "^8.14.2",
    "qrcode-terminal": "^0.12.0",
    "axios": "^1.6.0"
  }
}
```

### 3.5 lib/websocket-client.js

```javascript
const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketClient extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.isReconnecting = false;
    this.heartbeatInterval = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[WS] Connecting to ${this.url}...`);
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('[WS] Connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            this.emit('message', message);
          } catch (err) {
            this.emit('message', { type: 'raw', data: data.toString() });
          }
        });

        this.ws.on('close', () => {
          console.log('[WS] Disconnected');
          this.stopHeartbeat();
          this.emit('disconnected');
          this.reconnect();
        });

        this.ws.on('error', (err) => {
          console.error('[WS] Error:', err.message);
          this.emit('error', err);
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('[WS] Cannot send, not connected');
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, 30000); // 30秒心跳
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  reconnect() {
    if (this.isReconnecting || this.reconnectAttempts >= this.options.maxAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(
      this.options.initialDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      this.options.maxDelay
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.isReconnecting = false;
      this.connect().catch(() => {
        // 连接失败会继续重试
      });
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = WebSocketClient;
```

### 3.6 lib/pairing-display.js

```javascript
const qrcode = require('qrcode-terminal');

class PairingDisplay {
  constructor() {
    this.currentPairing = null;
  }

  // 显示配对信息
  showPairingInfo(pairingCode, qrImage) {
    console.clear();
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║     📱 TRIX 3D - Clawbot Pairing Mode          ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log('║                                                ║');
    console.log(`║  Pairing Code: ${pairingCode}                    ║`);
    console.log('║                                                ║');
    console.log('║  Or scan QR code with your phone:              ║');
    console.log('║                                                ║');
    
    // 显示二维码
    if (qrImage) {
      // 如果是 Data URL，转换成终端二维码
      console.log(qrImage);
    } else {
      // 生成终端二维码
      const qrData = JSON.stringify({
        type: 'clawbot_pairing',
        server: 'm.jmtrick.com',
        code: pairingCode
      });
      qrcode.generate(qrData, { small: true });
    }
    
    console.log('║                                                ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\nWaiting for phone to connect...\n');
  }

  // 显示配对成功
  showPaired(deviceName) {
    console.clear();
    console.log('\n✅ Successfully paired with:', deviceName);
    console.log('Ready to receive messages.\n');
  }

  // 显示断开连接
  showDisconnected() {
    console.log('\n⚠️  Disconnected from server');
    console.log('Reconnecting...\n');
  }

  // 显示收到消息
  showMessage(content, type = 'text') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 📩 ${type}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
  }
}

module.exports = PairingDisplay;
```

### 3.7 lib/message-handler.js

```javascript
const axios = require('axios');

class MessageHandler {
  constructor(config) {
    this.config = config;
    this.gateway = null; // Clawdbot gateway 实例
  }

  // 设置 gateway 引用
  setGateway(gateway) {
    this.gateway = gateway;
  }

  // 处理来自 App 的消息
  async handleAppMessage(data) {
    const { userId, content, contentType, mediaUrl } = data;

    console.log(`[Message] From ${userId}: ${content.substring(0, 50)}...`);

    try {
      // 如果有媒体文件，先下载
      let localPath = null;
      if (mediaUrl && contentType !== 'text') {
        localPath = await this.downloadMedia(mediaUrl);
      }

      // 构造消息给 Clawdbot 处理
      const message = {
        text: content,
        media: localPath ? [{ path: localPath, type: contentType }] : undefined
      };

      // 发送到 Clawdbot 处理（通过 gateway API）
      const response = await this.sendToClawbot(message);

      // 发送回复给 App（通过服务器 Webhook）
      await this.sendReplyToApp(userId, response);

    } catch (err) {
      console.error('[Message] Error:', err.message);
      await this.sendReplyToApp(userId, {
        content: 'Sorry, I encountered an error processing your message.',
        contentType: 'text'
      });
    }
  }

  // 下载媒体文件
  async downloadMedia(url) {
    // 实现下载逻辑
    // 返回本地文件路径
    const response = await axios.get(url, { responseType: 'stream' });
    // ... 保存到临时目录
    return '/tmp/downloaded-file';
  }

  // 发送到 Clawdbot 处理
  async sendToClawbot(message) {
    // 这里调用 Clawdbot 的 API 处理消息
    // 返回 AI 响应
    // 实际实现取决于 Clawdbot 提供的接口
    return {
      content: 'This is a response from Clawdbot',
      contentType: 'text'
    };
  }

  // 发送回复给 App
  async sendReplyToApp(userId, response) {
    try {
      await axios.post(`http://localhost:8765/webhook/clawbot`, {
        userId,
        content: response.content,
        contentType: response.contentType,
        mediaUrl: response.mediaUrl
      }, {
        headers: {
          'X-Webhook-Secret': this.config.webhookSecret
        }
      });
    } catch (err) {
      console.error('[Webhook] Failed to send reply:', err.message);
    }
  }
}

module.exports = MessageHandler;
```

### 3.8 index.js（主入口）

```javascript
const WebSocketClient = require('./lib/websocket-client');
const PairingDisplay = require('./lib/pairing-display');
const MessageHandler = require('./lib/message-handler');
const config = require('./config.json');

class CustomAppChannel {
  constructor() {
    this.ws = null;
    this.display = new PairingDisplay();
    this.handler = new MessageHandler(config);
    this.deviceId = this.generateDeviceId();
    this.pairingId = null;
    this.isPaired = false;
  }

  // 生成设备ID
  generateDeviceId() {
    return `clawbot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 启动
  async onBoot(gateway) {
    console.log('[Channel] Starting Custom App Channel...');
    
    this.handler.setGateway(gateway);
    
    // 连接服务器
    this.ws = new WebSocketClient(config.serverUrl, {
      maxAttempts: config.reconnect.maxAttempts,
      initialDelay: config.reconnect.initialDelay,
      maxDelay: config.reconnect.maxDelay
    });

    this.setupEventHandlers();
    
    try {
      await this.ws.connect();
    } catch (err) {
      console.error('[Channel] Failed to connect:', err.message);
    }
  }

  // 设置事件处理
  setupEventHandlers() {
    // 连接成功
    this.ws.on('connected', () => {
      this.requestPairing();
    });

    // 收到消息
    this.ws.on('message', (msg) => {
      this.handleMessage(msg);
    });

    // 断开连接
    this.ws.on('disconnected', () => {
      this.display.showDisconnected();
      this.isPaired = false;
    });
  }

  // 请求配对
  requestPairing() {
    console.log('[Channel] Requesting pairing...');
    this.ws.send({
      type: 'bot_connect',
      data: {
        deviceId: this.deviceId,
        // pairingId 会在用户扫码后由服务器提供
      }
    });
  }

  // 完成配对（用户扫码后）
  completePairing(pairingId) {
    this.pairingId = pairingId;
    this.ws.send({
      type: 'bot_connect',
      data: {
        deviceId: this.deviceId,
        pairingId: pairingId
      }
    });
  }

  // 处理消息
  handleMessage(msg) {
    switch (msg.type) {
      case 'pairing_code':
        // 收到配对码，显示给用户
        this.display.showPairingInfo(msg.pairingCode, msg.qrImage);
        break;

      case 'pairing_success':
        // 配对成功
        this.isPaired = true;
        this.display.showPaired(msg.deviceName || 'Mobile App');
        break;

      case 'app_message':
        // 收到 App 消息
        if (this.isPaired) {
          this.handler.handleAppMessage(msg.data);
        }
        break;

      case 'unpaired':
        // 被解绑
        this.isPaired = false;
        console.log('[Channel] Unpaired, requesting new pairing...');
        this.requestPairing();
        break;

      case 'pong':
        // 心跳响应
        break;

      default:
        console.log('[Channel] Unknown message type:', msg.type);
    }
  }

  // 关闭
  async onShutdown() {
    console.log('[Channel] Shutting down...');
    if (this.ws) {
      this.ws.disconnect();
    }
  }
}

// 导出实例
module.exports = new CustomAppChannel();
```

---

## 四、App 端增量开发

### 4.1 新增/修改文件清单

```
src/
├── contexts/
│   ├── WebSocketContext.tsx          # 修改：连接新服务器
│   ├── ClawbotChannelContext.tsx     # 新增：替代Nanobot
│   └── QRCodePairingContext.tsx      # 修改：新配对逻辑
├── services/
│   ├── channelApi.ts                 # 新增：API封装
│   └── pairingSocket.ts              # 新增：Socket.io封装
└── screens/
    ├── Pairing.tsx                   # 修改：配对流程
    └── QRPairing.tsx                 # 修改：二维码扫描
```

### 4.2 services/pairingSocket.ts（新增）

```typescript
import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useCallback } from 'react';

const SERVER_URL = 'wss://m.jmtrick.com';

export class PairingSocket {
  private socket: Socket | null = null;
  private userId: string;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPongTime: number = Date.now();
  private onMessageCallback: ((msg: any) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  connect() {
    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 100,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 60000
    });

    // 连接成功后注册
    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.socket?.emit('app_register', { userId: this.userId });
      this.startHeartbeat();
      this.onConnectCallback?.();
    });

    // 断开连接
    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      this.stopHeartbeat();
      this.onDisconnectCallback?.();
    });

    // 收到消息
    this.socket.on('bot_message', (msg) => {
      this.onMessageCallback?.(msg);
    });

    // 配对成功
    this.socket.on('pairing_success', (data) => {
      localStorage.setItem('clawbot_device_id', data.deviceId);
      localStorage.setItem('clawbot_paired', 'true');
    });

    // 被解绑
    this.socket.on('unpaired', () => {
      localStorage.removeItem('clawbot_device_id');
      localStorage.removeItem('clawbot_paired');
    });

    // 心跳响应
    this.socket.on('pong', () => {
      this.lastPongTime = Date.now();
    });

    // 错误
    this.socket.on('error', (err) => {
      console.error('[Socket] Error:', err);
    });
  }

  // 开始心跳（应用层）
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      // 检查是否超过60秒没收到pong
      if (Date.now() - this.lastPongTime > 60000) {
        console.log('[Socket] Heartbeat timeout, reconnecting...');
        this.socket?.disconnect();
        this.socket?.connect();
        return;
      }

      this.socket?.emit('ping');
    }, 30000); // 30秒
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 请求配对
  requestPairing(callback: (data: any) => void) {
    this.socket?.emit('request_pairing', {
      userId: this.userId,
      deviceName: 'TRIX Mobile App'
    }, callback);
  }

  // 配对码配对
  pairWithCode(code: string, callback: (data: any) => void) {
    this.socket?.emit('pair_with_code', { code }, callback);
  }

  // Token配对（二维码）
  pairWithToken(token: string, callback: (data: any) => void) {
    this.socket?.emit('pair_with_token', { token }, callback);
  }

  // 发送消息
  sendMessage(content: string, contentType = 'text', mediaUrl?: string) {
    this.socket?.emit('app_message', {
      content,
      contentType,
      mediaUrl
    });
  }

  // 解绑
  unpair() {
    this.socket?.emit('unpair');
  }

  disconnect() {
    this.stopHeartbeat();
    this.socket?.disconnect();
  }

  // 事件监听
  onMessage(callback: (msg: any) => void) {
    this.onMessageCallback = callback;
  }

  onConnect(callback: () => void) {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}
```

### 4.3 contexts/ClawbotChannelContext.tsx（新增）

```typescript
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { PairingSocket } from '../services/pairingSocket';
import { useAuth } from './AuthContext';

interface ClawbotChannelContextType {
  isConnected: boolean;
  isPaired: boolean;
  pairingStatus: 'idle' | 'pairing' | 'paired';
  messages: ChannelMessage[];
  pairingCode: string | null;
  qrImage: string | null;
  // 方法
  requestPairing: () => Promise<void>;
  pairWithCode: (code: string) => Promise<boolean>;
  pairWithQR: (token: string) => Promise<boolean>;
  sendMessage: (content: string, type?: string, mediaUrl?: string) => void;
  unpair: () => void;
}

interface ChannelMessage {
  id: string;
  content: string;
  contentType: string;
  sender: 'user' | 'bot';
  timestamp: number;
  mediaUrl?: string;
}

const ClawbotChannelContext = createContext<ClawbotChannelContextType | null>(null);

export const ClawbotChannelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<PairingSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaired, setIsPaired] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'pairing' | 'paired'>('idle');
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);

  // 初始化连接
  useEffect(() => {
    if (!user?.id) return;

    // 检查是否已配对
    const wasPaired = localStorage.getItem('clawbot_paired') === 'true';
    if (wasPaired) {
      setIsPaired(true);
      setPairingStatus('paired');
    }

    const sock = new PairingSocket(user.id);
    
    sock.onConnect(() => setIsConnected(true));
    sock.onDisconnect(() => setIsConnected(false));
    sock.onMessage((msg) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: msg.content,
        contentType: msg.contentType || 'text',
        sender: 'bot',
        timestamp: msg.timestamp || Date.now(),
        mediaUrl: msg.mediaUrl
      }]);
    });

    sock.connect();
    setSocket(sock);

    return () => {
      sock.disconnect();
    };
  }, [user?.id]);

  // 请求配对（获取配对码和二维码）
  const requestPairing = useCallback(async () => {
    if (!socket) return;
    
    setPairingStatus('pairing');
    
    socket.requestPairing((response) => {
      if (response.success) {
        setPairingCode(response.pairingCode);
        setQrImage(response.qrImage);
      }
    });
  }, [socket]);

  // 配对码配对
  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    if (!socket) return false;

    return new Promise((resolve) => {
      socket.pairWithCode(code, (response) => {
        if (response.success) {
          // 等待配对成功事件
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }, [socket]);

  // 二维码配对
  const pairWithQR = useCallback(async (token: string): Promise<boolean> => {
    if (!socket) return false;

    return new Promise((resolve) => {
      socket.pairWithToken(token, (response) => {
        if (response.success) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }, [socket]);

  // 发送消息
  const sendMessage = useCallback((content: string, type = 'text', mediaUrl?: string) => {
    if (!socket || !isPaired) return;

    socket.sendMessage(content, type, mediaUrl);
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content,
      contentType: type,
      sender: 'user',
      timestamp: Date.now(),
      mediaUrl
    }]);
  }, [socket, isPaired]);

  // 解绑
  const unpair = useCallback(() => {
    socket?.unpair();
    setIsPaired(false);
    setPairingStatus('idle');
    localStorage.removeItem('clawbot_paired');
    localStorage.removeItem('clawbot_device_id');
  }, [socket]);

  return (
    <ClawbotChannelContext.Provider value={{
      isConnected,
      isPaired,
      pairingStatus,
      messages,
      pairingCode,
      qrImage,
      requestPairing,
      pairWithCode,
      pairWithQR,
      sendMessage,
      unpair
    }}>
      {children}
    </ClawbotChannelContext.Provider>
  );
};

export const useClawbotChannel = () => {
  const context = useContext(ClawbotChannelContext);
  if (!context) {
    throw new Error('useClawbotChannel must be used within ClawbotChannelProvider');
  }
  return context;
};
```

### 4.4 screens/Pairing.tsx（修改版）

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';

export const Pairing: React.FC = () => {
  const navigate = useNavigate();
  const { requestPairing, pairWithCode, pairingStatus } = useClawbotChannel();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 请求配对（获取配对码/二维码）
  const handleRequestPairing = async () => {
    setIsLoading(true);
    await requestPairing();
    setIsLoading(false);
    // 跳转到显示配对码/二维码的页面
    navigate('/qr-pairing');
  };

  // 手动输入配对码
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError('');

    const success = await pairWithCode(code.trim().toUpperCase());
    
    if (success) {
      navigate('/chat');
    } else {
      setError('Invalid pairing code. Please try again.');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Connect to Clawbot
        </h1>

        {/* 方式1：显示配对码/二维码 */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-4">
          <h2 className="text-lg font-semibold mb-3">Scan QR Code</h2>
          <p className="text-gray-600 mb-4">
            Open Clawbot on your Mac and scan the QR code
          </p>
          <button
            onClick={handleRequestPairing}
            disabled={isLoading}
            className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Show QR Code'}
          </button>
        </div>

        {/* 方式2：手动输入配对码 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Enter Pairing Code</h2>
          <p className="text-gray-600 mb-4">
            Enter the 6-digit code shown on Clawbot
          </p>
          
          <form onSubmit={handleCodeSubmit}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full text-center text-2xl tracking-widest border-2 border-gray-200 rounded-lg py-3 mb-4 focus:border-blue-500 focus:outline-none"
            />
            
            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}
            
            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full bg-green-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
```

### 4.5 screens/QRPairing.tsx（修改版）

```typescript
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';

export const QRPairing: React.FC = () => {
  const navigate = useNavigate();
  const { pairingCode, qrImage, isPaired } = useClawbotChannel();

  useEffect(() => {
    if (isPaired) {
      // 配对成功，跳转到聊天
      navigate('/chat');
    }
  }, [isPaired, navigate]);

  if (!pairingCode && !qrImage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <h1 className="text-xl font-bold mb-6">Scan this code with Clawbot</h1>
      
      {/* 显示配对码 */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 text-center">
        <p className="text-gray-500 text-sm mb-2">Or enter this code:</p>
        <p className="text-4xl font-mono font-bold tracking-widest text-blue-600">
          {pairingCode}
        </p>
      </div>

      {/* 显示二维码 */}
      {qrImage && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <img 
            src={qrImage} 
            alt="Pairing QR Code" 
            className="w-64 h-64"
          />
        </div>
      )}

      <p className="text-gray-500 text-sm mt-6 text-center">
        Waiting for Clawbot to connect...
      </p>
    </div>
  );
};
```

---

## 五、部署与启动顺序

### 5.1 部署顺序

```bash
# 第一步：部署服务器
ssh ubuntu@TRIX_SERVER_HOST
cd /opt/clawbot-channel
npm install
nano .env  # 配置环境变量
pm2 start ecosystem.config.js

# 第二步：安装 Clawbot 插件
# 在 MacBook 上
cd ~/.openclaw/skills/
mkdir -p custom-app-channel
# 复制所有插件文件
cd custom-app-channel
npm install
# 编辑 config.json 配置服务器地址

# 第三步：App 集成
# 修改 App 代码，集成新的 Context
# 构建部署
npm run build
# 上传到服务器或 Vercel
```

### 5.2 启动顺序

```
1. 启动服务器 (pm2 start)
   └── 等待 Clawbot 和 App 连接

2. 启动 MacBook Clawbot
   └── 插件自动连接服务器
   └── 显示配对码/二维码

3. 用户打开 App
   └── 登录 (Supabase Auth)
   └── 进入配对页面
   └── 扫描二维码或输入配对码
   └── 配对成功，开始聊天
```

---

## 六、下一步

文档已完成。需要我开始：

1. **服务器部署**（你提供 SSH 访问或技术人员执行脚本）
2. **Clawbot 插件开发**（在 MacBook 上创建技能目录）
3. **App 代码集成**（提供具体的 Git 分支或 PR）

你选哪个先开始？
