require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const { initDatabase } = require('./config/database');
const pairingService = require('./services/pairingService');
const messageService = require('./services/messageService');
const ossService = require('./services/ossService');
const ttsService = require('./services/ttsService');
const { studyRoomService } = require('./services/studyRoomService');
const gatewayService = require('./services/gatewayService');
const gatewayClientService = require('./services/gatewayClientService');
const providerService = require('./services/providerService');
const localCommandService = require('./services/localCommandService');
const relayService = require('./services/relayService');

// CORS configuration - support whitelist via CORS_ORIGINS env var
// Format: comma-separated domains, e.g., "https://example.com,https://app.example.com"
// Empty or unset defaults to '*' (development only)
const parseCorsOrigins = (envValue) => {
  if (!envValue || typeof envValue !== 'string') {
    return '*';
  }
  const trimmed = envValue.trim();
  if (!trimmed) {
    return '*';
  }
  // Split by comma and clean up whitespace
  const origins = trimmed.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    return '*';
  }
  return origins;
};

const CORS_ORIGINS = parseCorsOrigins(process.env.CORS_ORIGINS);
const originsDisplay = Array.isArray(CORS_ORIGINS) ? CORS_ORIGINS.join(', ') : CORS_ORIGINS;
console.log(`[CORS] Allowed origins: ${originsDisplay}`);

// Warn about insecure CORS in production
const isProduction = process.env.NODE_ENV === 'production';
if (CORS_ORIGINS === '*' && isProduction) {
  console.warn('[WARNING] CORS is set to wildcard (*) in production mode. This is insecure!');
  console.warn('[WARNING] Please set CORS_ORIGINS environment variable to restrict allowed origins.');
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 30000,
  pingTimeout: 60000,
  upgradeTimeout: 30000,
  allowUpgrades: true,
  cookie: false
});

// ============================================
// Native WebSocket Server (ClawPilot 兼容)
// ============================================

// 创建独立的 WebSocket 服务器用于 relay
const relayWSS = new WebSocket.Server({ noServer: true });

// 存储 relay 客户端连接
const relayClients = new Map(); // gatewayId -> { ws, authenticated, deviceInfo }

// 处理 HTTP 升级请求
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  // 处理 /relay 路径
  if (pathname === '/relay' || pathname.startsWith('/relay/')) {
    relayWSS.handleUpgrade(request, socket, head, (ws) => {
      relayWSS.emit('connection', ws, request);
    });
  }
});

// 处理 relay WebSocket 连接
relayWSS.on('connection', (ws, request) => {
  console.log(`[Relay-WS] Client connected: ${request.socket.remoteAddress}`);

  let authenticatedGatewayId = null;
  let deviceInfo = null;

  // 发送消息到客户端
  const sendFrame = (frame) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  };

  // 发送响应帧
  const sendResponse = (id, ok, payload, error) => {
    const frame = {
      type: 'res',
      id,
      ok,
      ...(ok ? { payload } : { error: { message: error } })
    };
    sendFrame(frame);
  };

  // 发送事件帧
  const sendEvent = (event, payload) => {
    const frame = { type: 'event', event, payload };
    sendFrame(frame);
  };

  // 处理收到的消息
  ws.on('message', (data) => {
    const raw = typeof data === 'string' ? data : data.toString();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const { type, id, method, params } = parsed;

    // 处理请求帧
    if (type === 'req') {
      if (method === 'relay.auth') {
        // 认证
        const { gatewayId, accessCode } = params || {};

        if (!gatewayId || !accessCode) {
          sendResponse(id, false, null, 'Missing gatewayId or accessCode');
          return;
        }

        relayService.verifyAccessCode(gatewayId, accessCode)
          .then((result) => {
            if (!result.valid) {
              sendResponse(id, false, null, result.error);
              return;
            }

            authenticatedGatewayId = gatewayId;
            deviceInfo = {
              gatewayId: result.device.gatewayId,
              displayName: result.device.displayName,
            };

            // 存储连接
            relayClients.set(gatewayId, { ws, authenticated: true, deviceInfo });

            console.log(`[Relay-WS] Client authenticated: ${gatewayId}`);

            sendResponse(id, true, { device: deviceInfo });
          })
          .catch((error) => {
            sendResponse(id, false, null, error.message);
          });
        return;
      }

      // 检查认证状态
      if (!authenticatedGatewayId) {
        sendResponse(id, false, null, 'Not authenticated');
        return;
      }

      // 处理 relay.to_device
      if (method === 'relay.to_device') {
        const { method: deviceMethod, params: deviceParams } = params || {};

        // 转发到设备 (通过 Socket.IO relay namespace)
        relayIO.to(`device_${authenticatedGatewayId}`).emit('from_client', {
          method: deviceMethod,
          params: deviceParams,
        });

        sendResponse(id, true, { ok: true });
        return;
      }

      // 处理 relay.connect_gateway
      if (method === 'relay.connect_gateway') {
        // 转发请求到设备
        relayIO.to(`device_${authenticatedGatewayId}`).emit('gateway_connect_request', {
          clientId: 'relay-ws-client',
        });

        sendResponse(id, true, { ok: true });
        return;
      }

      // 未知方法
      sendResponse(id, false, null, `Unknown method: ${method}`);
      return;
    }
  });

  // 处理断开连接
  ws.on('close', () => {
    console.log(`[Relay-WS] Client disconnected: ${authenticatedGatewayId || 'unknown'}`);

    if (authenticatedGatewayId) {
      relayClients.delete(authenticatedGatewayId);

      // 通知设备客户端断开
      relayIO.to(`device_${authenticatedGatewayId}`).emit('client_disconnected', {
        clientId: 'relay-ws-client',
      });
    }
  });

  // 处理错误
  ws.on('error', (error) => {
    console.error(`[Relay-WS] Error: ${error.message}`);
  });
});

const ENABLE_LEGACY_BOT_RESPONSE = process.env.ENABLE_LEGACY_BOT_RESPONSE === 'true';
const ENABLE_STUDY_ROOM_SOCKET = process.env.ENABLE_STUDY_ROOM_SOCKET !== 'false';
const DEDUP_TTL_MS = Number(process.env.MESSAGE_DEDUP_TTL_MS || 10000);
const BOT_HEARTBEAT_TIMEOUT_MS = Number(process.env.BOT_HEARTBEAT_TIMEOUT_MS || 45000);

const connectedBots = new Map();
const connectedBotMeta = new Map();
const botSockets = connectedBots;
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

function bindConnectedBot(deviceId, socket, pairingId = null, reason = 'register') {
  if (!deviceId || !socket) {
    return;
  }

  connectedBots.set(deviceId, socket);
  connectedBotMeta.set(deviceId, {
    socketId: socket.id,
    pairingId: pairingId || null,
    lastSeenAt: now(),
    reason
  });

  socket.deviceId = deviceId;
  socket.isBot = true;
  if (pairingId) {
    socket.pairingId = pairingId;
  }
}

function touchConnectedBot(deviceId, socket = null, pairingId = null, reason = 'heartbeat') {
  if (!deviceId) {
    return;
  }

  const existingSocket = connectedBots.get(deviceId);
  const targetSocket = socket || existingSocket || null;
  if (!targetSocket) {
    return;
  }

  if (!existingSocket || existingSocket.id !== targetSocket.id) {
    connectedBots.set(deviceId, targetSocket);
  }

  const prev = connectedBotMeta.get(deviceId) || {};
  connectedBotMeta.set(deviceId, {
    socketId: targetSocket.id,
    pairingId: pairingId || prev.pairingId || null,
    lastSeenAt: now(),
    reason
  });
}

function getConnectedBot(deviceId) {
  if (!deviceId) {
    return null;
  }

  const socket = connectedBots.get(deviceId);
  if (!socket) {
    return null;
  }

  if (!socket.connected) {
    connectedBots.delete(deviceId);
    connectedBotMeta.delete(deviceId);
    return null;
  }

  const meta = connectedBotMeta.get(deviceId);
  if (meta && now() - meta.lastSeenAt > BOT_HEARTBEAT_TIMEOUT_MS) {
    connectedBots.delete(deviceId);
    connectedBotMeta.delete(deviceId);
    return null;
  }

  return socket;
}

function removeConnectedBotIfMatches(deviceId, socketId) {
  if (!deviceId || !socketId) {
    return false;
  }

  const mappedSocket = connectedBots.get(deviceId);
  if (!mappedSocket) {
    connectedBotMeta.delete(deviceId);
    return false;
  }

  if (mappedSocket.id !== socketId) {
    return false;
  }

  connectedBots.delete(deviceId);
  connectedBotMeta.delete(deviceId);
  return true;
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
  const mediaMimeType = data.mediaMimeType ?? data.media_mime_type ?? null;
  const messageId = data.messageId ?? data.msg_id ?? data.id ?? makeFallbackMessageId('app');
  const threadId = data.threadId ?? data.thread_id ?? 'default';
  const userId = socketUserId ?? data.userId ?? data.user_id ?? null;

  return {
    userId,
    content: typeof content === 'string' ? content : String(content ?? ''),
    contentType,
    mediaUrl,
    mediaMimeType,
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
  const mediaMimeType = data.mediaMimeType ?? data.media_mime_type ?? null;
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
    mediaMimeType,
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

function hasMessagePayload(content, mediaUrl) {
  return Boolean((typeof content === 'string' && content.trim()) || mediaUrl);
}

function getMediaPlaceholder(contentType) {
  if (contentType === 'image' || contentType === 'mixed') {
    return '[image]';
  }
  return '[media]';
}

function normalizeMediaOnlyContent(content, contentType, mediaUrl) {
  const normalizedContent = typeof content === 'string' ? content : String(content ?? '');
  if (normalizedContent.trim()) {
    return normalizedContent;
  }
  if (!mediaUrl) {
    return normalizedContent;
  }
  return getMediaPlaceholder(contentType);
}

function resolveStudyRoomUserId(socket, data = {}) {
  const socketUserId = socket?.userId ?? null;
  const payloadUserId = data?.userId ?? data?.user_id ?? null;
  if (socketUserId && payloadUserId && socketUserId !== payloadUserId) {
    console.warn(
      `[StudyRoom] userId mismatch socket=${socketUserId} payload=${payloadUserId}, using socket user`
    );
  }
  return socketUserId || payloadUserId || null;
}

function toStudyRoomErrorPayload(error, fallbackMessage = 'Study room operation failed') {
  return {
    success: false,
    code: error?.code || 'UNKNOWN_ERROR',
    error: error?.message || fallbackMessage
  };
}

function emitStudyRoomStateUpdate(update) {
  if (!update || !update.roomCode) {
    return;
  }

  io.to(`study_room_${update.roomCode}`).emit('study_room_state', {
    roomCode: update.roomCode,
    reason: update.reason || 'update',
    room: update.room || null,
    serverTs: now()
  });
}

function emitStudyRoomStateUpdates(updates = []) {
  for (const update of updates) {
    emitStudyRoomStateUpdate(update);
  }
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

app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret']
}));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

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

const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many TTS requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

initDatabase();
messageService.initMessageTable().catch((error) => {
  console.error('[MessageService] initMessageTable failed:', error);
});

// ============================================
// Auth API Routes
// ============================================
const authRoutes = require('./routes/auth');
app.use('/api', authRoutes);

// ============================================
// Payments API Routes
// ============================================
const paymentsRoutes = require('./routes/payments');
app.use('/api', paymentsRoutes);

// ============================================
// MVP API Routes
// ============================================
const mvpRoutes = require('./routes/mvp');
app.use('/api', mvpRoutes);

// ============================================
// Extended API Routes
// ============================================
const extendedRoutes = require('./routes/extended');
app.use('/api', extendedRoutes);

// ============================================
// Supplement API Routes
// ============================================
const supplementRoutes = require('./routes/supplement');
app.use('/api', supplementRoutes);

// ============================================
// Gateway API Routes
// ============================================

// Gateway connection status
app.get('/api/gateway/status', async (req, res) => {
  res.json({
    connected: gatewayClientService.isConnected(),
    deviceId: gatewayClientService.getDeviceId(),
  });
});

// Connect to Gateway via server relay
app.post('/api/gateway/connect', async (req, res) => {
  try {
    const { url, token, password, deviceId, deviceKey } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // If already connected, disconnect first
    if (gatewayClientService.isConnected()) {
      gatewayClientService.disconnect();
    }

    await gatewayClientService.connect(url, token, password, deviceId, deviceKey);

    res.json({
      success: true,
      deviceId: gatewayClientService.getDeviceId(),
    });
  } catch (error) {
    console.error('[Gateway] Connect failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect from Gateway
app.post('/api/gateway/disconnect', async (req, res) => {
  try {
    gatewayClientService.disconnect();
    res.json({ success: true });
  } catch (error) {
    console.error('[Gateway] Disconnect failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gateway RPC request
app.post('/api/gateway/rpc', async (req, res) => {
  try {
    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({ error: 'Missing method parameter' });
    }

    if (!gatewayClientService.isConnected()) {
      return res.status(503).json({ error: 'Gateway not connected' });
    }

    const result = await gatewayClientService.request(method, params);
    res.json(result);
  } catch (error) {
    console.error('[Gateway] RPC failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Provider API Routes
// ============================================

// List providers
app.get('/api/providers', async (req, res) => {
  try {
    const providers = providerService.list();
    res.json({ providers });
  } catch (error) {
    console.error('[Provider] List failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get provider details
app.get('/api/providers/:id', async (req, res) => {
  try {
    const provider = providerService.get(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json(provider);
  } catch (error) {
    console.error('[Provider] Get failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add/update provider
app.post('/api/providers', async (req, res) => {
  try {
    const { id, name, apiBase, apiKey, models, defaultModel } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Provider ID is required' });
    }

    const provider = providerService.add({
      id,
      name,
      apiBase,
      apiKey,
      models,
      defaultModel,
    });

    res.json({ success: true, provider });
  } catch (error) {
    console.error('[Provider] Add failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete provider
app.delete('/api/providers/:id', async (req, res) => {
  try {
    providerService.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Provider] Delete failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set default provider
app.post('/api/providers/:id/default', async (req, res) => {
  try {
    providerService.setDefault(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Provider] Set default failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate provider API key
app.post('/api/providers/:id/validate', async (req, res) => {
  try {
    const { apiKey } = req.body;
    const result = await providerService.validateKey(req.params.id, apiKey);
    res.json(result);
  } catch (error) {
    console.error('[Provider] Validate failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Local Command API Routes
// ============================================

// Execute local command
app.post('/api/local/command', async (req, res) => {
  try {
    const { command, args = [] } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Missing command parameter' });
    }

    const result = await localCommandService.execute(command, args);
    res.json(result);
  } catch (error) {
    console.error('[Local] Command failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run doctor diagnostics
app.get('/api/local/doctor', async (req, res) => {
  try {
    const result = await localCommandService.doctor([]);
    res.json(result);
  } catch (error) {
    console.error('[Local] Doctor failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get logs
app.get('/api/local/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const result = await localCommandService.logs([limit.toString()]);
    res.json(result);
  } catch (error) {
    console.error('[Local] Logs failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Relay API Routes (ClawPilot 兼容)
// ============================================

// Register new device
app.post('/api/relay/register', async (req, res) => {
  try {
    const { displayName } = req.body;

    const result = await relayService.register(displayName);

    res.json(result);
  } catch (error) {
    console.error('[Relay] Register failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh access code
app.post('/api/relay/accesscode', async (req, res) => {
  try {
    const { gatewayId, relaySecret } = req.body;

    if (!gatewayId || !relaySecret) {
      return res.status(400).json({ error: 'Missing gatewayId or relaySecret' });
    }

    const result = await relayService.refreshAccessCode(gatewayId, relaySecret);

    res.json(result);
  } catch (error) {
    console.error('[Relay] Refresh access code failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify device credentials
app.post('/api/relay/verify', async (req, res) => {
  try {
    const { gatewayId, relaySecret } = req.body;

    if (!gatewayId || !relaySecret) {
      return res.status(400).json({ error: 'Missing gatewayId or relaySecret' });
    }

    const result = await relayService.verifyCredentials(gatewayId, relaySecret);

    res.json({
      valid: result.valid,
      device: result.valid ? {
        gatewayId: result.device.gatewayId,
        displayName: result.device.displayName,
      } : null,
      error: result.error
    });
  } catch (error) {
    console.error('[Relay] Verify failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get device info
app.get('/api/relay/device/:gatewayId', async (req, res) => {
  try {
    const { gatewayId } = req.params;

    const device = relayService.getDevice(gatewayId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      gatewayId: device.gatewayId,
      displayName: device.displayName,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
    });
  } catch (error) {
    console.error('[Relay] Get device failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/api/tts/synthesize', ttsLimiter, async (req, res) => {
  const rawBody = req.rawBody || '';
  console.log('[TTS] rawBody:', rawBody.toString());
  const { text, scene = 'bot_reply', messageId } = req.body || {};

  if (process.env.DOUBAO_TTS_ENABLED === 'false') {
    return res.status(503).json({
      success: false,
      error: 'TTS is disabled by server configuration'
    });
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'text is required'
    });
  }

  if (!['welcome', 'status', 'bot_reply'].includes(scene)) {
    return res.status(400).json({
      success: false,
      error: 'scene must be one of welcome/status/bot_reply'
    });
  }

  try {
    const result = await ttsService.synthesizeSpeech({
      text,
      scene,
      messageId
    });

    if (scene === 'bot_reply') {
      res.setHeader('Cache-Control', 'no-store');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(result.audioBuffer.length));
    return res.status(200).send(result.audioBuffer);
  } catch (error) {
    console.error('[TTS] synthesize failed:', {
      scene,
      messageId,
      textLength: typeof text === 'string' ? text.length : 0,
      error: error.message
    });
    return res.status(500).json({
      success: false,
      error: error.message || 'TTS synthesis failed'
    });
  }
});

app.post('/webhook/clawbot', async (req, res) => {
  const { deviceId, content, contentType, mediaUrl, mediaMimeType } = req.body;

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
      mediaMimeType,
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

async function handleUpload(req, res) {
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
      key: result.objectKey,
      objectKey: result.objectKey,
      filename: originalname,
      size: buffer.length,
      mimeType: mimetype,
      contentType: mimetype
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleBase64Upload(req, res) {
  try {
    const { base64Data, data, image } = req.body || {};
    const payload = base64Data || data || image;

    if (!payload) {
      return res.status(400).json({ error: 'No base64 data provided' });
    }

    const result = await ossService.uploadBase64(payload);
    if (!result) {
      return res.status(500).json({ error: 'Upload failed' });
    }

    return res.json({
      success: true,
      url: result.url,
      key: result.objectKey,
      objectKey: result.objectKey,
      filename: 'upload.jpg',
      size: Buffer.from(payload.split(',').pop() || '', 'base64').length,
      mimeType: 'image/jpeg',
      contentType: 'image/jpeg'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

app.post('/upload', uploadLimiter, upload.single('file'), handleUpload);
app.post('/api/upload', uploadLimiter, upload.single('file'), handleUpload);
app.post('/upload/base64', handleBase64Upload);
app.post('/api/upload/base64', handleBase64Upload);

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

// ============================================
// Relay WebSocket (ClawPilot 兼容)
// ============================================

const relayIO = io.of('/relay');

relayIO.on('connection', (socket) => {
  console.log(`[Relay] connected: ${socket.id}`);

  let authenticatedGatewayId = null;

  // Authenticate with access code
  socket.on('auth', async (data, callback) => {
    try {
      const { gatewayId, accessCode } = data || {};

      if (!gatewayId || !accessCode) {
        callback?.({ ok: false, error: 'Missing gatewayId or accessCode' });
        return;
      }

      const result = await relayService.verifyAccessCode(gatewayId, accessCode);

      if (!result.valid) {
        callback?.({ ok: false, error: result.error });
        return;
      }

      // Store gateway ID on socket
      authenticatedGatewayId = gatewayId;
      socket.gatewayId = gatewayId;

      // Register connection
      relayService.addConnection(gatewayId, socket);

      console.log(`[Relay] Device authenticated: ${gatewayId}`);

      callback?.({
        ok: true,
        device: {
          gatewayId: result.device.gatewayId,
          displayName: result.device.displayName,
        }
      });

      // Notify about connection
      socket.join(`device_${gatewayId}`);

    } catch (error) {
      console.error('[Relay] Auth error:', error);
      callback?.({ ok: false, error: error.message });
    }
  });

  // Forward message to app (via main socket.io)
  socket.on('to_app', (data, callback) => {
    if (!authenticatedGatewayId) {
      callback?.({ ok: false, error: 'Not authenticated' });
      return;
    }

    const { method, params } = data || {};

    // Broadcast to main socket.io room for this device
    io.to(`device_${authenticatedGatewayId}`).emit('from_relay', {
      method,
      params,
    });

    callback?.({ ok: true });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Relay] disconnected: ${socket.id}`);

    if (authenticatedGatewayId) {
      relayService.removeConnection(authenticatedGatewayId);
      socket.leave(`device_${authenticatedGatewayId}`);
    }
  });
});

// Relay WebSocket for apps (clients)
const relayClientIO = io.of('/relay-client');

relayClientIO.on('connection', (socket) => {
  console.log(`[Relay-Client] connected: ${socket.id}`);

  let authenticatedGatewayId = null;

  // Client authenticates with gatewayId
  socket.on('auth', async (data, callback) => {
    try {
      const { gatewayId, accessCode } = data || {};

      if (!gatewayId || !accessCode) {
        callback?.({ ok: false, error: 'Missing gatewayId or accessCode' });
        return;
      }

      // Verify access code
      const result = await relayService.verifyAccessCode(gatewayId, accessCode);

      if (!result.valid) {
        callback?.({ ok: false, error: result.error });
        return;
      }

      authenticatedGatewayId = gatewayId;
      socket.gatewayId = gatewayId;
      socket.join(`client_${gatewayId}`);

      console.log(`[Relay-Client] Client authenticated: ${gatewayId}`);

      callback?.({
        ok: true,
        device: {
          gatewayId: result.device.gatewayId,
          displayName: result.device.displayName,
        }
      });

    } catch (error) {
      console.error('[Relay-Client] Auth error:', error);
      callback?.({ ok: false, error: error.message });
    }
  });

  // Send message to device
  socket.on('to_device', (data, callback) => {
    if (!authenticatedGatewayId) {
      callback?.({ ok: false, error: 'Not authenticated' });
      return;
    }

    const { method, params } = data || {};

    // Forward to relay namespace (device)
    relayIO.to(`device_${authenticatedGatewayId}`).emit('from_client', {
      method,
      params,
    });

    callback?.({ ok: true });
  });

  // Request to connect to device's Gateway
  socket.on('connect_gateway', async (data, callback) => {
    if (!authenticatedGatewayId) {
      callback?.({ ok: false, error: 'Not authenticated' });
      return;
    }

    // Forward request to device
    relayIO.to(`device_${authenticatedGatewayId}`).emit('gateway_connect_request', {
      clientId: socket.id,
    });

    callback?.({ ok: true, message: 'Connection request sent' });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Relay-Client] disconnected: ${socket.id}`);

    if (authenticatedGatewayId) {
      socket.leave(`client_${authenticatedGatewayId}`);

      // Notify device
      relayIO.to(`device_${authenticatedGatewayId}`).emit('client_disconnected', {
        clientId: socket.id,
      });
    }
  });
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
        bindConnectedBot(deviceId, socket, existingPairing.id, 'bot_request_pairing:restore');

        if (existingPairing.user_id) {
          io.to(`user_${existingPairing.user_id}`).emit('bot_online', {
            deviceId,
            message: 'Clawbot reconnected',
            timestamp: now()
          });
        }

        callback?.({
          success: true,
          restored: true,
          pairingId: existingPairing.id,
          deviceId
        });
        return;
      }

      const pairing = await pairingService.createBotPairing(deviceId);
      const { qrImage } = await pairingService.generateQRCodeData(pairing.pairingToken);

      pairingToDevice.set(pairing.id, deviceId);
      bindConnectedBot(deviceId, socket, pairing.id, 'bot_request_pairing:create');

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
        deviceId,
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

      bindConnectedBot(deviceId, socket, pairingId, 'bot_confirm_pairing');

      if (pairing.user_id) {
        io.to(`user_${pairing.user_id}`).emit('pairing_success', {
          deviceId,
          deviceName: 'Clawbot'
        });
      }

      callback?.({ success: true, pairingId, deviceId });
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
      if (ENABLE_STUDY_ROOM_SOCKET) {
        studyRoomService.bindSocketUser(socket.id, userId);
      }
      return;
    }

    socket.userId = userId;
    socket.join(`user_${userId}`);
    if (ENABLE_STUDY_ROOM_SOCKET) {
      studyRoomService.bindSocketUser(socket.id, userId);
    }

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
          botOnline: Boolean(getConnectedBot(pairing.device_id)),
          pairedAt: pairing.paired_at
        });
      } else {
        callback?.({ success: true, paired: false });
      }
    } catch (error) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('study_room_create', (data, callback) => {
    if (!ENABLE_STUDY_ROOM_SOCKET) {
      callback?.({
        success: false,
        code: 'FEATURE_DISABLED',
        error: 'Study room realtime is disabled'
      });
      return;
    }

    try {
      const userId = resolveStudyRoomUserId(socket, data);
      const previousRoomCode = studyRoomService.getRoomCodeForUser(userId);
      const result = studyRoomService.createRoom({
        userId,
        displayName: data?.displayName,
        avatarUrl: data?.avatarUrl,
        maxMembers: data?.maxMembers
      });

      if (previousRoomCode && previousRoomCode !== result.roomCode) {
        socket.leave(`study_room_${previousRoomCode}`);
      }
      socket.join(`study_room_${result.roomCode}`);

      emitStudyRoomStateUpdates(result.updates);
      callback?.({
        success: true,
        roomCode: result.roomCode,
        room: result.room
      });
    } catch (error) {
      callback?.(toStudyRoomErrorPayload(error, 'Create room failed'));
    }
  });

  socket.on('study_room_join', (data, callback) => {
    if (!ENABLE_STUDY_ROOM_SOCKET) {
      callback?.({
        success: false,
        code: 'FEATURE_DISABLED',
        error: 'Study room realtime is disabled'
      });
      return;
    }

    try {
      const userId = resolveStudyRoomUserId(socket, data);
      const previousRoomCode = studyRoomService.getRoomCodeForUser(userId);
      const result = studyRoomService.joinRoom({
        userId,
        roomCode: data?.roomCode,
        displayName: data?.displayName,
        avatarUrl: data?.avatarUrl
      });

      if (previousRoomCode && previousRoomCode !== result.roomCode) {
        socket.leave(`study_room_${previousRoomCode}`);
      }
      socket.join(`study_room_${result.roomCode}`);

      emitStudyRoomStateUpdates(result.updates);
      callback?.({
        success: true,
        roomCode: result.roomCode,
        room: result.room
      });
    } catch (error) {
      callback?.(toStudyRoomErrorPayload(error, 'Join room failed'));
    }
  });

  socket.on('study_room_leave', (data, callback) => {
    if (!ENABLE_STUDY_ROOM_SOCKET) {
      callback?.({
        success: false,
        code: 'FEATURE_DISABLED',
        error: 'Study room realtime is disabled'
      });
      return;
    }

    try {
      const userId = resolveStudyRoomUserId(socket, data);
      const activeRoomCode = studyRoomService.getRoomCodeForUser(userId);
      const roomCode = data?.roomCode || activeRoomCode;
      const result = studyRoomService.leaveRoom({
        userId,
        roomCode,
        reason: 'leave'
      });

      if (roomCode) {
        socket.leave(`study_room_${roomCode}`);
      }

      emitStudyRoomStateUpdates(result.updates);
      callback?.({
        success: true,
        roomCode: result.roomCode,
        room: result.room
      });
    } catch (error) {
      callback?.(toStudyRoomErrorPayload(error, 'Leave room failed'));
    }
  });

  socket.on('study_room_host_action', (data, callback) => {
    if (!ENABLE_STUDY_ROOM_SOCKET) {
      callback?.({
        success: false,
        code: 'FEATURE_DISABLED',
        error: 'Study room realtime is disabled'
      });
      return;
    }

    try {
      const userId = resolveStudyRoomUserId(socket, data);
      const result = studyRoomService.hostAction({
        userId,
        roomCode: data?.roomCode,
        action: data?.action
      });

      emitStudyRoomStateUpdates(result.updates);
      callback?.({
        success: true,
        roomCode: result.roomCode,
        room: result.room
      });
    } catch (error) {
      callback?.(toStudyRoomErrorPayload(error, 'Host action failed'));
    }
  });

  socket.on('study_room_get_state', (data, callback) => {
    if (!ENABLE_STUDY_ROOM_SOCKET) {
      callback?.({
        success: false,
        code: 'FEATURE_DISABLED',
        error: 'Study room realtime is disabled'
      });
      return;
    }

    try {
      const userId = resolveStudyRoomUserId(socket, data);
      const result = studyRoomService.getRoomState({
        userId,
        roomCode: data?.roomCode
      });

      socket.join(`study_room_${result.roomCode}`);
      callback?.({
        success: true,
        roomCode: result.roomCode,
        room: result.room
      });
    } catch (error) {
      callback?.(toStudyRoomErrorPayload(error, 'Get room state failed'));
    }
  });

  async function handlePairWithCode(data, callback) {
    console.log('[handlePairWithCode] 收到配对请求:', JSON.stringify(data));
    try {
      const { code, userId } = data || {};
      console.log('[handlePairWithCode] code:', code, 'userId:', userId);
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

      if (!getConnectedBot(result.pairing.device_id)) {
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
  // socket.on('app_pair_with_code', handlePairWithCode);
  socket.on('pair_with_token', handlePairWithToken);
  socket.on('app_pair_with_token', handlePairWithToken);

  async function handleAppToBotMessage(rawData, sourceEvent) {
    let messageId = null;

    try {
      const normalized = normalizeAppPayload(rawData, socket.userId);
      const routedMessage = {
        ...normalized,
        content: normalizeMediaOnlyContent(normalized.content, normalized.contentType, normalized.mediaUrl)
      };
      messageId = routedMessage.messageId;

      if (!routedMessage.userId) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'User not registered'
        });
        return;
      }

      if (!hasMessagePayload(routedMessage.content, routedMessage.mediaUrl)) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Empty message'
        });
        return;
      }

      const dedupKey = buildDedupKey(`app:${routedMessage.userId}`, routedMessage);
      if (seenRecently(dedupKey)) {
        socket.emit('message_sent', { success: true, messageId, duplicate: true });
        return;
      }

      const pairing = await pairingService.getPairingByUserId(routedMessage.userId);
      if (!pairing || !pairing.device_id) {
        socket.emit('error', { message: 'Not paired with any bot' });
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Not paired with any bot'
        });
        return;
      }

      const requestedDeviceId = rawData?.deviceId ?? rawData?.device_id ?? null;
      let targetDeviceId = requestedDeviceId || pairing.device_id;
      if (requestedDeviceId && pairing.device_id && requestedDeviceId !== pairing.device_id) {
        console.warn(
          `[App] deviceId mismatch user=${routedMessage.userId}, requested=${requestedDeviceId}, paired=${pairing.device_id}, using paired device`
        );
        targetDeviceId = pairing.device_id;
      }

      await messageService.saveMessage(
        pairing.id,
        'app_to_bot',
        routedMessage.content,
        routedMessage.contentType,
        routedMessage.mediaUrl
      );

      const botSocket = getConnectedBot(targetDeviceId);
      if (!botSocket) {
        // Bot 不在线，尝试通过 Gateway 转发
        console.log(`[App] Bot 不在线，尝试通过 Gateway 转发消息: ${routedMessage.content.slice(0, 50)}...`);

        try {
          const gatewayResult = await gatewayService.sendChatMessage(routedMessage.content);

          // 解析 Gateway agent 响应
          let assistantContent = '';
          // 新版本格式: { payloads: [...] }，旧版本: { result: { payloads: [...] } }
          const payloads = gatewayResult?.result?.payloads || gatewayResult?.payloads;
          if (payloads && payloads[0]) {
            assistantContent = payloads[0].text || payloads[0].content || '';
          } else if (gatewayResult && gatewayResult.response) {
            assistantContent = gatewayResult.response;
          } else if (gatewayResult && gatewayResult.message) {
            assistantContent = gatewayResult.message;
          } else if (gatewayResult && gatewayResult.content) {
            assistantContent = gatewayResult.content;
          } else if (typeof gatewayResult === 'string') {
            assistantContent = gatewayResult;
          } else {
            assistantContent = '消息已收到';
          }

          console.log(`[App] Gateway 响应: ${assistantContent.slice(0, 50)}...`);

          // 将 Gateway 响应发送回 App
          socket.emit('bot_message', {
            content: assistantContent,
            contentType: 'text',
            messageId,
            timestamp: Date.now(),
            sourceEvent: 'gateway_response'
          });

          socket.emit('message_sent', {
            success: true,
            messageId
          });
          return;
        } catch (gatewayError) {
          console.error('[App] Gateway 转发失败:', gatewayError.message);
          socket.emit('error', {
            message: 'Bot is offline and Gateway unavailable',
            deviceId: targetDeviceId,
            hint: 'Please keep Clawbot connected and try again.'
          });
          socket.emit('message_sent', {
            success: false,
            messageId,
            error: 'Bot is offline and Gateway unavailable',
            deviceId: targetDeviceId
          });
          return;
        }
      }

      touchConnectedBot(targetDeviceId, botSocket, pairing.id, 'app_message_route');

      const appPayload = {
        messageId,
        userId: routedMessage.userId,
        deviceId: targetDeviceId,
        content: routedMessage.content,
        contentType: routedMessage.contentType,
        mediaUrl: routedMessage.mediaUrl,
        mediaMimeType: routedMessage.mediaMimeType,
        threadId: routedMessage.threadId,
        timestamp: routedMessage.timestamp,
        sourceEvent
      };

      botSocket.emit('app_message', appPayload);
      botSocket.emit('user_message', {
        text: routedMessage.content,
        content: routedMessage.content,
        messageId,
        userId: routedMessage.userId,
        deviceId: targetDeviceId,
        threadId: routedMessage.threadId,
        contentType: routedMessage.contentType,
        mediaUrl: routedMessage.mediaUrl,
        mediaMimeType: routedMessage.mediaMimeType,
        timestamp: routedMessage.timestamp,
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

  // ==================== 控制命令处理 ====================

  /**
   * 处理控制命令 - 转发给 Bot 端执行
   */
  async function handleControlCommand(rawData) {
    try {
      const { action, params = {} } = rawData;

      if (!action) {
        return { success: false, error: 'Missing action' };
      }

      // 获取用户配对信息
      const pairing = await pairingService.getPairingByUserId(socket.userId);
      if (!pairing || !pairing.device_id) {
        return { success: false, error: 'Not paired with any bot' };
      }

      const targetDeviceId = pairing.device_id;
      const botSocket = getConnectedBot(targetDeviceId);

      if (!botSocket) {
        return { success: false, error: 'Bot is offline' };
      }

      // 转发给 Bot 端执行
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Command timeout' });
        }, 60000); // 60秒超时

        botSocket.emit('control_command', { action, params }, (response) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });
    } catch (error) {
      console.error('[Control] handleControlCommand failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function handleBotToAppMessage(rawData, sourceEvent) {
    let messageId = null;

    try {
      const normalized = await normalizeBotPayload(rawData, socket);
      const routedMessage = {
        ...normalized,
        content: normalizeMediaOnlyContent(normalized.content, normalized.contentType, normalized.mediaUrl)
      };
      messageId = routedMessage.messageId;

      if (!routedMessage.deviceId) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Missing deviceId'
        });
        return;
      }

      if (!hasMessagePayload(routedMessage.content, routedMessage.mediaUrl)) {
        socket.emit('message_sent', {
          success: false,
          messageId,
          error: 'Empty message'
        });
        return;
      }

      touchConnectedBot(routedMessage.deviceId, socket, socket.pairingId ?? null, sourceEvent);

      const dedupKey = buildDedupKey(`bot:${routedMessage.deviceId}`, routedMessage);
      if (seenRecently(dedupKey)) {
        socket.emit('message_sent', { success: true, messageId, duplicate: true });
        return;
      }

      const pairing = await pairingService.getPairingByDeviceId(routedMessage.deviceId);
      if (!pairing || pairing.status !== 'paired') {
        socket.emit('error', {
          message: 'Not paired or invalid pairing status',
          deviceId: routedMessage.deviceId
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
        routedMessage.content,
        routedMessage.contentType,
        routedMessage.mediaUrl
      );

      const appPayload = {
        content: routedMessage.content,
        contentType: routedMessage.contentType,
        mediaUrl: routedMessage.mediaUrl,
        mediaMimeType: routedMessage.mediaMimeType,
        timestamp: routedMessage.timestamp,
        messageId,
        sourceEvent
      };

      io.to(`user_${pairing.user_id}`).emit('bot_message', appPayload);

      if (ENABLE_LEGACY_BOT_RESPONSE) {
        io.to(`user_${pairing.user_id}`).emit('bot_response', {
          response: routedMessage.content,
          messageId,
          timestamp: new Date(routedMessage.timestamp).toISOString(),
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

  // 控制命令
  socket.on('control_command', async (data, callback) => {
    try {
      const result = await handleControlCommand(data);
      callback?.(result);
    } catch (error) {
      console.error('[Control] control_command error:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('ping', (data, callback) => {
    const pingDeviceId = data?.deviceId ?? socket.deviceId ?? null;
    const pingPairingId = data?.pairingId ?? socket.pairingId ?? null;
    if (pingDeviceId && (socket.isBot || data?.role === 'bot')) {
      touchConnectedBot(pingDeviceId, socket, pingPairingId, 'ping');
    }

    const payload = {
      ok: true,
      timestamp: now(),
      deviceId: pingDeviceId,
      registered: Boolean(pingDeviceId && getConnectedBot(pingDeviceId))
    };

    if (typeof callback === 'function') {
      callback(payload);
    } else {
      socket.emit('pong', payload);
    }
  });

  socket.on('bot_keepalive', (data, callback) => {
    const keepaliveDeviceId = data?.deviceId ?? socket.deviceId ?? null;
    const keepalivePairingId = data?.pairingId ?? socket.pairingId ?? null;

    if (!keepaliveDeviceId) {
      callback?.({ success: false, error: 'Missing deviceId' });
      return;
    }

    bindConnectedBot(keepaliveDeviceId, socket, keepalivePairingId, 'bot_keepalive');
    callback?.({
      success: true,
      timestamp: now(),
      deviceId: keepaliveDeviceId
    });
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

  // ============================================
  // Gateway Socket.IO Events
  // ============================================

  // Gateway RPC via Socket.IO
  socket.on('gateway_rpc', async (data, callback) => {
    try {
      const { method, params } = data || {};

      if (!method) {
        callback?.({ success: false, error: 'Missing method parameter' });
        return;
      }

      if (!gatewayClientService.isConnected()) {
        callback?.({ success: false, error: 'Gateway not connected' });
        return;
      }

      const result = await gatewayClientService.request(method, params);
      callback?.({ success: true, data: result });
    } catch (error) {
      console.error('[Gateway] RPC error:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  // Subscribe to Gateway events
  socket.on('gateway_subscribe', (data, callback) => {
    const { events } = data || [];

    if (!Array.isArray(events) || events.length === 0) {
      callback?.({ success: false, error: 'Missing events parameter' });
      return;
    }

    // Subscribe to each event
    for (const event of events) {
      gatewayClientService.on(event, (payload) => {
        socket.emit('gateway_event', { event, payload });
      });
    }

    callback?.({ success: true });
  });

  // Unsubscribe from Gateway events
  socket.on('gateway_unsubscribe', (data, callback) => {
    const { events } = data || [];

    if (!Array.isArray(events) || events.length === 0) {
      callback?.({ success: false, error: 'Missing events parameter' });
      return;
    }

    // Unsubscribe from each event
    for (const event of events) {
      gatewayClientService.removeAllListeners(event);
    }

    callback?.({ success: true });
  });

  // Get Gateway status via Socket.IO
  socket.on('gateway_status', (data, callback) => {
    callback?.({
      connected: gatewayClientService.isConnected(),
      deviceId: gatewayClientService.getDeviceId(),
    });
  });

  // Forward chat message to Gateway
  socket.on('gateway_chat', async (data, callback) => {
    try {
      const { sessionKey, message } = data || {};

      if (!message) {
        callback?.({ success: false, error: 'Missing message parameter' });
        return;
      }

      if (!gatewayClientService.isConnected()) {
        callback?.({ success: false, error: 'Gateway not connected' });
        return;
      }

      const sessionId = sessionKey ? sessionKey.split(':').pop() : 'main';
      const result = await gatewayClientService.request('chat.send', {
        sessionId,
        message,
      });

      callback?.({ success: true, data: result });
    } catch (error) {
      console.error('[Gateway] Chat error:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] disconnected: ${socket.id}, total=${io.sockets.sockets.size}`);

    if (ENABLE_STUDY_ROOM_SOCKET) {
      const { updates } = studyRoomService.handleDisconnect(socket.id);
      if (updates.length > 0) {
        emitStudyRoomStateUpdates(updates);
      }
    }

    if (socket.deviceId) {
      const removed = removeConnectedBotIfMatches(socket.deviceId, socket.id);
      if (!removed) {
        return;
      }

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
