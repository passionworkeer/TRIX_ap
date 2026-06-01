#!/usr/bin/env node
/**
 * Local AI Proxy — bridges canvas service to AIyi API.
 *
 * Handles two client patterns:
 *  A) Canvas service:        POST /generate  +  GET /tasks/:taskId
 *  B) TRIXAdapter (Python): POST /api/session  +  GET /api/session/:sessionId
 */

import http from 'node:http';
import https from 'node:https';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PROXY_PORT || 8790);
const HOST = process.env.PROXY_HOST || '127.0.0.1';
const AI_API_BASE = process.env.AI_API_BASE || 'https://api.apiyi.com';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_GENERATE_PATH = process.env.AI_GENERATE_PATH || '/anthropic/v1/messages';
const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
const AI_IMAGE_PATH = process.env.AI_IMAGE_PATH || `/v1beta/models/${AI_IMAGE_MODEL}:generateContent`;
const AI_IMAGE_TASK_PATH_TEMPLATE = process.env.AI_IMAGE_TASK_PATH_TEMPLATE || '/tasks/{taskId}';
// VEO 3.1: /v1/videos (async) — model variants: veo-3.1, veo-3.1-fast, veo-3.1-landscape, veo-3.1-fl, etc.
const AI_VIDEO_PATH = process.env.AI_VIDEO_PATH || '/v1/videos';
// Default: fast model for speed. Use AI_VIDEO_MODEL to override.
const AI_VIDEO_MODEL = process.env.AI_VIDEO_MODEL || 'veo-3.1-fast';
// Frame-to-video (首尾帧) requires -fl variant and multipart/form-data
const AI_VIDEO_I2V_MODEL = process.env.AI_VIDEO_I2V_MODEL || 'veo-3.1-fast-fl';
// Polling: /v1/videos/{video_id} — video_id is the id returned from creation
const AI_VIDEO_TASK_PATH_TEMPLATE = process.env.AI_VIDEO_TASK_PATH_TEMPLATE || '/v1/videos/{taskId}';
const MAX_BODY_BYTES = Number(process.env.PROXY_MAX_BODY_BYTES || 256 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.PROXY_REQUEST_TIMEOUT_MS || 120000);
const TASK_TTL_MS = Number(process.env.PROXY_TASK_TTL_MS || 60 * 60 * 1000);
const SESSION_TTL_MS = Number(process.env.PROXY_SESSION_TTL_MS || 60 * 60 * 1000);
const TASK_POLL_INTERVAL_MS = Number(process.env.PROXY_TASK_POLL_INTERVAL_MS || 2000);
const MAX_TASK_ENTRIES = readPositiveInteger(process.env.PROXY_MAX_TASKS, 500);
const MAX_SESSION_ENTRIES = readPositiveInteger(process.env.PROXY_MAX_SESSIONS, 500);
const ALLOWED_ORIGINS = parseOriginList(process.env.PROXY_ALLOWED_ORIGINS || '');
const PROXY_ALLOW_REMOTE = /^(1|true|yes)$/i.test(process.env.PROXY_ALLOW_REMOTE || '');
const PROXY_ACCESS_TOKEN = (process.env.PROXY_ACCESS_TOKEN || '').trim();

// In-memory stores for async polling
// taskId -> { status, output, urls, error, upstreamPollPath, upstreamTaskId, createdAt }
const tasks = new Map();
// sessionId -> { status, resultUrls, messages, error, task_id, upstreamPollPath, createdAt }
const sessions = new Map();
const inFlightTaskPolls = new Map();
const inFlightSessionPolls = new Map();

function parseOriginList(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function readPositiveInteger(raw, fallback) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isLoopbackHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]';
}

function assertSafeProxyBind() {
  if (!isLoopbackHost(HOST) && !PROXY_ALLOW_REMOTE) {
    throw new Error(
      'Refusing to expose proxy on a non-loopback host. Set PROXY_ALLOW_REMOTE=true to override.',
    );
  }
  if (!isLoopbackHost(HOST) && !PROXY_ACCESS_TOKEN) {
    throw new Error(
      'Refusing to expose proxy on a non-loopback host without PROXY_ACCESS_TOKEN.',
    );
  }
}

assertSafeProxyBind();

function matchesProxyAccessToken(candidate) {
  if (!PROXY_ACCESS_TOKEN) {
    return true;
  }
  if (!candidate) {
    return false;
  }
  const received = Buffer.from(String(candidate));
  const expected = Buffer.from(PROXY_ACCESS_TOKEN);
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(received, expected);
}

function getPresentedToken(req) {
  const authorization = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  const match = typeof authorization === 'string'
    ? authorization.match(/^Bearer\s+(.+)$/i)
    : null;
  return match?.[1]?.trim() || '';
}

function assertProxyAuthenticated(req, pathname) {
  if (pathname === '/health' || pathname === '/capabilities') {
    return;
  }
  if (!matchesProxyAccessToken(getPresentedToken(req))) {
    const error = new Error('proxy authentication required');
    error.status = 401;
    throw error;
  }
}

function setCorsHeaders(req, res) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

function assertTrustedBrowserOrigin(req) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (!origin || ALLOWED_ORIGINS.has(origin)) {
    return;
  }
  const error = new Error('origin not allowed');
  error.status = 403;
  throw error;
}

async function readJsonBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return {};
  }
  let raw = '';
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error(`Request body too large (>${MAX_BODY_BYTES} bytes)`);
      error.status = 413;
      throw error;
    }
    raw += chunk;
  }
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid JSON body');
    error.status = 400;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [taskId, task] of tasks.entries()) {
    if (now - (task.createdAt || now) > TASK_TTL_MS) {
      tasks.delete(taskId);
    }
  }
  for (const [sessionId, session] of sessions.entries()) {
    if (now - (session.createdAt || now) > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

function isTerminalStatus(status) {
  return status === 'completed' || status === 'failed';
}

function evictOldestTerminalEntries(store, overflowCount) {
  if (overflowCount <= 0) {
    return;
  }
  const evictableEntries = [...store.entries()]
    .filter(([, value]) => isTerminalStatus(value?.status))
    .sort((left, right) => (left[1]?.createdAt || 0) - (right[1]?.createdAt || 0));
  for (const [key] of evictableEntries.slice(0, overflowCount)) {
    store.delete(key);
  }
}

function assertStoreCapacity(store, maxEntries, label) {
  cleanupExpiredEntries();
  if (store.size < maxEntries) {
    return;
  }
  evictOldestTerminalEntries(store, store.size - maxEntries + 1);
  if (store.size < maxEntries) {
    return;
  }
  const error = new Error(`proxy ${label} capacity exceeded, retry later`);
  error.status = 503;
  throw error;
}

const cleanupTimer = setInterval(cleanupExpiredEntries, Math.min(TASK_TTL_MS, SESSION_TTL_MS));
cleanupTimer.unref();

function nowIso() {
  return new Date().toISOString();
}

function describeProvider(baseUrl) {
  try {
    return new URL(baseUrl).hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

function createCapabilityEntry(status, reason = '') {
  return {
    status,
    reason,
    lastError: reason || '',
    lastUpdatedAt: nowIso(),
  };
}

const capabilityState = {
  imageGenerate: AI_API_KEY && AI_IMAGE_PATH
    ? createCapabilityEntry('ready')
    : createCapabilityEntry('unavailable', AI_API_KEY ? 'AI_IMAGE_PATH 未配置' : 'AI_API_KEY 未配置'),
  videoGenerate: AI_VIDEO_PATH && AI_API_KEY && AI_VIDEO_MODEL
    ? createCapabilityEntry('unknown', '等待第一次视频请求确认能力')
    : createCapabilityEntry(
      'unavailable',
      !AI_API_KEY
        ? 'AI_API_KEY 未配置'
        : !AI_VIDEO_PATH
          ? 'AI_VIDEO_PATH 未配置'
          : 'AI_VIDEO_MODEL 未配置',
    ),
  imageToVideo: AI_VIDEO_PATH && AI_API_KEY && AI_VIDEO_I2V_MODEL
    ? createCapabilityEntry('unknown', '等待第一次图生视频请求确认能力')
    : createCapabilityEntry(
      'unavailable',
      !AI_API_KEY
        ? 'AI_API_KEY 未配置'
        : !AI_VIDEO_PATH
          ? 'AI_VIDEO_PATH 未配置'
          : 'AI_VIDEO_I2V_MODEL 未配置',
    ),
};

function setCapabilityStatus(key, status, reason = '') {
  if (!capabilityState[key]) {
    return;
  }
  capabilityState[key] = {
    status,
    reason,
    lastError: reason || '',
    lastUpdatedAt: nowIso(),
  };
}

function isCapabilityUnsupportedMessage(message) {
  const normalized = String(message || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return [
    'plan not support',
    'does not support',
    'not support model',
    'model is not supported',
    'unsupported model',
    'model_not_supported',
    'image generation is not supported',
    'video generation is not supported',
    'invalid api key',
    'unauthorized',
    'forbidden',
    'permission denied',
    'insufficient quota',
  ].some((marker) => normalized.includes(marker));
}

function updateMediaCapabilityFromFailure(mediaType, error, { usesFirstFrameImage = false } = {}) {
  const message = String(error || '').trim();
  if (!message) {
    return;
  }
  if (mediaType === 'image') {
    if (isCapabilityUnsupportedMessage(message)) {
      setCapabilityStatus('imageGenerate', 'unavailable', message);
    }
    return;
  }
  const key = usesFirstFrameImage ? 'imageToVideo' : 'videoGenerate';
  if (isCapabilityUnsupportedMessage(message)) {
    setCapabilityStatus(key, 'unavailable', message);
  } else if (capabilityState[key]?.status === 'unknown') {
    setCapabilityStatus(key, 'unknown', message);
  }
}

function updateMediaCapabilityFromSuccess(mediaType, { usesFirstFrameImage = false } = {}) {
  if (mediaType === 'image') {
    setCapabilityStatus('imageGenerate', 'ready');
    return;
  }
  const key = usesFirstFrameImage ? 'imageToVideo' : 'videoGenerate';
  setCapabilityStatus(key, 'ready');
}

function capabilitySnapshot() {
  return {
    status: 'ok',
    service: 'trix-canvas-ai-proxy',
    port: PORT,
    host: HOST,
    provider: describeProvider(AI_API_BASE),
    aiConfigured: Boolean(AI_API_KEY),
    imageGenerateStatus: capabilityState.imageGenerate.status,
    imageGenerateReady: capabilityState.imageGenerate.status === 'ready',
    videoGenerateStatus: capabilityState.videoGenerate.status,
    videoGenerateReady: capabilityState.videoGenerate.status === 'ready',
    imageToVideoStatus: capabilityState.imageToVideo.status,
    imageToVideoReady: capabilityState.imageToVideo.status === 'ready',
    reasons: {
      imageGenerate: capabilityState.imageGenerate.reason,
      videoGenerate: capabilityState.videoGenerate.reason,
      imageToVideo: capabilityState.imageToVideo.reason,
    },
    lastErrors: {
      imageGenerate: capabilityState.imageGenerate.lastError,
      videoGenerate: capabilityState.videoGenerate.lastError,
      imageToVideo: capabilityState.imageToVideo.lastError,
    },
    models: {
      image: AI_IMAGE_MODEL,
      video: AI_VIDEO_MODEL,
      imageToVideo: AI_VIDEO_I2V_MODEL,
    },
    paths: {
      image: AI_IMAGE_PATH,
      video: AI_VIDEO_PATH,
    },
    updatedAt: nowIso(),
  };
}

// ── HTTP/HTTPS forwarder ────────────────────────────────────────────────────

function apiRequest(method, pathOrUrl, body) {
  return new Promise((resolve, reject) => {
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl, AI_API_BASE);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const payload = body === undefined || body === null ? null : JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'User-Agent': 'TRIX-Canvas-Proxy/1.0',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const parsed = (() => { try { return JSON.parse(data); } catch { return data; } })();
        const ok = (res.statusCode || 500) < 400;
        resolve({ ok, status: res.statusCode || 500, body: parsed });
      });
    });
    req.on('error', (err) => {
      console.error(`[apiRequest ERROR] ${method} ${pathOrUrl} → ${err.message}`);
      reject(err);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function resolveAspect(value) {
  // Nano Banana 2 支持全部 14 种宽高比
  const ASPECT_MAP = {
    // 基础比例
    '1:1': '1:1',
    '16:9': '16:9',
    '4:3': '4:3',
    '9:16': '9:16',
    '3:2': '3:2',
    '2:3': '2:3',
    '3:4': '3:4',
    // Nano Banana 2 新增比例（超长/超宽）
    '1:4': '1:4',
    '4:1': '4:1',
    '1:8': '1:8',
    '8:1': '8:1',
    '4:5': '4:5',
    '5:4': '5:4',
    '21:9': '21:9',
    // 兼容别名
    origin: '1:1',
    portrait: '9:16',
    landscape: '16:9',
    square: '1:1',
  };
  return ASPECT_MAP[String(value || '').trim()] || '1:1';
}

// 判断宽高比是否为横屏（用于自动选择 VEO 3.1 landscape 模型）
function isLandscapeAspect(aspect) {
  const LANDSCAPE_RATIOS = new Set(['16:9', '4:3', '3:2', '21:9', '4:1', '8:1', '4:5']);
  return LANDSCAPE_RATIOS.has(aspect);
}

// 根据 aspect 和是否使用首帧，自动选择 VEO 3.1 模型名称
// VEO 3.1 模型命名：基础名 -landscape? -fast? -fl?
// -fl = Frame-to-Video 模式，需要配合 firstFrameImage
function selectVideoModel(usesFirstFrame, resolvedAspect) {
  const landscape = isLandscapeAspect(resolvedAspect);
  // 从环境变量读取基础名（默认 veo-3.1-fast）
  const baseModel = usesFirstFrame
    ? (process.env.AI_VIDEO_I2V_MODEL || 'veo-3.1-fast-fl')
    : (process.env.AI_VIDEO_MODEL || 'veo-3.1-fast');

  // 如果用户已经自己指定了带 -landscape/--fast 等完整后缀，直接用
  if (baseModel.includes('-landscape') || baseModel.includes('-fl')) {
    return baseModel;
  }
  // 自动加上 -landscape 后缀
  return landscape ? `${baseModel}-landscape` : baseModel;
}

// 发送 multipart/form-data 请求（用于 VEO 3.1 帧转视频）
// fields: { [name]: string | Buffer }
function apiRequestMultipart(pathOrUrl, fields) {
  return new Promise((resolve, reject) => {
    const url = /^https?:\/\//i.test(pathOrUrl)
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl, AI_API_BASE);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    // Build multipart body manually (no external deps)
    const boundary = `----FormBoundary${Date.now()}`;
    const parts = [];
    for (const [name, value] of Object.entries(fields)) {
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"` +
        (Buffer.isBuffer(value)
          ? `; filename="input_reference"\r\nContent-Type: application/octet-stream`
          : '') +
        `\r\n\r\n`,
        'utf8',
      );
      const body = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
      parts.push(header, body);
    }
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
    const body = Buffer.concat(parts);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'User-Agent': 'TRIX-Canvas-Proxy/1.0',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const parsed = (() => { try { return JSON.parse(data); } catch { return data; } })();
        const ok = (res.statusCode || 500) < 400;
        resolve({ ok, status: res.statusCode || 500, body: parsed });
      });
    });
    req.on('error', (err) => {
      console.error(`[apiRequestMultipart ERROR] ${pathOrUrl} → ${err.message}`);
      reject(err);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || '').toLowerCase();
  if (!status) {
    return 'pending';
  }
  if (['completed', 'complete', 'done', 'success', 'succeeded'].includes(status)) {
    return 'completed';
  }
  if (['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(status)) {
    return 'failed';
  }
  return 'pending';
}

function buildTaskPath(template, taskId) {
  if (!template || !taskId) {
    return '';
  }
  return template.replace(':taskId', taskId).replace('{taskId}', taskId);
}

function extractTaskId(body) {
  return (
    body?.task_id
    || body?.taskId
    || body?.id
    || body?.data?.task_id
    || body?.data?.taskId
    || body?.data?.id
    || body?.result?.task_id
    || body?.result?.taskId
    || ''
  );
}

function extractUrls(body) {
  const candidates = [
    body?.url,
    body?.urls,
    body?.result_url,
    body?.video_url,
    body?.data?.url,
    body?.data?.urls,
    body?.data?.image_urls,
    body?.data?.download_url,
    body?.output?.url,
    body?.output?.urls,
    body?.file?.download_url,
    body?.result?.url,
    body?.result?.urls,
  ];
  return [...new Set(
    candidates
      .flat(Infinity)
      .filter((value) => typeof value === 'string' && value.trim()),
  )];
}

function extractStatusUrl(body) {
  return (
    body?.status_url
    || body?.task_url
    || body?.poll_url
    || body?.data?.status_url
    || body?.data?.task_url
    || body?.data?.poll_url
    || body?.result?.status_url
    || body?.result?.task_url
    || ''
  );
}

function extractFileId(body) {
  return (
    body?.file_id
    || body?.fileId
    || body?.data?.file_id
    || body?.data?.fileId
    || body?.file?.file_id
    || body?.file?.fileId
    || body?.result?.file_id
    || body?.result?.fileId
    || ''
  );
}

function extractErrorMessage(body, fallback = 'request failed') {
  return body?.base_resp?.status_msg
    || body?.error?.message
    || body?.error
    || body?.message
    || fallback;
}

function extractMediaUrl(body, mediaType) {
  const candidates = [];
  if (body?.content && Array.isArray(body.content)) {
    for (const block of body.content) {
      if (block.type === 'text') {
        candidates.push(block.text);
      }
    }
  }
  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text);
      const key = mediaType === 'image' ? 'image_url' : 'video_url';
      if (parsed[key] && typeof parsed[key] === 'string' && parsed[key].startsWith('http')) {
        return { url: parsed[key] };
      }
      if (parsed.error) {
        return { error: parsed.error };
      }
    } catch {
      // ignore invalid JSON blocks
    }
    const match = text.match(/https?:\/\/[^\s\)"']+\.(?:png|jpg|jpeg|webp|mp4|mov|webm)\b/i);
    if (match) {
      return { url: match[0] };
    }
  }
  return null;
}

async function resolveVideoDownloadUrl(fileId) {
  if (!fileId) {
    return '';
  }
  const result = await apiRequest(
    'GET',
    `/v1/files/retrieve?file_id=${encodeURIComponent(String(fileId))}`,
  );
  if (!result.ok) {
    throw new Error(extractErrorMessage(result.body, `video file lookup failed (${result.status})`));
  }
  const urls = extractUrls(result.body);
  return urls[0] || '';
}

/**
 * Synchronous version of finalizeAsyncResult — used in poll paths to update
 * session/task state immediately (before returning) so callers always see
 * up-to-date resultUrls even when the async .then() hasn't resolved yet.
 */
function finalizeSync(entry, body) {
  const urls = extractUrls(body);
  const status = urls.length > 0
    ? 'completed'
    : normalizeStatus(body?.status || body?.state || body?.progress);
  const error = status === 'failed' ? extractErrorMessage(body, 'AI task failed') : null;
  return { status, urls, error };
}

async function finalizeAsyncResult(entry, payload) {
  const urls = extractUrls(payload);
  const status = urls.length > 0
    ? 'completed'
    : normalizeStatus(payload?.status || payload?.state || payload?.progress);
  if (status === 'completed') {
    const completedUrls = [...urls];
    const fileId = extractFileId(payload);
    if (completedUrls.length === 0 && fileId) {
      const resolvedUrl = await resolveVideoDownloadUrl(fileId);
      if (resolvedUrl) {
        completedUrls.push(resolvedUrl);
      }
    }
    return {
      status: 'completed',
      urls: completedUrls,
      output: completedUrls[0] ? { url: completedUrls[0] } : null,
      error: null,
    };
  }
  if (status === 'failed') {
    return {
      status: 'failed',
      urls: [],
      output: null,
      error: extractErrorMessage(payload, 'AI task failed'),
    };
  }
  return {
    status: 'processing',
    urls: [],
    output: null,
    error: null,
  };
}

async function pollTaskEntry(taskId, task) {
  if (!task?.upstreamPollPath || task.status === 'completed' || task.status === 'failed') {
    return task;
  }
  if (inFlightTaskPolls.has(taskId)) {
    return inFlightTaskPolls.get(taskId);
  }
  if (Date.now() - (task.lastPolledAt || 0) < TASK_POLL_INTERVAL_MS) {
    return task;
  }
  task.lastPolledAt = Date.now();
  const pending = apiRequest('GET', task.upstreamPollPath)
    .then(async (result) => {
      if (!result.ok) {
        task.status = 'failed';
        task.error = extractErrorMessage(result.body, `HTTP ${result.status}`);
        updateMediaCapabilityFromFailure(
          task.mediaType,
          task.error,
          { usesFirstFrameImage: Boolean(task.usesFirstFrameImage) },
        );
        return task;
      }
      const next = await finalizeAsyncResult(task, result.body);
      task.status = next.status;
      task.output = next.output;
      task.urls = next.urls;
      task.error = next.error;
      if (task.status === 'completed') {
        updateMediaCapabilityFromSuccess(
          task.mediaType,
          { usesFirstFrameImage: Boolean(task.usesFirstFrameImage) },
        );
      } else if (task.status === 'failed') {
        updateMediaCapabilityFromFailure(
          task.mediaType,
          task.error,
          { usesFirstFrameImage: Boolean(task.usesFirstFrameImage) },
        );
      }
      return task;
    })
    .catch((error) => {
      task.status = 'failed';
      task.error = error.message;
      updateMediaCapabilityFromFailure(
        task.mediaType,
        task.error,
        { usesFirstFrameImage: Boolean(task.usesFirstFrameImage) },
      );
      return task;
    })
    .finally(() => {
      inFlightTaskPolls.delete(taskId);
    });
  inFlightTaskPolls.set(taskId, pending);
  return pending;
}

async function pollSessionEntry(sessionId, session) {
  // Don't return early if the session is marked completed but resultUrls is still empty —
  // the async .then() chain that sets resultUrls may not have resolved yet.
  if (!session?.upstreamPollPath || (session.status === 'completed' && session.resultUrls?.length > 0) || session.status === 'failed') {
    return session;
  }
  if (inFlightSessionPolls.has(sessionId)) {
    return inFlightSessionPolls.get(sessionId);
  }
  if (Date.now() - (session.lastPolledAt || 0) < TASK_POLL_INTERVAL_MS) {
    return session;
  }
  // Always update resultUrls synchronously from the HTTP response so callers
  // (including the /result endpoint) always see up-to-date data immediately.
  session.lastPolledAt = Date.now();
  const pending = apiRequest('GET', session.upstreamPollPath)
    .then(async (result) => {
      if (!result.ok) {
        session.status = 'failed';
        session.error = extractErrorMessage(result.body, `HTTP ${result.status}`);
        updateMediaCapabilityFromFailure(
          session.mediaType,
          session.error,
          { usesFirstFrameImage: Boolean(session.usesFirstFrameImage) },
        );
        return session;
      }
      // Synchronously update session so callers see resultUrls before the promise resolves
      const sync = finalizeSync(session, result.body);
      session.status = sync.status === 'processing' ? 'generating' : sync.status;
      session.resultUrls = sync.urls;
      session.error = sync.error;
      if (session.upstreamTaskId) {
        session.task_id = session.upstreamTaskId;
      }
      if (session.status === 'completed') {
        updateMediaCapabilityFromSuccess(
          session.mediaType,
          { usesFirstFrameImage: Boolean(session.usesFirstFrameImage) },
        );
      } else if (session.status === 'failed') {
        updateMediaCapabilityFromFailure(
          session.mediaType,
          session.error,
          { usesFirstFrameImage: Boolean(session.usesFirstFrameImage) },
        );
      }
      // Handle async file download only when needed (no-op for most responses)
      if (sync.status === 'completed' && sync.urls.length === 0 && extractFileId(result.body)) {
        const next = await finalizeAsyncResult(session, result.body);
        session.resultUrls = next.urls;
        session.error = next.error;
      }
      return session;
    })
    .catch((error) => {
      session.status = 'failed';
      session.error = error.message;
      updateMediaCapabilityFromFailure(
        session.mediaType,
        session.error,
        { usesFirstFrameImage: Boolean(session.usesFirstFrameImage) },
      );
      return session;
    })
    .finally(() => {
      inFlightSessionPolls.delete(sessionId);
    });
  inFlightSessionPolls.set(sessionId, pending);
  return pending;
}

// ── AI call wrapper ────────────────────────────────────────────────────────

async function callAi(canvasPayload) {
  const prompt = canvasPayload.message || canvasPayload.prompt || '';
  const mediaType = canvasPayload.media_type || canvasPayload.mediaType || 'image';
  const aspect = resolveAspect(canvasPayload.aspect);

  // Nano Banana 2 imageSize: 512 / 1K / 2K / 4K
  const imageSize = canvasPayload.imageSize || '1K';
  // Nano Banana 2 thinking mode: 'minimal' | 'high' | 'auto' | number
  const thinkingMode = canvasPayload.thinkingMode || null;
  // Image editing: base64 data URL or raw base64 string
  const inputImage = canvasPayload.inputImage || canvasPayload.input_image || '';
  // Video first-frame: parent source URL (图生视频)
  const firstFrameImage =
    canvasPayload.parent_source_url
    || canvasPayload.parentSourceUrl
    || canvasPayload.parent_result_url
    || canvasPayload.parentResultUrl
    || '';

  // ── Image generation / editing ──
  if (mediaType === 'image') {
    const parts = [{ text: prompt }];

    // Support image editing: inject input image as inlineData
    let inputImageData = null;
    let inputMimeType = 'image/png';
    if (inputImage) {
      if (inputImage.startsWith('data:')) {
        const commaIdx = inputImage.indexOf(',');
        inputMimeType = inputImage.slice(5, commaIdx).replace(/;.*/, '');
        inputImageData = inputImage.slice(commaIdx + 1);
      } else {
        inputImageData = inputImage;
      }
      parts.unshift({ inlineData: { mimeType: inputMimeType, data: inputImageData } });
    }

    const genConfig = {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: aspect || '1:1',
        imageSize,
      },
    };
    // thinkingMode: 'minimal' → 0, 'high' → -1, number → that number, null/undefined → omit
    if (thinkingMode !== null && thinkingMode !== undefined) {
      genConfig.thinkingConfig = { thinkingBudget: Number(thinkingMode) };
    }

    const result = await apiRequest('POST', AI_IMAGE_PATH, {
      contents: [{ parts }],
      generationConfig: genConfig,
    });
    if (!result.ok) {
      const error = extractErrorMessage(result.body, `HTTP ${result.status}`);
      updateMediaCapabilityFromFailure(mediaType, error, { usesFirstFrameImage: false });
      return { ok: false, error };
    }
    const body = result.body;
    if (body?.status === 'completed') {
      const directUrls = extractUrls(body);
      if (directUrls.length > 0) {
        updateMediaCapabilityFromSuccess(mediaType, { usesFirstFrameImage: false });
        return { ok: true, status: 'completed', urls: directUrls };
      }
    }
    let b64 = null;
    try {
      const candParts = body?.candidates?.[0]?.content?.parts || [];
      for (const part of candParts) {
        if (part?.inlineData?.data) {
          b64 = part.inlineData.data;
          break;
        }
      }
    } catch (_) {}
    if (b64) {
      const mimeType = body?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'image/png';
      updateMediaCapabilityFromSuccess(mediaType, { usesFirstFrameImage: false });
      return { ok: true, status: 'completed', urls: [`data:${mimeType};base64,${b64}`] };
    }
    const taskId = extractTaskId(body);
    const statusUrl = extractStatusUrl(body);
    if (taskId || statusUrl) {
      const pollPath = statusUrl || buildTaskPath(AI_IMAGE_TASK_PATH_TEMPLATE, taskId);
      updateMediaCapabilityFromSuccess(mediaType, { usesFirstFrameImage: false });
      return {
        ok: true,
        status: normalizeStatus(body?.status || body?.state || body?.progress) === 'completed' ? 'completed' : 'processing',
        upstreamTaskId: taskId,
        upstreamPollPath: pollPath,
        urls: extractUrls(body),
      };
    }
    const finishReason = body?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      const error = `Image generation blocked: ${finishReason}`;
      updateMediaCapabilityFromFailure(mediaType, error, { usesFirstFrameImage: false });
      return { ok: false, error };
    }
    updateMediaCapabilityFromFailure(mediaType, 'No image in response', { usesFirstFrameImage: false });
    return { ok: false, error: 'No image in APIyi response' };
  }

  if (AI_VIDEO_PATH) {
    // ── VEO 3.1 异步 API (/v1/videos) ──
    // 模型根据 aspect（横屏/竖屏）和是否使用首帧自动选择
    // 帧转视频使用 multipart/form-data 格式
    const usesFirstFrame = Boolean(firstFrameImage);
    const videoModel = selectVideoModel(usesFirstFrame, aspect);
    const videoCapabilityContext = { usesFirstFrameImage: usesFirstFrame };

    let result;
    if (usesFirstFrame) {
      // VEO 3.1 帧转视频：multipart/form-data，input_reference 为图片
      let imageData = firstFrameImage;
      let mimeType = 'image/png';
      if (firstFrameImage.startsWith('data:')) {
        const commaIdx = firstFrameImage.indexOf(',');
        mimeType = firstFrameImage.slice(5, commaIdx).replace(/;.*/, '');
        imageData = firstFrameImage.slice(commaIdx + 1);
      }
      // input_reference 需要原始二进制，先 base64 decode
      const imageBuffer = Buffer.from(imageData, 'base64');
      result = await apiRequestMultipart(AI_VIDEO_PATH, {
        prompt,
        model: videoModel,
        input_reference: imageBuffer,
      });
    } else {
      // 文生视频：普通 JSON
      result = await apiRequest('POST', AI_VIDEO_PATH, {
        prompt,
        model: videoModel,
      });
    }

    if (!result.ok) {
      const error = extractErrorMessage(result.body, `HTTP ${result.status}`);
      updateMediaCapabilityFromFailure(mediaType, error, videoCapabilityContext);
      return { ok: false, error };
    }

    const body = result.body;
    // VEO 3.1 异步返回: { id: "video_xxx", status: "queued" }
    if (body?.status === 'completed') {
      const videoUrl = body?.url || body?.video_url;
      if (videoUrl) {
        updateMediaCapabilityFromSuccess(mediaType, videoCapabilityContext);
        return { ok: true, status: 'completed', urls: [videoUrl] };
      }
    }
    // Async — extract video_id/task_id for polling
    const videoId = extractTaskId(body);
    if (videoId) {
      const pollPath = extractStatusUrl(body) || buildTaskPath(AI_VIDEO_TASK_PATH_TEMPLATE, videoId);
      return {
        ok: true,
        status: 'processing',
        upstreamTaskId: videoId,
        upstreamPollPath: pollPath,
        urls: [],
      };
    }
    // Fallback: check for direct URL in response
    const urls = extractUrls(body);
    if (urls.length > 0) {
      updateMediaCapabilityFromSuccess(mediaType, videoCapabilityContext);
      return { ok: true, status: 'completed', urls };
    }
    updateMediaCapabilityFromFailure(
      mediaType,
      'No video ID or URL in VEO 3.1 response',
      videoCapabilityContext,
    );
    return { ok: false, error: 'No video ID or URL in VEO 3.1 response' };
  }

  const fallbackCapabilityContext = { usesFirstFrameImage: false };
  const result = await apiRequest('POST', AI_GENERATE_PATH, {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
    stream: false,
  });
  if (!result.ok) {
    const error = extractErrorMessage(result.body, `HTTP ${result.status}`);
    updateMediaCapabilityFromFailure(mediaType, error, fallbackCapabilityContext);
    return { ok: false, error };
  }
  const extracted = extractMediaUrl(result.body, mediaType);
  if (!extracted) {
    updateMediaCapabilityFromFailure(mediaType, 'AI response contained no usable URL', fallbackCapabilityContext);
    return { ok: false, error: 'AI response contained no usable URL' };
  }
  if (extracted.error) {
    updateMediaCapabilityFromFailure(mediaType, extracted.error, fallbackCapabilityContext);
    return { ok: false, error: extracted.error };
  }
  updateMediaCapabilityFromSuccess(mediaType, fallbackCapabilityContext);
  return { ok: true, status: 'completed', urls: [extracted.url] };
}

// ── Request handler ─────────────────────────────────────────────────────────

async function handle(req, url, body) {
  const pathname = url.pathname;

  // ── Canvas service: POST /generate ────────────────────────────────────
  if (req.method === 'POST' && pathname === '/generate') {
    assertStoreCapacity(tasks, MAX_TASK_ENTRIES, 'task');
    const task_id = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mediaType = body?.media_type || body?.mediaType || 'image';
    const usesFirstFrameImage = Boolean(
      body?.parent_source_url
      || body?.parentSourceUrl
      || body?.parent_result_url
      || body?.parentResultUrl,
    );
    tasks.set(task_id, {
      status: 'pending',
      mediaType,
      usesFirstFrameImage,
      output: null,
      urls: [],
      error: null,
      upstreamTaskId: '',
      upstreamPollPath: '',
      lastPolledAt: 0,
      createdAt: Date.now(),
    });

    callAi(body).then((res) => {
      const t = tasks.get(task_id);
      if (!t) {
        return;
      }
      if (res.ok) {
        t.status = res.status || 'completed';
        t.output = res.urls?.[0] ? { url: res.urls[0] } : null;
        t.urls = res.urls || [];
        t.upstreamTaskId = res.upstreamTaskId || '';
        t.upstreamPollPath = res.upstreamPollPath || '';
      } else {
        t.status = 'failed';
        t.error = res.error;
      }
    }).catch((err) => {
      const t = tasks.get(task_id);
      if (t) {
        t.status = 'failed';
        t.error = err.message;
      }
    });

    return { status: 200, body: { task_id, status: 'pending' } };
  }

  // ── Canvas service: GET /tasks/:taskId (polling) ────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/tasks/')) {
    const task_id = pathname.split('/').pop();
    const t = tasks.get(task_id);
    if (!t) {
      return { status: 404, body: { error: 'not found' } };
    }
    await pollTaskEntry(task_id, t);
    return {
      status: 200,
      body: { task_id, status: t.status, output: t.output, urls: t.urls, error: t.error },
    };
  }

  // ── TRIXAdapter (Python): POST /api/session ─────────────────────────────
  if (req.method === 'POST' && pathname === '/api/session') {
    assertStoreCapacity(sessions, MAX_SESSION_ENTRIES, 'session');
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task_id = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mediaType = body?.media_type || body?.mediaType || 'image';
    const usesFirstFrameImage = Boolean(
      body?.parent_source_url
      || body?.parentSourceUrl
      || body?.parent_result_url
      || body?.parentResultUrl,
    );
    sessions.set(sessionId, {
      task_id,
      status: 'generating',
      mediaType,
      usesFirstFrameImage,
      resultUrls: [],
      messages: [],
      error: null,
      upstreamTaskId: '',
      upstreamPollPath: '',
      lastPolledAt: 0,
      createdAt: Date.now(),
    });

    callAi(body).then((res) => {
      const s = sessions.get(sessionId);
      if (!s) {
        return;
      }
      if (res.ok) {
        s.resultUrls = res.urls || [];
        s.status = res.status === 'processing' ? 'generating' : 'completed';
        s.upstreamTaskId = res.upstreamTaskId || '';
        s.upstreamPollPath = res.upstreamPollPath || '';
        if (s.upstreamTaskId) {
          s.task_id = s.upstreamTaskId;
        }
      } else {
        s.status = 'failed';
        s.error = res.error;
      }
    }).catch((err) => {
      const s = sessions.get(sessionId);
      if (s) {
        s.status = 'failed';
        s.error = err.message;
      }
    });

    return { status: 200, body: { data: { taskId: task_id, sessionId, status: 'generating', resultUrls: [] } } };
  }

  // ── TRIXAdapter (Python): GET /api/session/:sessionId ───────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/session/')) {
    // Handle /api/session/:id/result first (before generic session route)
    if (pathname.endsWith('/result')) {
      const parts = pathname.split('/');
      const sessionId = parts[parts.length - 2]; // .../session/:id/result → parts[parts.length-2]
      const s = sessions.get(sessionId);
      if (!s) {
        return { status: 404, body: { error: 'not found' } };
      }
      await pollSessionEntry(sessionId, s);
      return { status: 200, body: { data: { resultUrls: s.resultUrls || [], status: s.status, error: s.error } } };
    }
    const sessionId = pathname.split('/').pop();
    const s = sessions.get(sessionId);
    if (!s) {
      return { status: 404, body: { error: 'not found' } };
    }
    await pollSessionEntry(sessionId, s);
    return { status: 200, body: { data: { taskId: s.task_id, sessionId, status: s.status, resultUrls: s.resultUrls, error: s.error } } };
  }

  // ── Health ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/health') {
    return { status: 200, body: capabilitySnapshot() };
  }

  if (req.method === 'GET' && pathname === '/capabilities') {
    return { status: 200, body: capabilitySnapshot() };
  }

  return { status: 404, body: { error: 'not found' } };
}

// ── HTTP server ────────────────────────────────────────────────────────────

const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      sendJson(res, 403, { error: 'origin not allowed' });
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    assertTrustedBrowserOrigin(req);
    assertProxyAuthenticated(req, url.pathname);
    const body = await readJsonBody(req);
    const result = await handle(req, url, body);
    sendJson(res, result.status, result.body);
  } catch (err) {
    console.error('[Proxy Error]', err.message);
    sendJson(res, err.status || 500, { error: err.message });
  }
});

srv.listen(PORT, HOST, () => {
  console.log(`TRIX Canvas AI Proxy  →  ${HOST}:${PORT}`);
  console.log(`  Upstream: ${AI_API_BASE}${AI_GENERATE_PATH}`);
  if (AI_VIDEO_PATH) {
    const videoUrl = /https?:\/\//i.test(AI_VIDEO_PATH) ? AI_VIDEO_PATH : `${AI_API_BASE}${AI_VIDEO_PATH}`;
    console.log(`  Video:    ${videoUrl}`);
  }
  console.log(`  Provider: apiyi  (${describeProvider(AI_API_BASE)})`);
  console.log(`  Image:    ${AI_IMAGE_MODEL}  (gemini)`);
  console.log(`  Video:    ${AI_VIDEO_MODEL}  (i2v: ${AI_VIDEO_I2V_MODEL})`);
  console.log(`  Key:      ${AI_API_KEY ? '✓' : '✗'}`);
  if (!isLoopbackHost(HOST)) {
    console.warn('⚠ Proxy remote exposure enabled via PROXY_ALLOW_REMOTE=true');
  }
});

srv.on('error', err => { console.error(err); process.exit(1); });
