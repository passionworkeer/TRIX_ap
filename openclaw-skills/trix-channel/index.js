/**
 * TRIX App Channel for OpenClaw
 *
 * Compatibility goals:
 * - Receive both app_message and user_message from server.
 * - Send both bot_message and bot_response back to server (legacy toggle).
 * - Normalize message fields and deduplicate repeated events.
 */

const { io } = require('socket.io-client');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { WebSocket } = require('ws');

const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://47.243.55.130:8765';
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
const AUTH_FILE = path.join(__dirname, 'trix-auth.json');

const ENABLE_LEGACY_BOT_RESPONSE = process.env.ENABLE_LEGACY_BOT_RESPONSE !== 'false';
const DEDUP_TTL_MS = Number(process.env.MESSAGE_DEDUP_TTL_MS || 10000);
const ENABLE_GATEWAY_CHAT_BRIDGE = process.env.ENABLE_GATEWAY_CHAT_BRIDGE !== 'false';
const ENABLE_CLI_AGENT_BRIDGE = process.env.ENABLE_CLI_AGENT_BRIDGE === 'true';
const OPENCLAW_CLI_BIN_HINT = process.env.OPENCLAW_CLI_BIN || null;
const CLI_AGENT_TIMEOUT_SECONDS = Number(process.env.CLI_AGENT_TIMEOUT_SECONDS || 120);
const CLI_MAX_BUFFER_BYTES = Number(process.env.CLI_MAX_BUFFER_BYTES || 10 * 1024 * 1024);
const GATEWAY_CLIENT_ID = process.env.GATEWAY_CLIENT_ID || 'gateway-client';
const GATEWAY_CLIENT_MODE = process.env.GATEWAY_CLIENT_MODE || 'backend';
const GATEWAY_ROLE = process.env.GATEWAY_ROLE || 'operator';
const GATEWAY_SESSION_KEY = process.env.GATEWAY_SESSION_KEY || 'agent:main:main';
const OPENCLAW_STATE_DIR = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), '.openclaw');
const OPENCLAW_DEVICE_IDENTITY_FILE =
  process.env.OPENCLAW_DEVICE_IDENTITY_FILE ||
  path.join(OPENCLAW_STATE_DIR, 'identity', 'device.json');
const OPENCLAW_DEVICE_AUTH_FILE =
  process.env.OPENCLAW_DEVICE_AUTH_FILE ||
  path.join(OPENCLAW_STATE_DIR, 'identity', 'device-auth.json');
const DEFAULT_GATEWAY_SCOPES = ['operator.admin', 'operator.approvals', 'operator.pairing'];
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const HEARTBEAT_INTERVAL_MS = Number(process.env.ADAPTER_HEARTBEAT_INTERVAL_MS || 15000);
const REGISTER_TIMEOUT_MS = Number(process.env.ADAPTER_REGISTER_TIMEOUT_MS || 12000);

let serverSocket = null;
let gatewayWs = null;
let isConnectedToServer = false;
let isConnectedToGateway = false;
let heartbeatInterval = null;
let gatewayReconnectTimer = null;

let deviceId = null;
let pairingId = null;
let lastSentMessageId = null;
let registerInFlight = null;
let gatewayConnectRequestId = 'c1';
let gatewayConnectNonce = null;
let gatewaySharedToken = null;
let gatewayDeviceIdentity = null;
let gatewayDeviceToken = null;
let gatewayDeviceScopes = [...DEFAULT_GATEWAY_SCOPES];

const inboundDedup = new Map();
const pendingGatewayRequests = new Map();
const cliThreadQueues = new Map();
const deliveredGatewayRuns = new Set();

function makeMessageId(prefix = 'msg') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneDedup() {
  const t = Date.now();
  for (const [k, expiresAt] of inboundDedup.entries()) {
    if (expiresAt <= t) {
      inboundDedup.delete(k);
    }
  }
}

function seenInbound(key) {
  pruneDedup();
  if (inboundDedup.has(key)) {
    return true;
  }
  inboundDedup.set(key, Date.now() + DEDUP_TTL_MS);
  return false;
}

function toTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return Date.now();
}

function normalizeHomePath(input) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Git Bash style: /c/Users/name
  const m = input.match(/^\/([a-zA-Z])\/(.*)$/);
  if (m) {
    const drive = `${m[1].toUpperCase()}:`;
    const rest = m[2].replace(/\//g, path.sep);
    return path.join(drive + path.sep, rest);
  }

  return input;
}

function candidateConfigPaths() {
  const roots = new Set();

  if (process.env.USERPROFILE) {
    roots.add(process.env.USERPROFILE);
  }
  if (process.env.HOME) {
    roots.add(normalizeHomePath(process.env.HOME));
  }
  roots.add(os.homedir());

  return Array.from(roots)
    .filter(Boolean)
    .map((root) => path.join(root, '.openclaw', 'openclaw.json'));
}

function tryReadGatewayTokenFromFile() {
  for (const configPath of candidateConfigPaths()) {
    try {
      if (!fs.existsSync(configPath)) {
        continue;
      }
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const token = config?.gateway?.auth?.token;
      if (token && token.length > 10) {
        console.log(`[TRIXChannel] gateway token loaded from ${configPath}`);
        return token;
      }
    } catch (error) {
      console.warn(`[TRIXChannel] failed reading ${configPath}: ${error.message}`);
    }
  }

  return null;
}

function tryReadGatewayTokenFromCli() {
  const commands = [
    ['claw', ['config', 'get', 'gateway.auth.token']],
    ['openclaw', ['config', 'get', 'gateway.auth.token']]
  ];

  for (const [bin, args] of commands) {
    try {
      const out = execFileSync(bin, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();

      if (out && out.length > 10) {
        console.log(`[TRIXChannel] gateway token loaded via CLI: ${bin}`);
        return out;
      }
    } catch (_error) {
      // ignore and try next command
    }
  }

  return null;
}

function getGatewayToken() {
  if (process.env.GATEWAY_TOKEN && process.env.GATEWAY_TOKEN.length > 10) {
    return process.env.GATEWAY_TOKEN;
  }

  return tryReadGatewayTokenFromFile() || tryReadGatewayTokenFromCli();
}

function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn(`[TRIXChannel] failed reading json ${filePath}: ${error.message}`);
    return null;
  }
}

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const der = key.export({ type: 'spki', format: 'der' });
  const raw =
    der.length === ED25519_SPKI_PREFIX.length + 32 &&
    der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
      ? der.subarray(ED25519_SPKI_PREFIX.length)
      : der;
  return base64UrlEncode(raw);
}

function signDevicePayload(privateKeyPem, payload) {
  const key = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
  return base64UrlEncode(signature);
}

function buildDeviceAuthPayload({
  deviceId,
  clientId,
  clientMode,
  role,
  scopes,
  signedAtMs,
  token,
  nonce
}) {
  const version = nonce ? 'v2' : 'v1';
  const base = [
    version,
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(','),
    String(signedAtMs),
    token || ''
  ];

  if (version === 'v2') {
    base.push(nonce || '');
  }

  return base.join('|');
}

function loadGatewayDeviceIdentity() {
  const identity = readJsonFileSafe(OPENCLAW_DEVICE_IDENTITY_FILE);
  if (!identity) {
    return null;
  }

  if (
    typeof identity.deviceId !== 'string' ||
    typeof identity.publicKeyPem !== 'string' ||
    typeof identity.privateKeyPem !== 'string'
  ) {
    return null;
  }

  try {
    return {
      deviceId: identity.deviceId,
      publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
      privateKeyPem: identity.privateKeyPem
    };
  } catch (error) {
    console.warn(`[TRIXChannel] invalid gateway device identity: ${error.message}`);
    return null;
  }
}

function loadGatewayDeviceAuth(role = GATEWAY_ROLE) {
  const auth = readJsonFileSafe(OPENCLAW_DEVICE_AUTH_FILE);
  const tokenEntry = auth?.tokens?.[role];
  if (!tokenEntry || typeof tokenEntry.token !== 'string' || tokenEntry.token.length < 8) {
    return null;
  }

  return {
    token: tokenEntry.token,
    scopes:
      Array.isArray(tokenEntry.scopes) && tokenEntry.scopes.length > 0
        ? tokenEntry.scopes
        : [...DEFAULT_GATEWAY_SCOPES]
  };
}

function resolveGatewaySessionKey(normalized) {
  const threadId = normalized.threadId ? String(normalized.threadId).trim() : '';
  if (threadId.length > 0) {
    return `trix:${threadId}`;
  }

  if (pairingId) {
    return `trix:pairing:${pairingId}`;
  }

  return GATEWAY_SESSION_KEY;
}

function buildGatewayUserMessage(normalized) {
  const payload = withMaterializedContent(normalized);
  if (!payload.mediaUrl) {
    return payload.content;
  }

  const mediaLine = `${getMediaPlaceholder(payload.contentType)} ${payload.mediaUrl}`;
  if (!payload.content.trim() || payload.content === getMediaPlaceholder(payload.contentType)) {
    return mediaLine;
  }

  return `${payload.content}\n\n${mediaLine}`;
}

function extractGatewayMessageText(message) {
  if (!message) {
    return '';
  }

  if (typeof message === 'string') {
    return message.trim();
  }

  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const parts = message.content
      .map((part) => (typeof part?.text === 'string' ? part.text.trim() : ''))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  return '';
}

function sendGatewayConnectRequest() {
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
    return;
  }

  const authToken = gatewayDeviceToken || gatewaySharedToken;
  if (!authToken) {
    console.warn('[TRIXChannel] gateway auth token unavailable');
    return;
  }

  const role = GATEWAY_ROLE;
  const scopes =
    Array.isArray(gatewayDeviceScopes) && gatewayDeviceScopes.length > 0
      ? gatewayDeviceScopes
      : [...DEFAULT_GATEWAY_SCOPES];
  const signedAtMs = Date.now();

  const params = {
    minProtocol: 3,
    maxProtocol: 3,
    role,
    scopes,
    client: {
      id: GATEWAY_CLIENT_ID,
      displayName: 'TRIX App Channel',
      version: '2.2.0',
      platform: 'node',
      mode: GATEWAY_CLIENT_MODE,
      instanceId: deviceId || os.hostname()
    },
    auth: { token: authToken }
  };

  if (gatewayDeviceIdentity?.deviceId && gatewayDeviceIdentity?.privateKeyPem && gatewayDeviceIdentity?.publicKey) {
    const payload = buildDeviceAuthPayload({
      deviceId: gatewayDeviceIdentity.deviceId,
      clientId: GATEWAY_CLIENT_ID,
      clientMode: GATEWAY_CLIENT_MODE,
      role,
      scopes,
      signedAtMs,
      token: authToken,
      nonce: gatewayConnectNonce
    });

    params.device = {
      id: gatewayDeviceIdentity.deviceId,
      publicKey: gatewayDeviceIdentity.publicKey,
      signature: signDevicePayload(gatewayDeviceIdentity.privateKeyPem, payload),
      signedAt: signedAtMs,
      nonce: gatewayConnectNonce || undefined
    };
  }

  gatewayConnectRequestId = gatewayConnectNonce || 'c1';
  gatewayWs.send(
    JSON.stringify({
      type: 'req',
      id: gatewayConnectRequestId,
      method: 'connect',
      params
    })
  );
}

function loadAuth() {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  } catch (error) {
    console.warn(`[TRIXChannel] load auth failed: ${error.message}`);
    return null;
  }
}

function saveAuth(auth) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
  } catch (error) {
    console.error(`[TRIXChannel] save auth failed: ${error.message}`);
  }
}

function clearAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
  } catch (error) {
    console.warn(`[TRIXChannel] clear auth failed: ${error.message}`);
  }
}

function normalizeInboundAppMessage(data = {}) {
  const content = data.content ?? data.text ?? data.message ?? data.response ?? '';
  const messageId = data.messageId ?? data.msg_id ?? data.id ?? makeMessageId('app');

  return {
    messageId: String(messageId),
    content: typeof content === 'string' ? content : String(content ?? ''),
    contentType: data.contentType ?? data.content_type ?? 'text',
    mediaUrl: data.mediaUrl ?? data.media_url ?? null,
    mediaMimeType: data.mediaMimeType ?? data.media_mime_type ?? null,
    threadId: data.threadId ?? data.thread_id ?? 'default',
    userId: data.userId ?? data.user_id ?? null,
    timestamp: toTimestamp(data.timestamp),
    raw: data
  };
}

function normalizeGatewayReply(payload = {}) {
  const content =
    extractGatewayMessageText(payload.message ?? payload.response ?? payload.text ?? payload.content ?? payload) ||
    '';
  const messageId = payload.messageId ?? payload.id ?? payload.runId ?? makeMessageId('bot');

  return {
    messageId: String(messageId),
    content: typeof content === 'string' ? content : String(content ?? ''),
    contentType: payload.contentType ?? payload.content_type ?? 'text',
    mediaUrl: payload.mediaUrl ?? payload.media_url ?? null,
    mediaMimeType: payload.mediaMimeType ?? payload.media_mime_type ?? null,
    timestamp: toTimestamp(payload.timestamp ?? payload.message?.timestamp),
    raw: payload
  };
}

function getMediaPlaceholder(contentType) {
  if (contentType === 'image' || contentType === 'mixed') {
    return '[image]';
  }
  return '[media]';
}

function withMaterializedContent(normalized) {
  const content = typeof normalized.content === 'string' ? normalized.content : String(normalized.content ?? '');
  if (content.trim()) {
    return { ...normalized, content };
  }
  if (!normalized.mediaUrl) {
    return { ...normalized, content };
  }
  return { ...normalized, content: getMediaPlaceholder(normalized.contentType) };
}

function hasContentOrMedia(normalized) {
  return Boolean((normalized.content && normalized.content.trim()) || normalized.mediaUrl);
}

function buildCliPrompt(normalized) {
  const payload = withMaterializedContent(normalized);
  if (!payload.mediaUrl) {
    return payload.content;
  }

  const mediaLine = `${getMediaPlaceholder(payload.contentType)} ${payload.mediaUrl}`;
  if (!payload.content.trim() || payload.content === getMediaPlaceholder(payload.contentType)) {
    return mediaLine;
  }

  return `${payload.content}\n\n${mediaLine}`;
}

function getSessionId(normalized) {
  const raw =
    normalized.threadId ||
    pairingId ||
    deviceId ||
    'trix-default';

  const cleaned = String(raw).trim();
  return cleaned || 'trix-default';
}

function extractJsonBlock(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const raw = text.slice(start, end + 1);
  return JSON.parse(raw);
}

function extractAgentReply(data) {
  const payloads = data?.result?.payloads;
  if (Array.isArray(payloads)) {
    const parts = payloads
      .map((item) => (typeof item?.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean);
    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  if (typeof data?.result?.text === 'string' && data.result.text.trim()) {
    return data.result.text.trim();
  }

  if (typeof data?.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }

  return '';
}

function getCliAgentCommands() {
  const commands = [];

  if (OPENCLAW_CLI_BIN_HINT) {
    commands.push({ bin: OPENCLAW_CLI_BIN_HINT, prefixArgs: [] });
  }

  if (process.platform === 'win32') {
    const entryJs = 'C:\\nodejs_global\\node_modules\\openclaw-cn\\dist\\entry.js';
    if (fs.existsSync(entryJs)) {
      commands.push({
        bin: process.execPath || 'node',
        prefixArgs: [entryJs]
      });
    }

    const cmdShim = 'C:\\nodejs_global\\openclaw-cn.cmd';
    if (fs.existsSync(cmdShim)) {
      commands.push({ bin: cmdShim, prefixArgs: [] });
    }
  }

  commands.push({ bin: 'openclaw-cn', prefixArgs: [] });

  const deduped = [];
  const seen = new Set();
  for (const cmd of commands) {
    if (!cmd.bin) {
      continue;
    }
    const key = `${cmd.bin}::${(cmd.prefixArgs || []).join('|')}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(cmd);
  }

  return deduped;
}

function runCliAgentWithCommand(command, normalized) {
  return new Promise((resolve, reject) => {
    const sessionId = getSessionId(normalized);
    const prompt = buildCliPrompt(normalized);
    const args = [
      ...(command.prefixArgs || []),
      'agent',
      '--session-id',
      sessionId,
      '--message',
      prompt,
      '--json',
      '--timeout',
      String(CLI_AGENT_TIMEOUT_SECONDS)
    ];

    execFile(
      command.bin,
      args,
      {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: CLI_MAX_BUFFER_BYTES
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              `CLI failed (${command.bin}, ${error.code || 'unknown'}): ${(stderr || error.message || '').trim()}`
            )
          );
          return;
        }

        try {
          const data = extractJsonBlock(String(stdout || ''));
          if (!data) {
            reject(new Error(`CLI output missing JSON: ${(stdout || '').slice(0, 240)}`));
            return;
          }

          const reply = extractAgentReply(data);
          if (!reply) {
            reject(new Error('CLI response has no reply text'));
            return;
          }

          resolve({
            sessionId,
            content: reply
          });
        } catch (parseError) {
          reject(new Error(`CLI JSON parse failed: ${parseError.message}`));
        }
      }
    );
  });
}

async function runCliAgent(normalized) {
  const commands = getCliAgentCommands();
  let lastError = null;

  for (const command of commands) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await runCliAgentWithCommand(command, normalized);
    } catch (error) {
      lastError = error;
      if (String(error.message || '').includes('ENOENT')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('No available openclaw-cn binary');
}

async function bridgeViaCli(normalized, reason = 'fallback') {
  const started = Date.now();
  const result = await runCliAgent(normalized);
  console.log(
    `[TRIXChannel] cli bridge ok (${reason}) session=${result.sessionId} elapsed=${Date.now() - started}ms`
  );

  forwardToApp({
    messageId: makeMessageId('bot'),
    content: result.content,
    contentType: 'text',
    mediaUrl: null,
    timestamp: Date.now()
  });
}

function enqueueCliBridge(normalized, reason = 'fallback') {
  if (!ENABLE_CLI_AGENT_BRIDGE) {
    return Promise.resolve();
  }

  const sessionId = getSessionId(normalized);
  const tail = cliThreadQueues.get(sessionId) || Promise.resolve();
  const task = tail
    .catch(() => undefined)
    .then(() => bridgeViaCli(normalized, reason))
    .catch((error) => {
      console.error('[TRIXChannel] cli bridge failed:', error.message);
      throw error;
    })
    .finally(() => {
      if (cliThreadQueues.get(sessionId) === task) {
        cliThreadQueues.delete(sessionId);
      }
    });

  cliThreadQueues.set(sessionId, task);
  return task;
}

function forwardToGateway(normalized) {
  const payload = withMaterializedContent(normalized);

  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
    console.error('[TRIXChannel] gateway not connected, skip forwarding');
    return false;
  }

  if (!hasContentOrMedia(payload)) {
    console.warn('[TRIXChannel] empty app message, skip forwarding');
    return false;
  }

  lastSentMessageId = payload.messageId;
  const requestId = payload.messageId || makeMessageId('gw');
  const sessionKey = resolveGatewaySessionKey(payload);
  const message = buildGatewayUserMessage(payload);

  const req = {
    type: 'req',
    id: requestId,
    method: 'chat.send',
    params: {
      sessionKey,
      message,
      idempotencyKey: String(payload.messageId || requestId),
      deliver: false
    }
  };

  pendingGatewayRequests.set(requestId, {
    normalized: payload,
    createdAt: Date.now()
  });
  gatewayWs.send(JSON.stringify(req));
  return true;
}

function forwardToApp(normalized) {
  const payload = withMaterializedContent(normalized);

  if (!serverSocket || !isConnectedToServer) {
    console.error('[TRIXChannel] server not connected, skip app forward');
    return;
  }

  if (!hasContentOrMedia(payload)) {
    return;
  }

  const outboundPayload = {
    deviceId,
    content: payload.content,
    contentType: payload.contentType,
    mediaUrl: payload.mediaUrl,
    mediaMimeType: payload.mediaMimeType,
    timestamp: payload.timestamp,
    messageId: payload.messageId
  };

  serverSocket.emit('bot_message', outboundPayload);

  if (ENABLE_LEGACY_BOT_RESPONSE) {
    serverSocket.emit('bot_response', {
      pairingId,
      response: payload.content,
      messageId: payload.messageId,
      timestamp: new Date(payload.timestamp).toISOString()
    });
  }
}

function handleServerAppMessage(eventName, data) {
  const normalized = withMaterializedContent(normalizeInboundAppMessage(data));

  if (!hasContentOrMedia(normalized)) {
    return;
  }

  const dedupKey = normalized.messageId
    ? `app:${normalized.messageId}`
    : `app:${normalized.content.slice(0, 64)}:${Math.floor(normalized.timestamp / DEDUP_TTL_MS)}`;

  if (seenInbound(dedupKey)) {
    return;
  }

  console.log(
    `[TRIXChannel] app message (${eventName}): type=${normalized.contentType} media=${normalized.mediaUrl ? 'yes' : 'no'} text=${normalized.content.slice(0, 80)}`
  );

  if (ENABLE_GATEWAY_CHAT_BRIDGE && isConnectedToGateway) {
    const sent = forwardToGateway(normalized);
    if (sent) {
      return;
    }
  }

  if (!ENABLE_CLI_AGENT_BRIDGE) {
    console.warn('[TRIXChannel] both gateway bridge and cli bridge are disabled');
    return;
  }

  enqueueCliBridge(normalized, 'direct').catch(() => undefined);
}

function handleGatewayMessage(msg) {
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const nonce = msg?.payload?.nonce;
    if (typeof nonce === 'string' && nonce.trim()) {
      gatewayConnectNonce = nonce.trim();
      sendGatewayConnectRequest();
    }
    return;
  }

  if (msg.type === 'res') {
    if (msg.id === gatewayConnectRequestId || msg.id === 'c1' || msg.id === gatewayConnectNonce) {
      if (isConnectedToGateway) {
        return;
      }

      if (msg.ok) {
        isConnectedToGateway = true;
        gatewayConnectNonce = null;
        console.log('[TRIXChannel] gateway connected');
      } else {
        console.error('[TRIXChannel] gateway connect failed:', msg.error);
      }
      return;
    }

    const pending = pendingGatewayRequests.get(msg.id);
    if (pending) {
      pendingGatewayRequests.delete(msg.id);
    }

    if (!msg.ok) {
      console.warn(`[TRIXChannel] gateway request failed (${msg.id}): ${msg.error?.message || 'unknown'}`);
      if (pending && ENABLE_CLI_AGENT_BRIDGE) {
        enqueueCliBridge(pending.normalized, 'gateway-fallback').catch(() => undefined);
      }
    }
    return;
  }

  if (msg.type === 'event' && msg.event === 'chat' && ENABLE_GATEWAY_CHAT_BRIDGE) {
    const payload = msg.payload || {};
    const runId = typeof payload.runId === 'string' ? payload.runId : null;
    const state = typeof payload.state === 'string' ? payload.state : null;

    if (payload.role === 'user' || payload.sender === 'user' || payload.message?.role === 'user') {
      return;
    }

    if (state && state !== 'final') {
      return;
    }

    if (runId && deliveredGatewayRuns.has(runId)) {
      return;
    }

    const normalized = normalizeGatewayReply(payload);
    if (!normalized.content.trim()) {
      return;
    }

    if (normalized.messageId && normalized.messageId === lastSentMessageId) {
      return;
    }

    if (runId) {
      deliveredGatewayRuns.add(runId);
      if (deliveredGatewayRuns.size > 500) {
        deliveredGatewayRuns.clear();
      }
    }

    forwardToApp(normalized);
  }
}

function registerWithServer(reason = 'register') {
  if (!serverSocket || !serverSocket.connected) {
    return Promise.reject(new Error('server socket not connected'));
  }

  if (!deviceId) {
    deviceId = `trix_${os.hostname()}_${Date.now()}`;
  }

  if (registerInFlight) {
    return registerInFlight;
  }

  registerInFlight = new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      reject(new Error(`register timeout (${reason})`));
    }, REGISTER_TIMEOUT_MS);

    serverSocket.emit(
      'bot_request_pairing',
      { deviceId, pairingId, reason, timestamp: Date.now() },
      (response) => {
        if (finished) {
          return;
        }

        clearTimeout(timer);
        finished = true;

        if (!response?.success) {
          reject(new Error(response?.error || `pairing request failed (${reason})`));
          return;
        }

        pairingId = response.pairingId || pairingId || null;
        saveAuth({ deviceId, pairingId, savedAt: new Date().toISOString() });

        if (response.restored) {
          console.log(`[TRIXChannel] pairing restored: ${pairingId || 'unknown'} (${reason})`);
        } else if (response.pairingCode) {
          console.log(
            `[TRIXChannel] pairing code: ${response.pairingCode} (pairingId=${response.pairingId || 'unknown'}, ${reason})`
          );
        }

        resolve(response);
      }
    );
  })
    .finally(() => {
      registerInFlight = null;
    });

  return registerInFlight;
}

async function connectToServer() {
  return new Promise((resolve, reject) => {
    let resolved = false;

    serverSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    serverSocket.on('connect', () => {
      isConnectedToServer = true;
      registerWithServer('connect')
        .then(() => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        })
        .catch((error) => {
          if (!resolved) {
            resolved = true;
            reject(error);
            return;
          }

          console.error('[TRIXChannel] register after connect failed:', error.message);
        });
    });

    serverSocket.on('disconnect', (reason) => {
      isConnectedToServer = false;
      console.log(`[TRIXChannel] server disconnected: ${reason}`);
    });

    serverSocket.on('reconnect', () => {
      isConnectedToServer = true;
      registerWithServer('reconnect').catch((error) => {
        console.error('[TRIXChannel] register after reconnect failed:', error.message);
      });
    });

    if (serverSocket.io && typeof serverSocket.io.on === 'function') {
      serverSocket.io.on('reconnect', () => {
        isConnectedToServer = true;
        registerWithServer('manager_reconnect').catch((error) => {
          console.error('[TRIXChannel] register after manager reconnect failed:', error.message);
        });
      });
    }

    serverSocket.on('app_message', (data) => handleServerAppMessage('app_message', data));
    serverSocket.on('user_message', (data) => handleServerAppMessage('user_message', data));

    serverSocket.on('pairing_success', (data) => {
      console.log('[TRIXChannel] pairing success:', data?.pairingId || 'ok');
    });

    serverSocket.on('error', (error) => {
      console.error('[TRIXChannel] server error:', error);
    });

    serverSocket.on('connect_error', (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });

    setTimeout(() => {
      if (!resolved && !isConnectedToServer) {
        resolved = true;
        reject(new Error('connect server timeout'));
      }
    }, 15000);
  });
}

async function connectToGateway() {
  return new Promise((resolve) => {
    if (!ENABLE_GATEWAY_CHAT_BRIDGE) {
      console.log('[TRIXChannel] gateway chat bridge disabled; using CLI agent bridge');
      resolve();
      return;
    }

    gatewaySharedToken = getGatewayToken();
    if (!gatewaySharedToken) {
      console.warn('[TRIXChannel] gateway token not found, gateway bridge disabled');
      resolve();
      return;
    }

    gatewayDeviceIdentity = loadGatewayDeviceIdentity();
    const deviceAuth = loadGatewayDeviceAuth(GATEWAY_ROLE);
    gatewayDeviceToken = deviceAuth?.token || null;
    gatewayDeviceScopes = deviceAuth?.scopes || [...DEFAULT_GATEWAY_SCOPES];
    gatewayConnectNonce = null;
    gatewayConnectRequestId = 'c1';

    gatewayWs = new WebSocket(GATEWAY_URL);

    gatewayWs.on('open', () => {
      sendGatewayConnectRequest();
    });

    gatewayWs.on('message', (data) => {
      try {
        const msg = JSON.parse(String(data));
        handleGatewayMessage(msg);
      } catch (error) {
        console.warn('[TRIXChannel] invalid gateway message:', error.message);
      }
    });

    gatewayWs.on('error', (error) => {
      console.error('[TRIXChannel] gateway error:', error.message);
      if (!isConnectedToGateway) {
        resolve();
      }
    });

    gatewayWs.on('close', () => {
      isConnectedToGateway = false;
      if (gatewayReconnectTimer) {
        clearTimeout(gatewayReconnectTimer);
      }
      gatewayReconnectTimer = setTimeout(() => {
        connectToGateway().catch((error) => {
          console.error('[TRIXChannel] gateway reconnect failed:', error.message);
        });
      }, 3000);
    });

    setTimeout(() => resolve(), 5000);
  });
}

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (serverSocket && isConnectedToServer) {
      const timestamp = Date.now();
      const heartbeatPayload = {
        role: 'bot',
        deviceId,
        pairingId,
        timestamp
      };

      serverSocket.emit('bot_keepalive', heartbeatPayload, (response) => {
        if (!response?.success) {
          registerWithServer('heartbeat_keepalive_rebind').catch((error) => {
            console.error('[TRIXChannel] keepalive re-register failed:', error.message);
          });
        }
      });

      serverSocket.emit('ping', heartbeatPayload, (pong) => {
        if (pong?.registered === false) {
          registerWithServer('heartbeat_ping_rebind').catch((error) => {
            console.error('[TRIXChannel] ping re-register failed:', error.message);
          });
        }
      });
    }

    if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
      gatewayWs.send(JSON.stringify({
        type: 'req',
        id: makeMessageId('health'),
        method: 'health'
      }));
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (gatewayReconnectTimer) {
    clearTimeout(gatewayReconnectTimer);
    gatewayReconnectTimer = null;
  }
}

async function start() {
  console.log(
    `[TRIXChannel] start server=${SERVER_URL}, gateway=${GATEWAY_URL}, gatewayBridge=${ENABLE_GATEWAY_CHAT_BRIDGE}, cliBridge=${ENABLE_CLI_AGENT_BRIDGE}`
  );

  const saved = loadAuth();
  if (saved?.deviceId) {
    deviceId = saved.deviceId;
    pairingId = saved.pairingId || null;
  }

  await connectToServer();
  await connectToGateway();
  startHeartbeat();

  return { success: true };
}

async function stop() {
  stopHeartbeat();

  if (serverSocket) {
    serverSocket.disconnect();
    serverSocket = null;
  }

  if (gatewayWs) {
    gatewayWs.close();
    gatewayWs = null;
  }

  pendingGatewayRequests.clear();
  cliThreadQueues.clear();
  isConnectedToServer = false;
  isConnectedToGateway = false;

  return { success: true };
}

function getStatus() {
  return {
    isConnectedToServer,
    isConnectedToGateway,
    serverUrl: SERVER_URL,
    gatewayUrl: GATEWAY_URL,
    deviceId,
    pairingId,
    gatewayBridgeEnabled: ENABLE_GATEWAY_CHAT_BRIDGE,
    cliBridgeEnabled: ENABLE_CLI_AGENT_BRIDGE,
    cliBin: getCliAgentCommands()[0]?.bin || null,
    hasPersistentAuth: fs.existsSync(AUTH_FILE),
    message: isConnectedToServer ? 'running' : 'stopped'
  };
}

async function generatePairingCode() {
  if (!serverSocket || !isConnectedToServer) {
    return { success: false, error: 'Channel not started' };
  }

  return new Promise((resolve, reject) => {
    serverSocket.emit('bot_request_pairing', { deviceId }, (response) => {
      if (!response?.success) {
        reject(new Error(response?.error || 'pairing code generation failed'));
        return;
      }

      pairingId = response.pairingId;
      saveAuth({ deviceId, pairingId, savedAt: new Date().toISOString() });

      resolve({
        success: true,
        code: response.pairingCode,
        pairingId: response.pairingId,
        expiresAt: response.expiresAt
      });
    });

    setTimeout(() => reject(new Error('request timeout')), 5000);
  });
}

function resetPairing() {
  clearAuth();
  deviceId = null;
  pairingId = null;
}

module.exports = {
  start,
  stop,
  getStatus,
  generatePairingCode,
  resetPairing,

  id: 'trix-app',
  meta: {
    id: 'trix-app',
    label: 'TRIX App',
    selectionLabel: 'TRIX App (WebSocket)',
    docsPath: '/channels/trix-app',
    blurb: 'TRIX 3D Companion App Channel',
    aliases: ['trix', 'trixapp']
  },
  capabilities: {
    chatTypes: ['direct']
  },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.trixApp?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.trixApp?.accounts?.[accountId ?? 'default'] ?? { accountId: 'default' }
  }
};

if (require.main === module) {
  (async () => {
    try {
      await start();
      console.log('[TRIXChannel] running, press Ctrl+C to stop');
      process.on('SIGINT', async () => {
        await stop();
        process.exit(0);
      });
    } catch (error) {
      console.error('[TRIXChannel] failed to start:', error);
      process.exit(1);
    }
  })();
}
