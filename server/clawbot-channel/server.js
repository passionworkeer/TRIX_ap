require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

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
  transports: ['websocket', 'polling'],
  pingInterval: 30000,  // ✅ 统一为 30 秒发送一次心跳
  pingTimeout: 60000,   // 60 秒超时（增加容错）
  upgradeTimeout: 30000, // 升级超时 30 秒
  allowUpgrades: true,
  cookie: false
});

// 存储 Clawbot socket 连接 (deviceId -> socket)
const botSockets = new Map();
// 存储 pairingId -> deviceId 映射
const pairingToDevice = new Map();

// Multer 配置（内存存储）
// ✅ #6: 文件上传类型验证
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/mpeg',
      'video/webm',
      'application/pdf'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.log(`[Upload] ❌ 拒绝文件类型: ${file.mimetype}`);
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  }
});

// 中间件
app.use(cors());
app.use(express.json());

// ✅ #7: 速率限制（防止滥用）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 最多 100 个请求
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// 配对接口速率限制（更严格）
const pairingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分钟
  max: 10, // 最多 10 次配对请求
  message: 'Too many pairing attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 文件上传速率限制
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 分钟
  max: 20, // 最多 20 次上传
  message: 'Too many upload attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// 初始化数据库
initDatabase();

// ===== HTTP API =====

// 健康检查
app.get('/health', (req, res) => {
  console.log(`[Health] ✅ 健康检查 ${new Date().toISOString()}`);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Clawbot Webhook回调（接收AI回复）
app.post('/webhook/clawbot', async (req, res) => {
  const { deviceId, content, contentType, mediaUrl } = req.body;

  console.log(`[Webhook] 📩 收到 Webhook, deviceId: ${deviceId}, content: ${content?.substring(0, 50)}...`);

  try {
    // 验证密钥
    const authHeader = req.headers['x-webhook-secret'];
    if (authHeader !== process.env.CLAWBOT_WEBHOOK_SECRET) {
      console.log(`[Webhook] ❌ Webhook 密钥验证失败`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pairing = await pairingService.getPairingByDeviceId(deviceId);
    if (!pairing) {
      console.log(`[Webhook] ❌ 配对记录不存在: ${deviceId}`);
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

    console.log(`[Webhook] ✅ 消息已转发给用户 ${pairing.user_id}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[Webhook] ❌ 错误:`, err);
    res.status(500).json({ error: err.message });
  }
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
app.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    console.log(`[Upload] 📤 收到上传请求`);

    if (!req.file) {
      console.log(`[Upload] ❌ 没有文件`);
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const { userId } = req.body;

    console.log(`[Upload] 📁 文件: ${originalname}, 类型: ${mimetype}, 大小: ${buffer.length} bytes`);

    // 上传到 OSS
    const result = await ossService.uploadFile(buffer, originalname, mimetype);
    if (!result) {
      console.log(`[Upload] ❌ OSS 上传失败`);
      return res.status(500).json({ error: 'Upload failed' });
    }

    // 返回文件URL和objectKey
    console.log(`[Upload] ✅ 上传成功: ${result.objectKey}`);
    res.json({
      success: true,
      url: result.url,
      objectKey: result.objectKey,
      contentType: mimetype
    });
  } catch (err) {
    console.error('[Upload] ❌ 错误:', err);
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
  console.log(`[Socket.io] ✅ 客户端已连接: ${socket.id}, 当前总连接数: ${io.sockets.sockets.size}`);

  // ========== Clawbot 连接逻辑 ==========

  // Clawbot 请求配对信息（生成配对码/二维码）
  socket.on('bot_request_pairing', async (data, callback) => {
    try {
      const { deviceId } = data;

      console.log(`[Bot] 🤖 Clawbot 请求配对: deviceId=${deviceId}, socket=${socket.id}`);

      // 检查是否已有配对记录
      const existingPairing = await pairingService.getPairingByDeviceId(deviceId);

      if (existingPairing && existingPairing.status === 'paired') {
        // Clawbot 已配对，恢复连接
        console.log(`[Bot] ♻️ Clawbot ${deviceId} 重连，恢复配对, userId=${existingPairing.user_id}`);

        // 更新 socket
        botSockets.set(deviceId, socket);
        socket.deviceId = deviceId;
        socket.isBot = true;
        socket.pairingId = existingPairing.id;

        // ✅ P1-问题5: 通知 App Bot 已上线
        if (existingPairing.user_id) {
          io.to(`user_${existingPairing.user_id}`).emit('bot_online', {
            deviceId,
            message: 'Clawbot 已重新连接',
            timestamp: Date.now()
          });
          console.log(`[Bot] 📢 通知用户 ${existingPairing.user_id}: Bot ${deviceId} 已上线`);
        }

        console.log(`[Bot] ✅ 配对已恢复: ${deviceId}, 总 bots: ${botSockets.size}`);
        if (typeof callback === 'function') {
          callback({ success: true, restored: true });
        }
        return;
      }

      // 创建新的配对记录（没有 userId，等待 App 连接）
      console.log(`[Bot] 🔐 生成新配对: deviceId=${deviceId}`);
      const pairing = await pairingService.createBotPairing(deviceId);
      const { qrData, qrImage } = await pairingService.generateQRCodeData(pairing.pairingToken);

      // 存储 deviceId 和 pairingId 的映射
      pairingToDevice.set(pairing.id, deviceId);

      // 存储 Clawbot socket（重要！用于后续发送 user_paired 事件）
      botSockets.set(deviceId, socket);
      socket.deviceId = deviceId;
      socket.isBot = true;
      socket.pairingId = pairing.id;

      // 发送配对信息给 Clawbot
      socket.emit('pairing_info', {
        pairingId: pairing.id,
        pairingCode: pairing.pairingCode,
        qrImage,
        expiresIn: parseInt(process.env.PAIRING_TOKEN_EXPIRY) / 1000
      });

      console.log(`[Bot] ✅ 配对码已生成: ${pairing.pairingCode}, device=${deviceId}, 总 bots: ${botSockets.size}`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          restored: false,
          pairingCode: pairing.pairingCode,
          pairingToken: pairing.pairingToken,
          pairingId: pairing.id,
          expiresAt: pairing.expiresAt
        });
      }
    } catch (err) {
      console.error('[Bot] ❌ 生成配对失败:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Clawbot 确认配对（当 App 验证配对码后）
  socket.on('bot_confirm_pairing', async (data, callback) => {
    try {
      const { deviceId, pairingId } = data;

      // 获取配对信息
      const pairing = await pairingService.getPairingById(pairingId);
      if (!pairing) {
        if (typeof callback === 'function') {
          return callback({ success: false, error: 'Pairing not found' });
        }
        return;
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
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[Bot] Error confirming pairing:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // ========== App 连接逻辑 ==========

  // App 注册
  socket.on('app_register', async (data) => {
    const { userId } = data;

    // ✅ P1-问题4: 检查是否已注册（避免重复）
    if (socket.userId && socket.userId === userId) {
      console.log(`[App] ℹ️ 用户 ${userId} 已注册，跳过重复注册`);
      return;
    }

    socket.userId = userId;
    socket.join(`user_${userId}`);
    console.log(`[App] 📱 App 注册: userId=${userId}, socket=${socket.id}`);

    // ✅ P0-#4: 检查用户是否已有配对状态
    try {
      const pairing = await pairingService.getPairingByUserId(userId);
      if (pairing && pairing.status === 'paired' && pairing.device_id) {
        console.log(`[App] ✅ 用户 ${userId} 已配对，发送配对状态: deviceId=${pairing.device_id}`);
        // 发送配对成功事件（前端 Bridge 监听 'pairing_success'，Context 监听 'paired'）
        socket.emit('pairing_success', {
          deviceId: pairing.device_id,
          deviceName: pairing.device_name || 'Clawbot'
        });
      } else {
        console.log(`[App] ℹ️ 用户 ${userId} 尚未配对`);
      }
    } catch (err) {
      console.error(`[App] ❌ 检查配对状态失败:`, err);
    }
  });

  // ✅ P0-#4: 配对状态查询接口
  socket.on('check_pairing_status', async (data, callback) => {
    const { userId } = data;
    console.log(`[App] 🔍 配对状态查询请求: userId=${userId}, socket=${socket.id}`);

    try {
      if (!userId || typeof userId !== 'string') {
        return callback?.({
          success: false,
          error: 'Invalid user ID'
        });
      }

      const pairing = await pairingService.getPairingByUserId(userId);
      if (pairing && pairing.status === 'paired') {
        // 检查 Bot 是否在线
        const botOnline = botSockets.has(pairing.device_id);
        console.log(`[App] ✅ 配对状态: userId=${userId}, deviceId=${pairing.device_id}, botOnline=${botOnline}`);

        callback?.({
          success: true,
          paired: true,
          deviceId: pairing.device_id,
          deviceName: pairing.device_name || 'Clawbot',
          botOnline: botOnline,
          pairedAt: pairing.paired_at
        });
      } else {
        console.log(`[App] ℹ️ 用户 ${userId} 尚未配对`);
        callback?.({
          success: true,
          paired: false
        });
      }
    } catch (err) {
      console.error(`[App] ❌ 配对状态查询失败:`, err);
      callback?.({
        success: false,
        error: err.message
      });
    }
  });

  // App 通过配对码配对
  socket.on('pair_with_code', async (data, callback) => {
    try {
      const { code, userId } = data;
      console.log(`[App] 🔑 配对码验证请求: code=${code}, userId=${userId}, socket=${socket.id}`);

      // ✅ P0-#3: 验证用户 ID
      // 1. 检查 userId 是否提供
      if (!userId || typeof userId !== 'string') {
        console.log(`[App] ❌ 无效的用户 ID: userId=${userId}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'Invalid user ID'
          });
        }
        return;
      }

      // 2. 检查 userId 格式（假设是UUID，长度应该大于30）
      if (userId.length < 30) {
        console.log(`[App] ❌ 用户 ID 格式无效: userId=${userId}, length=${userId.length}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'Invalid user ID format'
          });
        }
        return;
      }

      // 3. 验证用户 ID 是否与 socket.userId 匹配（防止越权）
      if (socket.userId && userId !== socket.userId) {
        console.log(`[App] ❌ 用户 ID 不匹配: socket=${socket.userId}, request=${userId}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'User ID mismatch'
          });
        }
        return;
      }

      const result = await pairingService.verifyPairingCode(code);

      if (!result.success) {
        console.log(`[App] ❌ 配对码无效或已过期: ${code}`);
        if (typeof callback === 'function') {
          return callback(result);
        }
        return;
      }

      console.log(`[App] ✅ 配对码验证成功: code=${code}, pairingId=${result.pairing.id}, deviceId=${result.pairing.device_id}`);

      // ✅ P1-问题3: 先检查 Bot 是否在线，再绑定用户
      if (!botSockets.has(result.pairing.device_id)) {
        console.log(`[App] ❌ Bot 离线，无法完成配对: deviceId=${result.pairing.device_id}, 总 bots=${botSockets.size}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'Clawbot is offline. Please ensure Clawbot is connected and try pairing again.'
          });
        }
        return;
      }

      console.log(`[App] ✅ Bot 在线 (${result.pairing.device_id})，继续配对...`);

      // 绑定 userId 到配对记录
      await pairingService.bindUserToPairing(result.pairing.id, userId);
      console.log(`[App] 🔗 用户已绑定: userId=${userId}, pairingId=${result.pairing.id}`);

      // ✅ 直接完成配对（不再等待 Clawbot 额外确认）
      await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);

      // ✅ 通知 App 配对成功
      io.to(`user_${userId}`).emit('pairing_success', {
        deviceId: result.pairing.device_id,
        deviceName: 'Clawbot',
        pairingId: result.pairing.id
      });

      console.log(`[App] 🎉 配对成功: code=${code}, userId=${userId}, deviceId=${result.pairing.device_id}`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          pairingId: result.pairing.id,
          status: 'paired'  // ✅ 直接返回已配对状态
        });
      }
    } catch (err) {
      console.error('[App] ❌ 配对码验证错误:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // App 通过二维码Token配对
  socket.on('pair_with_token', async (data, callback) => {
    try {
      const { token, userId } = data;
      console.log(`[App] 📱 二维码 Token 验证请求: userId=${userId}, socket=${socket.id}`);

      // ✅ P0-#3: 验证用户 ID
      // 1. 检查 userId 是否提供
      if (!userId || typeof userId !== 'string') {
        console.log(`[App] ❌ 无效的用户 ID: userId=${userId}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'Invalid user ID'
          });
        }
        return;
      }

      // 2. 检查 userId 格式（假设是UUID，长度应该大于30）
      if (userId.length < 30) {
        console.log(`[App] ❌ 用户 ID 格式无效: userId=${userId}, length=${userId.length}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'Invalid user ID format'
          });
        }
        return;
      }

      // 3. 验证用户 ID 是否与 socket.userId 匹配（防止越权）
      if (socket.userId && userId !== socket.userId) {
        console.log(`[App] ❌ 用户 ID 不匹配: socket=${socket.userId}, request=${userId}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'User ID mismatch'
          });
        }
        return;
      }

      const result = await pairingService.verifyPairingToken(token);

      if (!result.success) {
        console.log(`[App] ❌ Token 无效或已过期`);
        if (typeof callback === 'function') {
          return callback(result);
        }
        return;
      }

      console.log(`[App] ✅ Token 验证成功: pairingId=${result.pairing.id}, deviceId=${result.pairing.device_id}`);

      // 绑定 userId 到配对记录
      await pairingService.bindUserToPairing(result.pairing.id, userId);
      console.log(`[App] 🔗 用户已绑定: userId=${userId}, pairingId=${result.pairing.id}`);

      // ✅ 检查 Bot 是否在线
      if (!botSockets.has(result.pairing.device_id)) {
        console.log(`[App] ❌ Bot 离线，无法完成配对: deviceId=${result.pairing.device_id}, 总 bots=${botSockets.size}`);
        if (typeof callback === 'function') {
          return callback({
            success: false,
            error: 'Clawbot is offline. Please ensure Clawbot is connected and try pairing again.'
          });
        }
        return;
      }

      console.log(`[App] ✅ Bot 在线 (${result.pairing.device_id})，正在完成配对...`);

      // ✅ 直接完成配对（不再等待 Clawbot 额外确认）
      await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);

      // ✅ 通知 App 配对成功
      io.to(`user_${userId}`).emit('pairing_success', {
        deviceId: result.pairing.device_id,
        deviceName: 'Clawbot',
        pairingId: result.pairing.id
      });

      console.log(`[App] 🎉 二维码配对成功: userId=${userId}, deviceId=${result.pairing.device_id}`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          pairingId: result.pairing.id,
          status: 'paired'  // ✅ 直接返回已配对状态
        });
      }
    } catch (err) {
      console.error('[App] ❌ Token 验证错误:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // ========== 消息收发逻辑 ==========

  // ✅ P0-#2: App 发送消息（带确认机制）
  socket.on('app_message', async (data) => {
    try {
      const { content, contentType, mediaUrl, messageId } = data; // ✅ P0-问题1: 接收 messageId
      const userId = socket.userId;

      console.log(`[App] 📤 收到消息: userId=${userId}, type=${contentType}, messageId=${messageId}, content=${content?.substring(0, 50)}...`);

      const pairing = await pairingService.getPairingByUserId(userId);
      if (!pairing || !pairing.device_id) {
        console.log(`[App] ❌ 用户未配对: userId=${userId}`);
        socket.emit('error', { message: 'Not paired with any bot' });

        // ✅ P0-问题1: 发送失败确认（带 messageId）
        socket.emit('message_sent', {
          success: false,
          messageId, // ✅ 返回 messageId
          error: 'Not paired with any bot'
        });
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
        console.log(`[App] ✅ 消息已转发给 Bot: deviceId=${pairing.device_id}`);

        // ✅ 发送成功确认
        socket.emit('message_sent', {
          success: true,
          messageId // ✅ 返回 messageId
        });
      } else {
        console.log(`[App] ❌ Bot 离线: deviceId=${pairing.device_id}, 总 bots=${botSockets.size}`);
        socket.emit('error', {
          message: 'Bot is offline',
          deviceId: pairing.device_id,
          hint: '请确保 Clawbot 保持连接状态。如果 Clawbot 已关闭，请重新启动并连接。'
        });

        // ✅ P0-问题1: Bot 离线确认（带 messageId）
        socket.emit('message_sent', {
          success: false,
          messageId, // ✅ 返回 messageId
          error: 'Bot is offline',
          deviceId: pairing.device_id
        });
      }
    } catch (err) {
      console.error('[App] ❌ 处理消息错误:', err);
      socket.emit('error', { message: err.message });

      // ✅ P0-问题1: 异常时发送错误确认（带 messageId）
      socket.emit('message_sent', {
        success: false,
        messageId, // ✅ 返回 messageId
        error: err.message
      });
    }
  });

  // Clawbot 通过 Socket.io 发送消息给 App（替代 Webhook）
  socket.on('bot_message', async (data) => {
    try {
      const { deviceId, content, contentType, mediaUrl } = data;

      console.log(`[Bot] 📤 收到消息: deviceId=${deviceId}, type=${contentType}, content=${content?.substring(0, 50)}...`);

      // 验证 Clawbot 已配对
      const pairing = await pairingService.getPairingByDeviceId(deviceId);
      if (!pairing || pairing.status !== 'paired') {
        console.log(`[Bot] ❌ Bot 未配对或状态无效: deviceId=${deviceId}, status=${pairing?.status}`);
        socket.emit('error', {
          message: 'Not paired or invalid pairing status',
          deviceId
        });
        return;
      }

      // 保存消息到数据库
      await messageService.saveMessage(pairing.id, 'bot_to_app', content, contentType, mediaUrl);

      // 转发给 App（通过 Socket.io Room）
      io.to(`user_${pairing.user_id}`).emit('bot_message', {
        content,
        contentType,
        mediaUrl,
        timestamp: Date.now()
      });

      console.log(`[Bot] ✅ 消息已转发给用户: userId=${pairing.user_id}`);

      socket.emit('message_sent', {
        success: true,
        messageId: Date.now().toString()
      });
    } catch (err) {
      console.error('[Bot] ❌ 发送消息错误:', err);
      socket.emit('message_sent', {
        success: false,
        error: err.message
      });
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
    console.log(`[Socket.io] ❌ 客户端已断开: ${socket.id}, 剩余连接数: ${io.sockets.sockets.size - 1}`);

    if (socket.deviceId) {
      console.log(`[Bot] ❌ Clawbot 已断开: ${socket.deviceId}`);
      botSockets.delete(socket.deviceId);
      console.log(`[Bot] 🔢 剩余 Bots: ${botSockets.size}`);

      // ✅ P1-#5: 通知配对的用户 Bot 已断开
      (async () => {
        try {
          const pairing = await pairingService.getPairingByDeviceId(socket.deviceId);
          if (pairing && pairing.status === 'paired' && pairing.user_id) {
            console.log(`[Bot] 📢 通知用户 ${pairing.user_id}: Bot ${socket.deviceId} 已断开`);
            io.to(`user_${pairing.user_id}`).emit('bot_offline', {
              deviceId: socket.deviceId,
              message: 'Clawbot 已离线',
              timestamp: Date.now()
            });
          }
        } catch (err) {
          console.error('[Bot] ❌ 通知用户 Bot 断开失败:', err);
        }
      })();
    }

    if (socket.userId) {
      console.log(`[App] ❌ App 已断开: userId=${socket.userId}`);
    }
  });
});

// 定期清理过期配对和消息
setInterval(() => {
  pairingService.cleanupExpired();
  messageService.cleanupOldMessages();
}, 5 * 60 * 1000); // 每5分钟

const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '0.0.0.0';  // ✅ 监听所有网络接口，允许外部访问
server.listen(PORT, HOST, () => {
  console.log(`Clawbot Channel Server running on http://${HOST}:${PORT}`);
});
