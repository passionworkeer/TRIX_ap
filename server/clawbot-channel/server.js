require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');

const { initDatabase } = require('./config/database');
const pairingService = require('./services/pairingService');
const messageService = require('./services/messageService');
const ossService = require('./services/ossService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// 存储 Clawbot socket 连接 (deviceId -> socket)
const botSockets = new Map();
// 存储 pairingId -> deviceId 映射
const pairingToDevice = new Map();

// Multer 配置（内存存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

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
    if (!url) {
      return res.status(501).json({ error: 'OSS not configured' });
    }
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 文件上传接口（App 上传图片/视频）
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const { userId } = req.body;

    // 上传到 OSS
    const result = await ossService.uploadFile(buffer, originalname, mimetype);
    if (!result) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    // 返回文件URL和objectKey
    res.json({
      success: true,
      url: result.url,
      objectKey: result.objectKey,
      contentType: mimetype
    });

    console.log(`[Upload] File uploaded by user ${userId}: ${result.objectKey}`);
  } catch (err) {
    console.error('[Upload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Base64 图片上传接口
app.post('/upload/base64', async (req, res) => {
  try {
    const { base64Data, userId } = req.body;

    if (!base64Data) {
      return res.status(400).json({ error: 'No base64 data provided' });
    }

    // 上传到 OSS
    const result = await ossService.uploadBase64(base64Data);
    if (!result) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    // 返回文件URL和objectKey
    res.json({
      success: true,
      url: result.url,
      objectKey: result.objectKey,
      contentType: 'image/jpeg'
    });

    console.log(`[Upload] Base64 image uploaded by user ${userId}: ${result.objectKey}`);
  } catch (err) {
    console.error('[Upload] Base64 error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Socket.io =====

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // ========== Clawbot 连接逻辑 ==========

  // Clawbot 请求配对信息（生成配对码/二维码）
  socket.on('bot_request_pairing', async (data, callback) => {
    try {
      const { deviceId } = data;

      // 创建新的配对记录（没有 userId，等待 App 连接）
      const pairing = await pairingService.createBotPairing(deviceId);
      const { qrData, qrImage } = await pairingService.generateQRCodeData(pairing.pairingToken);

      // 存储 deviceId 和 pairingId 的映射
      pairingToDevice.set(pairing.id, deviceId);

      // 发送配对信息给 Clawbot
      socket.emit('pairing_info', {
        pairingId: pairing.id,
        pairingCode: pairing.pairingCode,
        qrImage,
        expiresIn: parseInt(process.env.PAIRING_TOKEN_EXPIRY) / 1000
      });

      console.log(`[Bot] Pairing generated: ${pairing.pairingCode} for device ${deviceId}`);

      callback({ success: true });
    } catch (err) {
      console.error('[Bot] Error generating pairing:', err);
      callback({ success: false, error: err.message });
    }
  });

  // Clawbot 确认配对（当 App 验证配对码后）
  socket.on('bot_confirm_pairing', async (data, callback) => {
    try {
      const { deviceId, pairingId } = data;

      // 获取配对信息
      const pairing = await pairingService.getPairingById(pairingId);
      if (!pairing) {
        return callback({ success: false, error: 'Pairing not found' });
      }

      // 完成配对
      await pairingService.completeBotPairing(pairingId, deviceId, socket.id);

      // 存储 Clawbot socket
      botSockets.set(deviceId, socket);
      socket.deviceId = deviceId;
      socket.isBot = true;
      socket.pairingId = pairingId;

      // 通知 App 配对成功
      if (pairing.user_id) {
        io.to(`user_${pairing.user_id}`).emit('pairing_success', {
          deviceId,
          deviceName: 'Clawbot'
        });
      }

      console.log(`[Bot] Pairing confirmed: ${deviceId} with user ${pairing.user_id}`);
      callback({ success: true });
    } catch (err) {
      console.error('[Bot] Error confirming pairing:', err);
      callback({ success: false, error: err.message });
    }
  });

  // ========== App 连接逻辑 ==========

  // App 注册
  socket.on('app_register', async (data) => {
    const { userId } = data;
    socket.userId = userId;
    socket.join(`user_${userId}`);
    console.log(`App registered: user_${userId}`);
  });

  // App 通过配对码配对
  socket.on('pair_with_code', async (data, callback) => {
    try {
      const { code, userId } = data;
      const result = await pairingService.verifyPairingCode(code);

      if (!result.success) {
        return callback(result);
      }

      // 绑定 userId 到配对记录
      await pairingService.bindUserToPairing(result.pairing.id, userId);

      // 通知 Clawbot 可以确认配对了
      const deviceId = pairingToDevice.get(result.pairing.id);
      if (deviceId && botSockets.has(deviceId)) {
        const botSocket = botSockets.get(deviceId);
        botSocket.emit('user_paired', {
          pairingId: result.pairing.id,
          userId
        });
      }

      callback({
        success: true,
        pairingId: result.pairing.id,
        status: 'waiting_for_bot_confirmation'
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // App 通过二维码Token配对
  socket.on('pair_with_token', async (data, callback) => {
    try {
      const { token, userId } = data;
      const result = await pairingService.verifyPairingToken(token);

      if (!result.success) {
        return callback(result);
      }

      // 绑定 userId 到配对记录
      await pairingService.bindUserToPairing(result.pairing.id, userId);

      // 通知 Clawbot 可以确认配对了
      const deviceId = pairingToDevice.get(result.pairing.id);
      if (deviceId && botSockets.has(deviceId)) {
        const botSocket = botSockets.get(deviceId);
        botSocket.emit('user_paired', {
          pairingId: result.pairing.id,
          userId
        });
      }

      callback({
        success: true,
        pairingId: result.pairing.id,
        status: 'waiting_for_bot_confirmation'
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  // ========== 消息收发逻辑 ==========

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

      // 转发给 Clawbot
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
  socket.on('ping', (data, callback) => {
    if (typeof callback === 'function') {
      callback({ timestamp: Date.now() });
    } else {
      socket.emit('pong', { timestamp: Date.now() });
    }
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
