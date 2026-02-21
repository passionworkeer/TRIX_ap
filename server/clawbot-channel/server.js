require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

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
  pingInterval: 30000,
  pingTimeout: 60000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  cookie: false
});

const ENABLE_LEGACY_BOT_RESPONSE = process.env.ENABLE_LEGACY_BOT_RESPONSE === 'true';
const DEDUP_TTL_MS = Number(process.env.MESSAGE_DEDUP_TTL_MS || 10000);

const botSockets = new Map();
const pairingToDevice = new Map();
const dedupCache = new Map();

function now() {
  return Date.now();
}

function makeFallbackMessageId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneDedupCache() {
  const cutoff = now() - DEDUP_TTL_MS;
  for (const [key, expiresAt] of dedupCache.entries()) {
    if (expiresAt <= cutoff) {
      dedupCache.delete(key);
    }
  }
}

function seenRecently(key) {
  const ts = now();
  pruneDedupCache();
  if (dedupCache.has(key)) {
    return true;
  }
  dedupCache.set(key, ts + DEDUP_TTL_MS);
  return false;
}

function toNumberTimestamp(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    const numeric = Number(input);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return now();
}

function normalizeAppPayload(data = {}, socketUserId) {
  const content = data.content ?? data.text ?? data.message ?? data.response ?? '';
  const contentType = data.contentType ?? data.content_type ?? 'text';
  const mediaUrl = data.mediaUrl ?? data.media_url ?? null;
  const messageId = data.messageId ?? data.msg_id ?? data.id ?? makeFallbackMessageId('app');
  const threadId = data.threadId ?? data.thread_id ?? 'default';
  const userId = socketUserId ?? data.userId ?? data.user_id ?? null;

  return {
    userId,
    content: typeof content === 'string' ? content : String(content ?? ''),
    contentType,
    mediaUrl,
    messageId: String(messageId),
    threadId,
    timestamp: toNumberTimestamp(data.timestamp),
    raw: data
  };
}

async function normalizeBotPayload(data = {}, socket) {
  const content = data.content ?? data.response ?? data.text ?? data.message ?? '';
  const contentType = data.contentType ?? data.content_type ?? 'text';
  const mediaUrl = data.mediaUrl ?? data.media_url ?? null;
  const messageId = data.messageId ?? data.msg_id ?? data.id ?? makeFallbackMessageId('bot');

  let deviceId = data.deviceId ?? data.device_id ?? socket.deviceId ?? null;
  if (!deviceId && data.pairingId) {
    const pairing = await pairingService.getPairingById(data.pairingId);
    deviceId = pairing?.device_id || null;
  }

  return {
    deviceId,
    content: typeof content === 'string' ? content : String(content ?? ''),
    contentType,
    mediaUrl,
    messageId: String(messageId),
    timestamp: toNumberTimestamp(data.timestamp),
    raw: data
  };
}

function buildDedupKey(prefix, normalized) {
  if (normalized.messageId) {
    return `${prefix}:${normalized.messageId}`;
  }
  return `${prefix}:${normalized.contentType}:${normalized.content.slice(0, 64)}:${Math.floor(normalized.timestamp / DEDUP_TTL_MS)}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
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
      return;
    }

    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
});

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many upload attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

initDatabase();
messageService.initMessageTable().catch((error) => {
  console.error('[MessageService] initMessageTable failed:', error);
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/webhook/clawbot', async (req, res) => {
  const { deviceId, content, contentType, mediaUrl } = req.body;

  try {
    const authHeader = req.headers['x-webhook-secret'];
    if (authHeader !== process.env.CLAWBOT_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pairing = await pairingService.getPairingByDeviceId(deviceId);
    if (!pairing) {
      return res.status(404).json({ error: 'Pairing not found' });
    }

    await messageService.saveMessage(pairing.id, 'bot_to_app', content, contentType, mediaUrl);

    io.to(`user_${pairing.user_id}`).emit('bot_message', {
      content,
      contentType,
      mediaUrl,
      timestamp: now(),
      messageId: makeFallbackMessageId('webhook')
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[Webhook] failed:', error);
    return res.status(500).json({ error: error.message });
  }
});

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
    return res.json({ url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const result = await ossService.uploadFile(buffer, originalname, mimetype);

    if (!result) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    return res.json({
      success: true,
      url: result.url,
      objectKey: result.objectKey,
      contentType: mimetype
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/upload/base64', async (req, res) => {
  try {
    const { base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'No base64 data provided' });
    }

    const result = await ossService.uploadBase64(base64Data);
    if (!result) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    return res.json({
      success: true,
      url: result.url,
      objectKey: result.objectKey,
      contentType: 'image/jpeg'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/sync', async (req, res) => {
  try {
    const { userId, lastTimestamp } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const result = await messageService.fetchMissedMessages(
      userId,
      parseInt(lastTimestamp, 10) || 0
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    return res.json({
      success: true,
      messages: result.data
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] connected: ${socket.id}, total=${io.sockets.sockets.size}`);

  socket.on('bot_request_pairing', async (data, callback) => {
    try {
      const { deviceId } = data || {};
      if (!deviceId) {
        callback?.({ success: false, error: 'Missing deviceId' });
        return;
      }

      const existingPairing = await pairingService.getPairingByDeviceId(deviceId);
      if (existingPairing && existingPairing.status === 'paired') {
        botSockets.set(deviceId, socket);
        socket.deviceId = deviceId;
        socket.isBot = true;
        socket.pairingId = existingPairing.id;

        if (existingPairing.user_id) {
          io.to(`user_${existingPairing.user_id}`).emit('bot_online', {
            deviceId,
            message: 'Clawbot reconnected',
            timestamp: now()
          });
        }

        callback?.({ success: true, restored: true });
        return;
      }

      const pairing = await pairingService.createBotPairing(deviceId);
      const { qrImage } = await pairingService.generateQRCodeData(pairing.pairingToken);

      pairingToDevice.set(pairing.id, deviceId);
      botSockets.set(deviceId, socket);
      socket.deviceId = deviceId;
      socket.isBot = true;
      socket.pairingId = pairing.id;

      socket.emit('pairing_info', {
        pairingId: pairing.id,
        pairingCode: pairing.pairingCode,
        qrImage,
        expiresIn: parseInt(process.env.PAIRING_TOKEN_EXPIRY || '600000', 10) / 1000
      });

      callback?.({
        success: true,
        restored: false,
        pairingCode: pairing.pairingCode,
        pairingToken: pairing.pairingToken,
        pairingId: pairing.id,
        expiresAt: pairing.expiresAt
      });
    } catch (error) {
      console.error('[Bot] bot_request_pairing failed:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('bot_confirm_pairing', async (data, callback) => {
    try {
      const { deviceId, pairingId } = data || {};
      const pairing = await pairingService.getPairingById(pairingId);
      if (!pairing) {
        callback?.({ success: false, error: 'Pairing not found' });
        return;
      }

      await pairingService.completeBotPairing(pairingId, deviceId, socket.id);

      botSockets.set(deviceId, socket);
      socket.deviceId = deviceId;
      socket.isBot = true;
      socket.pairingId = pairingId;

      if (pairing.user_id) {
        io.to(`user_${pairing.user_id}`).emit('pairing_success', {
          deviceId,
          deviceName: 'Clawbot'
        });
      }

      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('app_register', async (data) => {
    const { userId } = data || {};
    if (!userId || typeof userId !== 'string') {
      return;
    }

    if (socket.userId === userId) {
      return;
    }

    socket.userId = userId;
    socket.join(`user_${userId}`);

    try {
      const pairing = await pairingService.getPairingByUserId(userId);
      if (pairing && pairing.status === 'paired' && pairing.device_id) {
        socket.emit('pairing_success', {
          deviceId: pairing.device_id,
          deviceName: pairing.device_name || 'Clawbot'
        });
      }
    } catch (error) {
      console.error('[App] app_register status check failed:', error);
    }
  });

  socket.on('check_pairing_status', async (data, callback) => {
    const { userId } = data || {};

    try {
      if (!userId || typeof userId !== 'string') {
        callback?.({ success: false, error: 'Invalid user ID' });
        return;
      }

      const pairing = await pairingService.getPairingByUserId(userId);
      if (pairing && pairing.status === 'paired') {
        callback?.({
          success: true,
          paired: true,
          deviceId: pairing.device_id,
          deviceName: pairing.device_name || 'Clawbot',
          botOnline: botSockets.has(pairing.device_id),
          pairedAt: pairing.paired_at
        });
      } else {
        callback?.({ success: true, paired: false });
      }
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  });

  async function handlePairWithCode(data, callback) {
    try {
      const { code, userId } = data || {};
      if (!code || typeof code !== 'string') {
        callback?.({ success: false, error: 'Invalid pairing code' });
        return;
      }
      if (!userId || typeof userId !== 'string') {
        callback?.({ success: false, error: 'Invalid user ID' });
        return;
      }

      const result = await pairingService.verifyPairingCode(code);
      if (!result.success) {
        callback?.({ success: false, error: result.error });
        return;
      }

      await pairingService.bindUserToPairing(result.pairing.id, userId);
      await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);

      io.to(`user_${userId}`).emit('pairing_success', {
        deviceId: result.pairing.device_id,
        deviceName: 'Clawbot',
        pairingId: result.pairing.id
      });

      callback?.({
        success: true,
        pairingId: result.pairing.id,
        status: 'paired'
      });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  }

  async function handlePairWithToken(data, callback) {
    try {
      const { token, userId } = data || {};
      if (!token || typeof token !== 'string') {
        callback?.({ success: false, error: 'Invalid pairing token' });
        return;
      }
      if (!userId || typeof userId !== 'string') {
        callback?.({ success: false, error: 'Invalid user ID' });
        return;
      }

      const result = await pairingService.verifyPairingToken(token);
      if (!result.success) {
        callback?.({ success: false, error: result.error });
        return;
      }

      await pairingService.bindUserToPairing(result.pairing.id, userId);

      if (!botSockets.has(result.pairing.device_id)) {
        callback?.({
          success: false,
          error: 'Clawbot is offline. Please ensure Clawbot is connected and try pairing again.'
        });
        return;
      }

      await pairingService.completeBotPairing(result.pairing.id, result.pairing.device_id, socket.id);

      io.to(`user_${userId}`).emit('pairing_success', {
        deviceId: result.pairing.device_id,
        deviceName: 'Clawbot',
        pairingId: result.pairing.id
      });

      callback?.({
        success: true,
        pairingId: result.pairing.id,
        status: 'paired'
      });
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  }

  socket.on('pair_with_code', handlePairWithCode);
  socket.on('app_pair_with_code', handlePairWithCode);
  socket.on('pair_with_token', handlePairWithToken);
  socket.on('app_pair_with_token', handlePairWithToken);

  async function handleAppToBotMessage(rawData, sourceEvent) {
    let messageId = null;

    try {
      const normalized = normalizeAppPayload(rawData, socket.userId);
      messageId = normalized.messageId;

      if (!normalized.userId) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'User not registered'
        });
        return;
      }

      if (!normalized.content.trim()) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Empty message'
        });
        return;
      }

      const dedupKey = buildDedupKey(`app:${normalized.userId}`, normalized);
      if (seenRecently(dedupKey)) {
        socket.emit('message_sent', { success: true, messageId, duplicate: true });
        return;
      }

      const pairing = await pairingService.getPairingByUserId(normalized.userId);
      if (!pairing || !pairing.device_id) {
        socket.emit('error', { message: 'Not paired with any bot' });
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Not paired with any bot'
        });
        return;
      }

      await messageService.saveMessage(
        pairing.id,
        'app_to_bot',
        normalized.content,
        normalized.contentType,
        normalized.mediaUrl
      );

      const botSocket = botSockets.get(pairing.device_id);
      if (!botSocket) {
        socket.emit('error', {
          message: 'Bot is offline',
          deviceId: pairing.device_id,
          hint: 'Please keep Clawbot connected and try again.'
        });
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Bot is offline',
          deviceId: pairing.device_id
        });
        return;
      }

      const appPayload = {
        messageId,
        userId: normalized.userId,
        deviceId: pairing.device_id,
        content: normalized.content,
        contentType: normalized.contentType,
        mediaUrl: normalized.mediaUrl,
        threadId: normalized.threadId,
        timestamp: normalized.timestamp,
        sourceEvent
      };

      botSocket.emit('app_message', appPayload);
      botSocket.emit('user_message', {
        text: normalized.content,
        content: normalized.content,
        messageId,
        userId: normalized.userId,
        deviceId: pairing.device_id,
        threadId: normalized.threadId,
        contentType: normalized.contentType,
        mediaUrl: normalized.mediaUrl,
        timestamp: normalized.timestamp,
        sourceEvent
      });

      socket.emit('message_sent', {
        success: true,
        messageId
      });
    } catch (error) {
      console.error('[App] handleAppToBotMessage failed:', error);
      socket.emit('error', { message: error.message });
      socket.emit('message_sent', {
        success: false,
        messageId,
        error: error.message
      });
    }
  }

  async function handleBotToAppMessage(rawData, sourceEvent) {
    let messageId = null;

    try {
      const normalized = await normalizeBotPayload(rawData, socket);
      messageId = normalized.messageId;

      if (!normalized.deviceId) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Missing deviceId'
        });
        return;
      }

      if (!normalized.content.trim()) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Empty message'
        });
        return;
      }

      const dedupKey = buildDedupKey(`bot:${normalized.deviceId}`, normalized);
      if (seenRecently(dedupKey)) {
        socket.emit('message_sent', { success: true, messageId, duplicate: true });
        return;
      }

      const pairing = await pairingService.getPairingByDeviceId(normalized.deviceId);
      if (!pairing || pairing.status !== 'paired') {
        socket.emit('error', {
          message: 'Not paired or invalid pairing status',
          deviceId: normalized.deviceId
        });
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Not paired or invalid pairing status'
        });
        return;
      }

      await messageService.saveMessage(
        pairing.id,
        'bot_to_app',
        normalized.content,
        normalized.contentType,
        normalized.mediaUrl
      );

      const appPayload = {
        content: normalized.content,
        contentType: normalized.contentType,
        mediaUrl: normalized.mediaUrl,
        timestamp: normalized.timestamp,
        messageId,
        sourceEvent
      };

      io.to(`user_${pairing.user_id}`).emit('bot_message', appPayload);

      if (ENABLE_LEGACY_BOT_RESPONSE) {
        io.to(`user_${pairing.user_id}`).emit('bot_response', {
          response: normalized.content,
          messageId,
          timestamp: new Date(normalized.timestamp).toISOString(),
          pairingId: pairing.id
        });
      }

      socket.emit('message_sent', {
        success: true,
        messageId
      });
    } catch (error) {
      console.error('[Bot] handleBotToAppMessage failed:', error);
      socket.emit('message_sent', {
        success: false,
        messageId,
        error: error.message
      });
    }
  }

  socket.on('app_message', (data) => handleAppToBotMessage(data, 'app_message'));
  socket.on('user_message', (data) => handleAppToBotMessage(data, 'user_message'));
  socket.on('bot_message', (data) => handleBotToAppMessage(data, 'bot_message'));
  socket.on('bot_response', (data) => handleBotToAppMessage(data, 'bot_response'));

  socket.on('ping', (_data, callback) => {
    if (typeof callback === 'function') {
      callback({ timestamp: now() });
    } else {
      socket.emit('pong', { timestamp: now() });
    }
  });

  socket.on('unpair', async () => {
    if (!socket.userId) {
      return;
    }

    const pairing = await pairingService.getPairingByUserId(socket.userId);
    if (!pairing) {
      return;
    }

    await pairingService.unpair(pairing.id);
    io.to(`user_${socket.userId}`).emit('unpaired');
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] disconnected: ${socket.id}, total=${io.sockets.sockets.size - 1}`);

    if (socket.deviceId) {
      botSockets.delete(socket.deviceId);

      (async () => {
        try {
          const pairing = await pairingService.getPairingByDeviceId(socket.deviceId);
          if (pairing && pairing.status === 'paired' && pairing.user_id) {
            io.to(`user_${pairing.user_id}`).emit('bot_offline', {
              deviceId: socket.deviceId,
              message: 'Clawbot offline',
              timestamp: now()
            });
          }
        } catch (error) {
          console.error('[Bot] notify offline failed:', error);
        }
      })();
    }
  });
});

setInterval(async () => {
  try {
    await pairingService.cleanupExpired();
  } catch (error) {
    console.error('[Cleanup] pairing cleanup failed:', error);
  }

  try {
    await messageService.cleanupOldMessages();
  } catch (error) {
    console.error('[Cleanup] message cleanup failed:', error);
  }
}, 5 * 60 * 1000);

setInterval(() => {
  pruneDedupCache();
}, 60 * 1000);

const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Clawbot Channel Server running on http://${HOST}:${PORT}`);
});
