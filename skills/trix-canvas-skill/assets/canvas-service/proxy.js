#!/usr/bin/env node
/**
 * Local AI Proxy — bridges canvas service to MiniMax API.
 *
 * Handles two client patterns:
 *  A) Canvas service:        POST /generate  +  GET /tasks/:taskId
 *  B) TRIXAdapter (Python): POST /api/session  +  GET /api/session/:sessionId
 *
 * Both translate canvas-format prompts into MiniMax Anthropic API calls.
 */

import http from 'node:http';
import https from 'node:https';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PROXY_PORT || 8790);
const HOST = process.env.PROXY_HOST || '127.0.0.1';
const AI_API_BASE          = process.env.AI_API_BASE          || 'https://api.minimaxi.com';
const AI_API_KEY           = process.env.AI_API_KEY           || '';
const AI_GENERATE_PATH = process.env.AI_GENERATE_PATH || '/anthropic/v1/messages';
const AI_IMAGE_PATH = process.env.AI_IMAGE_PATH || '/v1/image_generation';
const AI_VIDEO_PATH = process.env.AI_VIDEO_PATH || process.env.PROXY_VIDEO_PATH || '';
const AI_MODEL = process.env.AI_MODEL || 'MiniMax-M2.7';
const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || 'image-01';
const AI_VIDEO_MODEL = process.env.AI_VIDEO_MODEL || process.env.PROXY_VIDEO_MODEL || AI_MODEL;
const AI_IMAGE_TASK_PATH_TEMPLATE =
  process.env.AI_IMAGE_TASK_PATH_TEMPLATE
  || process.env.PROXY_IMAGE_TASK_PATH_TEMPLATE
  || '';
const AI_VIDEO_TASK_PATH_TEMPLATE =
  process.env.AI_VIDEO_TASK_PATH_TEMPLATE
  || process.env.PROXY_VIDEO_TASK_PATH_TEMPLATE
  || '';
const MAX_BODY_BYTES = Number(process.env.PROXY_MAX_BODY_BYTES || 256 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.PROXY_REQUEST_TIMEOUT_MS || 120000);
const TASK_TTL_MS = Number(process.env.PROXY_TASK_TTL_MS || 60 * 60 * 1000);
const SESSION_TTL_MS = Number(process.env.PROXY_SESSION_TTL_MS || 60 * 60 * 1000);
const TASK_POLL_INTERVAL_MS = Number(process.env.PROXY_TASK_POLL_INTERVAL_MS || 2000);
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
  if (pathname === '/health') {
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

const cleanupTimer = setInterval(cleanupExpiredEntries, Math.min(TASK_TTL_MS, SESSION_TTL_MS));
cleanupTimer.unref();

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
        try {
          resolve({ ok: (res.statusCode || 500) < 400, status: res.statusCode || 500, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ ok: (res.statusCode || 500) < 400, status: res.statusCode || 500, body: data });
        }
      });
    });
    req.on('error', reject);
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
  const ASPECT_MAP = {
    '1:1': '1:1',
    '16:9': '16:9',
    '4:3': '4:3',
    '9:16': '9:16',
    '3:2': '3:2',
    '2:3': '2:3',
    '3:4': '3:4',
    '21:9': '21:9',
    origin: '1:1',
  };
  return ASPECT_MAP[value] || '1:1';
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
    body?.data?.url,
    body?.data?.urls,
    body?.data?.image_urls,
    body?.output?.url,
    body?.output?.urls,
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

function finalizeAsyncResult(entry, payload) {
  const urls = extractUrls(payload);
  const status = urls.length > 0
    ? 'completed'
    : normalizeStatus(payload?.status || payload?.state || payload?.progress);
  if (status === 'completed') {
    return {
      status: 'completed',
      urls,
      output: urls[0] ? { url: urls[0] } : null,
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
    .then((result) => {
      if (!result.ok) {
        task.status = 'failed';
        task.error = extractErrorMessage(result.body, `HTTP ${result.status}`);
        return task;
      }
      const next = finalizeAsyncResult(task, result.body);
      task.status = next.status;
      task.output = next.output;
      task.urls = next.urls;
      task.error = next.error;
      return task;
    })
    .catch((error) => {
      task.status = 'failed';
      task.error = error.message;
      return task;
    })
    .finally(() => {
      inFlightTaskPolls.delete(taskId);
    });
  inFlightTaskPolls.set(taskId, pending);
  return pending;
}

async function pollSessionEntry(sessionId, session) {
  if (!session?.upstreamPollPath || session.status === 'completed' || session.status === 'failed') {
    return session;
  }
  if (inFlightSessionPolls.has(sessionId)) {
    return inFlightSessionPolls.get(sessionId);
  }
  if (Date.now() - (session.lastPolledAt || 0) < TASK_POLL_INTERVAL_MS) {
    return session;
  }
  session.lastPolledAt = Date.now();
  const pending = apiRequest('GET', session.upstreamPollPath)
    .then((result) => {
      if (!result.ok) {
        session.status = 'failed';
        session.error = extractErrorMessage(result.body, `HTTP ${result.status}`);
        return session;
      }
      const next = finalizeAsyncResult(session, result.body);
      session.status = next.status === 'processing' ? 'generating' : next.status;
      session.resultUrls = next.urls;
      session.error = next.error;
      if (session.upstreamTaskId) {
        session.task_id = session.upstreamTaskId;
      }
      return session;
    })
    .catch((error) => {
      session.status = 'failed';
      session.error = error.message;
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

  if (mediaType === 'image') {
    const result = await apiRequest('POST', AI_IMAGE_PATH, {
      model: AI_IMAGE_MODEL,
      prompt,
      aspect_ratio: aspect,
      response_format: 'url',
      n: 1,
    });
    if (!result.ok) {
      return { ok: false, error: extractErrorMessage(result.body, `HTTP ${result.status}`) };
    }
    const urls = extractUrls(result.body);
    if (urls.length > 0) {
      return { ok: true, status: 'completed', urls };
    }
    const taskId = extractTaskId(result.body);
    const pollPath = extractStatusUrl(result.body) || buildTaskPath(AI_IMAGE_TASK_PATH_TEMPLATE, taskId);
    if (taskId && pollPath) {
      return {
        ok: true,
        status: 'processing',
        upstreamTaskId: taskId,
        upstreamPollPath: pollPath,
        urls: [],
      };
    }
    if (result.body?.base_resp?.status_code !== 0) {
      return { ok: false, error: extractErrorMessage(result.body, 'Image generation failed') };
    }
    return { ok: false, error: 'No image URL in response' };
  }

  if (AI_VIDEO_PATH) {
    const result = await apiRequest('POST', AI_VIDEO_PATH, {
      model: AI_VIDEO_MODEL,
      prompt,
      aspect_ratio: aspect,
      aspect,
    });
    if (!result.ok) {
      return { ok: false, error: extractErrorMessage(result.body, `HTTP ${result.status}`) };
    }
    const urls = extractUrls(result.body);
    if (urls.length > 0) {
      return { ok: true, status: 'completed', urls };
    }
    const taskId = extractTaskId(result.body);
    const pollPath = extractStatusUrl(result.body) || buildTaskPath(AI_VIDEO_TASK_PATH_TEMPLATE, taskId);
    if (taskId && pollPath) {
      return {
        ok: true,
        status: 'processing',
        upstreamTaskId: taskId,
        upstreamPollPath: pollPath,
        urls: [],
      };
    }
    const extracted = extractMediaUrl(result.body, mediaType);
    if (extracted?.url) {
      return { ok: true, status: 'completed', urls: [extracted.url] };
    }
    if (extracted?.error) {
      return { ok: false, error: extracted.error };
    }
    return { ok: false, error: 'Video endpoint returned neither URL nor pollable task' };
  }

  const result = await apiRequest('POST', AI_GENERATE_PATH, {
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
    stream: false,
  });
  if (!result.ok) {
    return { ok: false, error: extractErrorMessage(result.body, `HTTP ${result.status}`) };
  }
  const extracted = extractMediaUrl(result.body, mediaType);
  if (!extracted) {
    return { ok: false, error: 'AI response contained no usable URL' };
  }
  if (extracted.error) {
    return { ok: false, error: extracted.error };
  }
  return { ok: true, status: 'completed', urls: [extracted.url] };
}

// ── Request handler ─────────────────────────────────────────────────────────

async function handle(req, url, body) {
  const pathname = url.pathname;

  // ── Canvas service: POST /generate ────────────────────────────────────
  if (req.method === 'POST' && pathname === '/generate') {
    const task_id = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mediaType = body?.media_type || body?.mediaType || 'image';
    tasks.set(task_id, {
      status: 'pending',
      mediaType,
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
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task_id = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mediaType = body?.media_type || body?.mediaType || 'image';
    sessions.set(sessionId, {
      task_id,
      status: 'generating',
      mediaType,
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
    return { status: 200, body: { status: 'ok', service: 'trix-canvas-ai-proxy', aiConfigured: Boolean(AI_API_KEY) } };
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
    console.log(`  Video:    ${AI_API_BASE}${AI_VIDEO_PATH}`);
  }
  console.log(`  Model:    ${AI_MODEL}`);
  console.log(`  Key:      ${AI_API_KEY ? '✓' : '✗'}`);
  if (!isLoopbackHost(HOST)) {
    console.warn('⚠ Proxy remote exposure enabled via PROXY_ALLOW_REMOTE=true');
  }
});

srv.on('error', err => { console.error(err); process.exit(1); });
