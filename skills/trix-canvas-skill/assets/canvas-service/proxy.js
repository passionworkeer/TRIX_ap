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
const AI_GENERATE_PATH     = process.env.AI_GENERATE_PATH     || '/anthropic/v1/messages';
const AI_IMAGE_PATH        = process.env.AI_IMAGE_PATH        || '/v1/image_generation';
const AI_MODEL             = process.env.AI_MODEL             || 'MiniMax-M2.7';
const AI_IMAGE_MODEL       = process.env.AI_IMAGE_MODEL     || 'image-01';
const MAX_BODY_BYTES       = Number(process.env.PROXY_MAX_BODY_BYTES || 256 * 1024);
const REQUEST_TIMEOUT_MS   = Number(process.env.PROXY_REQUEST_TIMEOUT_MS || 120000);
const TASK_TTL_MS          = Number(process.env.PROXY_TASK_TTL_MS || 60 * 60 * 1000);
const SESSION_TTL_MS       = Number(process.env.PROXY_SESSION_TTL_MS || 60 * 60 * 1000);
const ALLOWED_ORIGINS      = parseOriginList(process.env.PROXY_ALLOWED_ORIGINS || '');
const PROXY_ALLOW_REMOTE   = /^(1|true|yes)$/i.test(process.env.PROXY_ALLOW_REMOTE || '');
const PROXY_ACCESS_TOKEN   = (process.env.PROXY_ACCESS_TOKEN || '').trim();

// In-memory stores for async polling
// taskId -> { status, output, urls, error, createdAt }
const tasks    = new Map();
// sessionId -> { status, resultUrls, messages, error, task_id, createdAt }
const sessions = new Map();

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

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const isHttps = AI_API_BASE.startsWith('https://');
    const mod = isHttps ? https : http;
    const url = new URL(AI_API_BASE + path);
    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TRIX-Canvas-Proxy/1.0',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── MiniMax payload builder ────────────────────────────────────────────────

function minimaxBody(prompt, mediaType) {
  const base = {
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
    stream: false,
  };
  if (mediaType === 'image') {
    base.messages[0].content =
      `You are an image generation AI. Generate an image for: "${prompt}". ` +
      `Respond ONLY with a valid JSON object, no other text: ` +
      `{"image_url": "https://example.com/generated.png"} or ` +
      `{"error": "description of what went wrong"}.`;
  } else {
    base.messages[0].content =
      `You are a video generation AI. Describe the video for: "${prompt}". ` +
      `Respond ONLY with a valid JSON object, no other text: ` +
      `{"video_url": "https://example.com/generated.mp4"} or ` +
      `{"error": "description"}.`;
  }
  return base;
}

// ── Result extractor ───────────────────────────────────────────────────────

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
      if (parsed.error) return { error: parsed.error };
    } catch { /* not JSON */ }
    // Raw URL fallback
    const m = text.match(/https?:\/\/[^\s\)"']+\.(?:png|jpg|jpeg|webp|mp4|mov)\b/i);
    if (m) return { url: m[0] };
  }
  return null;
}

// ── MiniMax call wrapper ────────────────────────────────────────────────────

async function callAi(canvasPayload) {
  const prompt    = canvasPayload.message || canvasPayload.prompt || '';
  const mediaType = canvasPayload.media_type || canvasPayload.mediaType || 'image';

  // ── Image generation via MiniMax dedicated endpoint ────────────────────
  if (mediaType === 'image') {
    const ASPECT_MAP = { '1:1': '1:1', '16:9': '16:9', '4:3': '4:3', '9:16': '9:16', '3:2': '3:2', '2:3': '2:3', '3:4': '3:4', '21:9': '21:9', 'origin': '1:1' };
    const aspect = ASPECT_MAP[canvasPayload.aspect] || '1:1';
    const result = await apiRequest('POST', AI_IMAGE_PATH, {
      model:           AI_IMAGE_MODEL,
      prompt,
      aspect_ratio:    aspect,
      response_format: 'url',
      n:               1,
    });
    if (!result.ok) {
      return { ok: false, error: result.body?.base_resp?.status_msg || result.body?.error?.message || `HTTP ${result.status}` };
    }
    // MiniMax image response: { id, data: { image_urls: ["http://..."] } }
    const urls = result.body?.data?.image_urls;
    if (urls && urls.length > 0) return { ok: true, url: urls[0] };
    // HTTP 200 but API returned an error in body
    if (result.body?.base_resp?.status_code !== 0) {
      return { ok: false, error: result.body?.base_resp?.status_msg || 'Image generation failed' };
    }
    return { ok: false, error: 'No image URL in response' };
  }

  // ── Video / text — use Anthropic messages endpoint ─────────────────────
  const result = await apiRequest('POST', AI_GENERATE_PATH, {
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8000,
    stream: false,
  });
  if (!result.ok) {
    return { ok: false, error: result.body?.error?.message || `HTTP ${result.status}` };
  }
  // For video, extract URL from text response
  const extracted = extractMediaUrl(result.body, mediaType);
  if (!extracted) return { ok: false, error: 'AI response contained no usable URL' };
  if (extracted.error) return { ok: false, error: extracted.error };
  return { ok: true, url: extracted.url };
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
      createdAt: Date.now(),
    });

    // Fire-and-forget AI call
    callAi(body).then(res => {
      const t = tasks.get(task_id);
      if (!t) return;
      if (res.ok) {
        t.status = 'completed';
        t.output  = { url: res.url };
        t.urls     = [res.url];
      } else {
        t.status = 'failed';
        t.error  = res.error;
      }
    }).catch(err => {
      const t = tasks.get(task_id);
      if (t) { t.status = 'failed'; t.error = err.message; }
    });

    return { status: 200, body: { task_id, status: 'pending' } };
  }

  // ── Canvas service: GET /tasks/:taskId (polling) ────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/tasks/')) {
    const task_id = pathname.split('/').pop();
    const t = tasks.get(task_id);
    if (!t) return { status: 404, body: { error: 'not found' } };
    return {
      status: 200,
      body: { task_id, status: t.status, output: t.output, urls: t.urls, error: t.error },
    };
  }

  // ── TRIXAdapter (Python): POST /api/session ─────────────────────────────
  if (req.method === 'POST' && pathname === '/api/session') {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task_id    = `tk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mediaType  = body?.media_type || body?.mediaType || 'image';
    sessions.set(sessionId, {
      task_id,
      status: 'generating',
      resultUrls: [],
      messages: [],
      error: null,
      createdAt: Date.now(),
    });

    callAi(body).then(res => {
      const s = sessions.get(sessionId);
      if (!s) return;
      if (res.ok) { s.resultUrls = [res.url]; s.status = 'completed'; }
      else { s.status = 'failed'; s.error = res.error; }
    }).catch(err => {
      const s = sessions.get(sessionId);
      if (s) { s.status = 'failed'; s.error = err.message; }
    });

    return { status: 200, body: { data: { taskId: task_id, sessionId, status: 'generating', resultUrls: [] } } };
  }

  // ── TRIXAdapter (Python): GET /api/session/:sessionId ───────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/session/')) {
    const sessionId = pathname.split('/').pop();
    const s = sessions.get(sessionId);
    if (!s) return { status: 404, body: { error: 'not found' } };
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
  console.log(`  Model:    ${AI_MODEL}`);
  console.log(`  Key:      ${AI_API_KEY ? '✓' : '✗'}`);
  if (!isLoopbackHost(HOST)) {
    console.warn('⚠ Proxy remote exposure enabled via PROXY_ALLOW_REMOTE=true');
  }
});

srv.on('error', err => { console.error(err); process.exit(1); });
