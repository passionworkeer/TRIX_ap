import express from 'express';
import { createServer } from 'http';
import { lookup } from 'dns/promises';
import { randomBytes, timingSafeEqual } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { isIP } from 'net';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = (process.env.CANVAS_HOST || '127.0.0.1').trim() || '127.0.0.1';
const PORT = Number(process.env.CANVAS_PORT || 8789);
const APP_ORIGIN = process.env.CANVAS_BASE_URL || defaultBaseUrl(HOST, PORT);
const DATA_ROOT = resolve(process.env.CANVAS_DATA_DIR || join(__dirname, 'data'));
const EXPORT_ROOT = resolve(process.env.CANVAS_EXPORT_DIR || join(__dirname, 'exports'));
const CANVAS_REQUIRE_AUTH = /^(1|true|yes)$/i.test(process.env.CANVAS_REQUIRE_AUTH || '');
const CANVAS_ALLOW_INSECURE_PUBLIC = /^(1|true|yes)$/i.test(
  process.env.CANVAS_ALLOW_INSECURE_PUBLIC || '',
);
const CANVAS_AUTH_TOKEN_FILE = resolve(
  process.env.CANVAS_AUTH_TOKEN_FILE || join(DATA_ROOT, '.canvas-access-token'),
);
const CANVAS_AUTH_COOKIE = 'trix_canvas_auth';
const CANVAS_ALLOWED_ORIGINS = parseOriginList(process.env.CANVAS_ALLOWED_ORIGINS || '');
const CANVAS_AUTH_TOKEN_INFO = resolveCanvasAccessToken();
const CANVAS_ACCESS_TOKEN = CANVAS_AUTH_TOKEN_INFO.value;

const PROJECTS_DIR = join(DATA_ROOT, 'projects');
const NODES_DIR = join(DATA_ROOT, 'nodes');
const EDGES_DIR = join(DATA_ROOT, 'edges');
const FILES_DIR = join(DATA_ROOT, 'files');
const SESSIONS_DIR = join(DATA_ROOT, 'sessions');
const EXPORT_JOBS_DIR = join(DATA_ROOT, 'export-jobs');
const BLOB_DIR = join(DATA_ROOT, 'blobs');

const AI_API_BASE = (process.env.AI_API_BASE || '').replace(/\/$/, '');
const AI_GENERATE_PATH = process.env.AI_GENERATE_PATH || '/generate';
const AI_TASK_PATH_TEMPLATE = process.env.AI_TASK_PATH_TEMPLATE || '/tasks/:taskId';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_EXTRA_HEADERS = parseHeaderLines(process.env.AI_EXTRA_HEADERS || '');
const CANVAS_JSON_LIMIT = process.env.CANVAS_JSON_LIMIT || '50mb';
const AI_REQUEST_TIMEOUT_MS = readPositiveNumber(process.env.CANVAS_AI_REQUEST_TIMEOUT_MS, 60_000);
const REMOTE_FETCH_TIMEOUT_MS = readPositiveNumber(process.env.CANVAS_REMOTE_FETCH_TIMEOUT_MS, 30_000);
const MAX_CONCURRENT_EXPORTS = readPositiveNumber(process.env.CANVAS_MAX_CONCURRENT_EXPORTS, 2);
const MAX_CONCURRENT_SESSION_REFRESHES = readPositiveNumber(
  process.env.CANVAS_MAX_CONCURRENT_SESSION_REFRESHES,
  4,
);
const SESSION_REFRESH_MIN_INTERVAL_MS = readPositiveNumber(
  process.env.CANVAS_SESSION_REFRESH_MIN_INTERVAL_MS,
  2_000,
);
const SESSION_REFRESH_MAX_INTERVAL_MS = readPositiveNumber(
  process.env.CANVAS_SESSION_REFRESH_MAX_INTERVAL_MS,
  15_000,
);
const SESSION_BACKGROUND_REFRESH_ENABLED = !/^(0|false|no)$/i.test(
  process.env.CANVAS_SESSION_BACKGROUND_REFRESH || 'true',
);
const MAX_REMOTE_DOWNLOAD_BYTES = readPositiveNumber(
  process.env.CANVAS_MAX_REMOTE_DOWNLOAD_BYTES,
  200 * 1024 * 1024,
);
const MAX_UPLOAD_BYTES = readPositiveNumber(process.env.CANVAS_MAX_UPLOAD_BYTES, 200 * 1024 * 1024);
const ALLOW_PRIVATE_REMOTE_URLS = /^true$/i.test(
  process.env.CANVAS_ALLOW_PRIVATE_REMOTE_URLS || '',
);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.mp4',
  '.mov',
  '.webm',
]);
const SAFE_RECORD_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const inFlightSessionRefreshes = new Map();
const scheduledSessionRefreshes = new Map();
const sessionRefreshBackoffAttempts = new Map();
const sessionRefreshWaiters = [];
const inFlightVideoExportJobs = new Map();
let activeSessionRefreshes = 0;

const EXPORT_ASPECTS = new Map([
  ['origin', null],
  ['9:16', { width: 1080, height: 1920, label: '9:16' }],
  ['16:9', { width: 1920, height: 1080, label: '16:9' }],
  ['1:1', { width: 1080, height: 1080, label: '1:1' }],
  ['4:3', { width: 1440, height: 1080, label: '4:3' }],
]);

[
  DATA_ROOT,
  EXPORT_ROOT,
  PROJECTS_DIR,
  NODES_DIR,
  EDGES_DIR,
  FILES_DIR,
  SESSIONS_DIR,
  EXPORT_JOBS_DIR,
  BLOB_DIR,
].forEach((dir) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: CANVAS_JSON_LIMIT }));
app.use((req, res, next) => {
  const pathname = req.path || '/';
  const leaf = basename(pathname);
  if (
    !pathname.startsWith('/api/')
    && !pathname.startsWith('/media/')
    && (
      leaf.startsWith('.')
      || leaf === 'test.html'
      || ['.bak', '.orig', '.rej', '.tmp', '.swp', '.swo'].some((suffix) => leaf.endsWith(suffix))
    )
  ) {
    return res.status(404).json({ error: 'not found' });
  }
  return next();
});
app.use(express.static(join(__dirname, 'public'), { dotfiles: 'ignore' }));

function isTrustedCanvasOrigin(origin) {
  return !origin || origin === APP_ORIGIN || CANVAS_ALLOWED_ORIGINS.has(origin);
}

app.use((req, res, next) => {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  const isProtectedPath = req.path.startsWith('/api/') || req.path.startsWith('/media/');
  if (origin) {
    appendVaryHeader(res, 'Origin');
  }
  if (origin && isTrustedCanvasOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    if (origin && isProtectedPath && !isTrustedCanvasOrigin(origin)) {
      return res.sendStatus(403);
    }
    return res.sendStatus(204);
  }
  if (origin && isProtectedPath && !isTrustedCanvasOrigin(origin)) {
    return res.status(403).json({ error: 'origin not allowed' });
  }
  if (isProtectedPath && !isCanvasAuthExemptPath(req.path)) {
    assertCanvasAuthenticated(req);
  }
  return next();
});

function parseHeaderLines(raw) {
  const headers = {};
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    });
  return headers;
}

function defaultBaseUrl(host, port) {
  const publicHost = !host || host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const formattedHost = publicHost.includes(':') && !publicHost.startsWith('[')
    ? `[${publicHost}]`
    : publicHost;
  return `http://${formattedHost}:${port}`;
}

function isLoopbackHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]';
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOriginList(raw) {
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function appendVaryHeader(res, value) {
  const current = res.getHeader('Vary');
  if (!current) {
    res.setHeader('Vary', value);
    return;
  }
  const next = new Set(String(current).split(',').map((item) => item.trim()).filter(Boolean));
  next.add(value);
  res.setHeader('Vary', Array.from(next).join(', '));
}

function resolveCanvasAccessToken() {
  const explicit = (process.env.CANVAS_ACCESS_TOKEN || '').trim();
  if (!CANVAS_REQUIRE_AUTH) {
    return { value: explicit, source: explicit ? 'env' : 'disabled' };
  }
  if (explicit) {
    return { value: explicit, source: 'env' };
  }
  try {
    if (existsSync(CANVAS_AUTH_TOKEN_FILE)) {
      const stored = readFileSync(CANVAS_AUTH_TOKEN_FILE, 'utf8').trim();
      if (stored) {
        return { value: stored, source: 'file' };
      }
    }
    const generated = randomBytes(24).toString('hex');
    mkdirSync(dirname(CANVAS_AUTH_TOKEN_FILE), { recursive: true });
    writeFileSync(CANVAS_AUTH_TOKEN_FILE, `${generated}\n`, { mode: 0o600 });
    return { value: generated, source: 'generated-file' };
  } catch (error) {
    throw new Error(
      `Failed to provision CANVAS_ACCESS_TOKEN at ${CANVAS_AUTH_TOKEN_FILE}: ${error.message}`,
    );
  }
}

function assertSafeBindConfiguration() {
  if (!isLoopbackHost(HOST) && !CANVAS_REQUIRE_AUTH && !CANVAS_ALLOW_INSECURE_PUBLIC) {
    throw new Error(
      'Refusing to expose Canvas on a non-loopback host without auth. '
      + 'Set CANVAS_REQUIRE_AUTH=true or CANVAS_ALLOW_INSECURE_PUBLIC=true to override.',
    );
  }
}

assertSafeBindConfiguration();

function isCanvasAuthExemptPath(pathname) {
  return pathname === '/health'
    || pathname === '/api/auth/status'
    || pathname === '/api/auth/login'
    || pathname === '/api/auth/logout';
}

function parseCookies(request) {
  const raw = request.headers.cookie || '';
  return Object.fromEntries(
    raw
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=');
        if (separator <= 0) {
          return [entry, ''];
        }
        return [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))];
      }),
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  return parts.join('; ');
}

function matchesCanvasAccessToken(candidate) {
  if (!CANVAS_REQUIRE_AUTH) {
    return true;
  }
  if (!candidate) {
    return false;
  }
  const received = Buffer.from(String(candidate));
  const expected = Buffer.from(CANVAS_ACCESS_TOKEN);
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(received, expected);
}

function getCanvasPresentedToken(request) {
  const authorization = request.headers.authorization;
  const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
  const match = typeof bearer === 'string' ? bearer.match(/^Bearer\s+(.+)$/i) : null;
  if (match?.[1]) {
    return match[1].trim();
  }
  const cookies = parseCookies(request);
  return cookies[CANVAS_AUTH_COOKIE];
}

function assertCanvasAuthenticated(request) {
  if (!CANVAS_REQUIRE_AUTH) {
    return;
  }
  if (!matchesCanvasAccessToken(getCanvasPresentedToken(request))) {
    throw httpError('Canvas authentication required', 401, 'CANVAS_AUTH_REQUIRED');
  }
}

function isSafeCanvasMediaUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return null;
  }
  try {
    const parsed = new URL(rawUrl, APP_ORIGIN);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function httpError(message, statusCode = 400, code = '') {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

function assertSafeRecordId(id, label = 'record id') {
  const normalized = String(id || '').trim();
  if (!SAFE_RECORD_ID_RE.test(normalized)) {
    throw httpError(`${label} 非法`, 400, 'RECORD_ID_INVALID');
  }
  return normalized;
}

function recordPath(dir, id) {
  return join(dir, `${assertSafeRecordId(id)}.json`);
}

function readRecord(dir, id) {
  const file = recordPath(dir, id);
  if (!existsSync(file)) {
    return null;
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeRecord(dir, id, value) {
  writeFileSync(recordPath(dir, id), JSON.stringify(value, null, 2));
  return value;
}

function deleteRecord(dir, id) {
  const file = recordPath(dir, id);
  if (existsSync(file)) {
    rmSync(file, { force: true });
  }
}

function listRecords(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(dir, name), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function clampNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferMimeType(filename = '', fallback = 'application/octet-stream') {
  const ext = extname(filename).toLowerCase();
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
    }[ext] || fallback
  );
}

function inferExtension(filename = '', mimeType = '') {
  const ext = extname(filename).toLowerCase();
  if (ext) {
    return ext;
  }
  return (
    {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
    }[mimeType] || ''
  );
}

function guessMediaType(mimeType = '', filename = '') {
  if (mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm'].includes(extname(filename).toLowerCase())) {
    return 'video';
  }
  return 'image';
}

function sanitizeFilename(filename) {
  const base = basename(filename || 'asset').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'asset';
}

function buildTaskPath(taskId) {
  return AI_TASK_PATH_TEMPLATE.replace(':taskId', taskId).replace('{taskId}', taskId);
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
    return 'error';
  }
  if (['processing', 'running', 'queued', 'pending', 'submitted', 'generating'].includes(status)) {
    return 'generating';
  }
  return status;
}

function extractTaskId(payload) {
  return (
    payload?.task_id ||
    payload?.taskId ||
    payload?.id ||
    payload?.data?.task_id ||
    payload?.data?.taskId ||
    payload?.data?.id ||
    payload?.result?.task_id ||
    payload?.result?.taskId ||
    ''
  );
}

function extractUrls(payload) {
  const candidates = [
    payload?.url,
    payload?.urls,
    payload?.output?.url,
    payload?.output?.urls,
    payload?.data?.url,
    payload?.data?.urls,
    payload?.result?.url,
    payload?.result?.urls,
    payload?.video?.url,
    payload?.image?.url,
    Array.isArray(payload?.images) ? payload.images.map((item) => item?.url || item) : null,
    Array.isArray(payload?.videos) ? payload.videos.map((item) => item?.url || item) : null,
  ];
  return [...new Set(candidates.flat(Infinity).filter((value) => typeof value === 'string' && value.trim()))];
}

function extractBase64Result(payload) {
  const base64 = payload?.base64 || payload?.output?.base64 || payload?.data?.base64;
  if (typeof base64 === 'string' && base64.trim()) {
    return [base64];
  }
  const imageBase64 = payload?.data?.image_base64;
  if (Array.isArray(imageBase64)) {
    return imageBase64.filter((item) => typeof item === 'string' && item.trim());
  }
  return [];
}

function toArrayBufferBytes(value) {
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }
  return null;
}

function serializeFile(file) {
  if (!file) {
    return null;
  }
  return {
    ...file,
    projectId: file.project_id,
    nodeId: file.node_id,
    mimeType: file.mime_type,
    mediaType: file.media_type,
    sceneId: file.scene_id,
    storedFilename: file.stored_filename,
    sourceUrl: file.source_url,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
}

function serializeNode(node, fileMap = new Map()) {
  if (!node) {
    return null;
  }
  const linkedFile = node.file_id ? fileMap.get(node.file_id) : null;
  const safeResultUrl = isSafeCanvasMediaUrl(node.result_url);
  const previewUrl = isSafeCanvasMediaUrl(linkedFile?.url || safeResultUrl || null);
  return {
    ...node,
    projectId: node.project_id,
    sessionId: node.session_id,
    fileId: node.file_id,
    parentNodeId: node.parent_node_id,
    sceneId: node.scene_id,
    mediaType: node.media_type,
    resultUrl: safeResultUrl,
    previewUrl,
    createdAt: node.created_at,
    updatedAt: node.updated_at,
    file: linkedFile ? serializeFile(linkedFile) : null,
  };
}

function serializeEdge(edge) {
  if (!edge) {
    return null;
  }
  return {
    ...edge,
    projectId: edge.project_id,
    sourceNodeId: edge.source_node_id,
    targetNodeId: edge.target_node_id,
    edgeType: edge.edge_type,
    createdAt: edge.created_at,
    updatedAt: edge.updated_at,
  };
}

function serializeSession(session) {
  if (!session) {
    return null;
  }
  return {
    ...session,
    projectId: session.project_id,
    nodeId: session.node_id,
    parentNodeId: session.parent_node_id,
    mediaType: session.media_type,
    taskId: session.task_id,
    resultUrls: session.result_urls || [],
    upstreamStatus: session.upstream_status,
    lastPolledAt: session.last_polled_at,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

function serializeExportJob(job) {
  if (!job) {
    return null;
  }
  return {
    ...job,
    projectId: job.project_id,
    jobType: job.job_type,
    outputUrl: job.output_url,
    outputPath: job.output_path,
    contentType: job.content_type,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

function saveExportJob(job) {
  job.updated_at = nowIso();
  return writeRecord(EXPORT_JOBS_DIR, job.id, job);
}

function readExportJob(jobId) {
  return readRecord(EXPORT_JOBS_DIR, jobId);
}

function createExportJob({ project_id, job_type = 'video', aspect = 'origin' }) {
  const timestamp = nowIso();
  const job = {
    id: uuidv4(),
    project_id,
    job_type,
    aspect,
    status: 'queued',
    output_url: null,
    output_path: null,
    content_type: job_type === 'video' ? 'video/mp4' : 'application/octet-stream',
    segments: 0,
    size: 0,
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  return writeRecord(EXPORT_JOBS_DIR, job.id, job);
}

function recoverInterruptedExportJobs() {
  listRecords(EXPORT_JOBS_DIR)
    .filter((job) => job?.status === 'queued' || job?.status === 'running')
    .forEach((job) => {
      saveExportJob({
        ...job,
        status: 'error',
        error: job.error || 'Export interrupted by service restart',
      });
    });
}

function readBooleanFlag(value) {
  if (Array.isArray(value)) {
    return value.some((entry) => readBooleanFlag(entry));
  }
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function prefersAsyncResponse(req) {
  const prefer = Array.isArray(req.headers.prefer) ? req.headers.prefer.join(',') : req.headers.prefer;
  return /\brespond-async\b/i.test(String(prefer || ''));
}

function serializeProject(project) {
  const fileMap = new Map();
  const files = (project.file_ids || [])
    .map((id) => readRecord(FILES_DIR, id))
    .filter(Boolean)
    .map((file) => {
      fileMap.set(file.id, file);
      return serializeFile(file);
    });
  const nodes = (project.node_ids || [])
    .map((id) => readRecord(NODES_DIR, id))
    .filter(Boolean)
    .map((node) => serializeNode(node, fileMap));
  const edges = (project.edge_ids || [])
    .map((id) => readRecord(EDGES_DIR, id))
    .filter(Boolean)
    .map(serializeEdge);
  const sessions = (project.session_ids || [])
    .map((id) => readRecord(SESSIONS_DIR, id))
    .filter(Boolean)
    .map(serializeSession);
  return {
    ...project,
    scriptText: project.script_text,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    fileCount: files.length,
    sessionCount: sessions.length,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    nodes,
    edges,
    files,
    sessions,
    canvasUrl: `${APP_ORIGIN}/canvas?projectId=${project.id}`,
  };
}

function saveProject(project) {
  project.updated_at = nowIso();
  return writeRecord(PROJECTS_DIR, project.id, project);
}

function getProject(projectId) {
  return readRecord(PROJECTS_DIR, projectId);
}

function requireProject(projectId) {
  const project = getProject(projectId);
  if (!project) {
    const error = new Error('项目不存在');
    error.statusCode = 404;
    throw error;
  }
  return project;
}

function requireNode(nodeId, { projectId = null } = {}) {
  const node = readRecord(NODES_DIR, nodeId);
  if (!node) {
    const error = new Error('节点不存在');
    error.statusCode = 404;
    throw error;
  }
  if (projectId && node.project_id !== projectId) {
    throw httpError('节点不属于当前项目', 409, 'NODE_PROJECT_MISMATCH');
  }
  return node;
}

function requireFile(fileId, { projectId = null } = {}) {
  const file = readRecord(FILES_DIR, fileId);
  if (!file) {
    const error = new Error('文件不存在');
    error.statusCode = 404;
    throw error;
  }
  if (projectId && file.project_id !== projectId) {
    throw httpError('文件不属于当前项目', 409, 'FILE_PROJECT_MISMATCH');
  }
  return file;
}

function requireSession(sessionId, { projectId = null } = {}) {
  const session = readRecord(SESSIONS_DIR, sessionId);
  if (!session) {
    const error = new Error('会话不存在');
    error.statusCode = 404;
    throw error;
  }
  if (projectId && session.project_id !== projectId) {
    throw httpError('会话不属于当前项目', 409, 'SESSION_PROJECT_MISMATCH');
  }
  return session;
}

function createProject({ name = 'Untitled project', script_text = '' } = {}) {
  const timestamp = nowIso();
  const project = {
    id: uuidv4(),
    name,
    script_text,
    node_ids: [],
    edge_ids: [],
    file_ids: [],
    session_ids: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeRecord(PROJECTS_DIR, project.id, project);
  return project;
}

function addUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function removeValue(list, value) {
  const index = list.indexOf(value);
  if (index >= 0) {
    list.splice(index, 1);
  }
}

function updateNodeRecord(nodeId, patch) {
  const node = readRecord(NODES_DIR, nodeId);
  if (!node) {
    const error = new Error('节点不存在');
    error.statusCode = 404;
    throw error;
  }
  const next = {
    ...node,
    ...patch,
    id: node.id,
    updated_at: nowIso(),
  };
  writeRecord(NODES_DIR, nodeId, next);
  if (next.project_id) {
    const project = getProject(next.project_id);
    if (project) {
      saveProject(project);
    }
  }
  return next;
}

function createNode({
  project_id,
  session_id = null,
  file_id = null,
  parent_node_id = null,
  scene_id = null,
  media_type = 'image',
  x = 60,
  y = 60,
  prompt = '',
  status = 'pending',
  aspect = 'origin',
  style = '',
  task_id = '',
  result_url = null,
  error = null,
}) {
  const timestamp = nowIso();
  const node = {
    id: uuidv4(),
    project_id,
    session_id,
    file_id,
    parent_node_id,
    scene_id,
    media_type,
    x: clampNumber(x, 60),
    y: clampNumber(y, 60),
    prompt,
    status,
    aspect,
    style,
    task_id,
    result_url,
    error,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeRecord(NODES_DIR, node.id, node);
  const project = requireProject(project_id);
  addUnique(project.node_ids, node.id);
  saveProject(project);
  return node;
}

function createEdge({ project_id, source_node_id, target_node_id, edge_type = 'scene_order' }) {
  const timestamp = nowIso();
  const edge = {
    id: uuidv4(),
    project_id,
    source_node_id,
    target_node_id,
    edge_type,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeRecord(EDGES_DIR, edge.id, edge);
  const project = requireProject(project_id);
  addUnique(project.edge_ids, edge.id);
  saveProject(project);
  return edge;
}

function removeEdge(edgeId) {
  const edge = readRecord(EDGES_DIR, edgeId);
  if (!edge) {
    return false;
  }
  const project = getProject(edge.project_id);
  if (project) {
    removeValue(project.edge_ids, edge.id);
    saveProject(project);
  }
  deleteRecord(EDGES_DIR, edge.id);
  return true;
}

function removeNode(nodeId) {
  const node = readRecord(NODES_DIR, nodeId);
  if (!node) {
    return false;
  }
  const project = getProject(node.project_id);
  if (project) {
    removeValue(project.node_ids, node.id);
    project.edge_ids
      .map((edgeId) => readRecord(EDGES_DIR, edgeId))
      .filter(Boolean)
      .filter((edge) => edge.source_node_id === node.id || edge.target_node_id === node.id)
      .forEach((edge) => removeEdge(edge.id));

    if (node.session_id) {
      removeValue(project.session_ids, node.session_id);
      deleteRecord(SESSIONS_DIR, node.session_id);
    }
    if (node.file_id) {
      const remainingReferences = listRecords(NODES_DIR).filter(
        (candidate) => candidate.id !== node.id && candidate.file_id === node.file_id,
      );
      if (remainingReferences.length === 0) {
        removeFile(node.file_id);
      }
    }
    saveProject(project);
  }
  deleteRecord(NODES_DIR, node.id);
  return true;
}

function removeFile(fileId) {
  const file = readRecord(FILES_DIR, fileId);
  if (!file) {
    return false;
  }
  const project = getProject(file.project_id);
  if (project) {
    removeValue(project.file_ids, file.id);
    saveProject(project);
  }
  if (file.stored_filename) {
    const blobPath = join(BLOB_DIR, file.stored_filename);
    if (existsSync(blobPath)) {
      unlinkSync(blobPath);
    }
  }
  deleteRecord(FILES_DIR, file.id);
  return true;
}

function deleteProject(projectId) {
  const project = getProject(projectId);
  if (!project) {
    return false;
  }
  [...project.edge_ids].forEach((edgeId) => removeEdge(edgeId));
  [...project.node_ids].forEach((nodeId) => removeNode(nodeId));
  [...project.file_ids].forEach((fileId) => removeFile(fileId));
  [...project.session_ids].forEach((sessionId) => deleteRecord(SESSIONS_DIR, sessionId));
  deleteRecord(PROJECTS_DIR, projectId);
  return true;
}

async function requestJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options, AI_REQUEST_TIMEOUT_MS);
  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { raw: rawText };
  }
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || `${response.status} ${response.statusText}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw httpError('请求超时', 504, 'REQUEST_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildAiHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    ...AI_EXTRA_HEADERS,
  };
  if (AI_API_KEY) {
    headers.Authorization = `Bearer ${AI_API_KEY}`;
  }
  return headers;
}

async function invokeAi(path, body, method = 'POST') {
  if (!AI_API_BASE) {
    const error = new Error('AI_API_BASE 未配置');
    error.statusCode = 500;
    throw error;
  }
  return requestJson(`${AI_API_BASE}${path}`, {
    method,
    headers: buildAiHeaders(),
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}

function buildGeneratePayload(session) {
  return {
    prompt: session.message,
    message: session.message,
    media_type: session.media_type,
    mediaType: session.media_type,
    aspect: session.aspect,
    style: session.style,
    project_id: session.project_id,
    projectId: session.project_id,
    session_id: session.id,
    sessionId: session.id,
    parent_node_id: session.parent_node_id,
    parentNodeId: session.parent_node_id,
  };
}

async function downloadRemoteAsset(url) {
  const safeUrl = await assertSafeRemoteUrl(url);
  const response = await fetchWithTimeout(
    safeUrl,
    {
      headers: {
        'User-Agent': 'TRIX-Canvas/1.0',
      },
      redirect: 'manual',
    },
    REMOTE_FETCH_TIMEOUT_MS,
  );
  if (response.status >= 300 && response.status < 400) {
    throw httpError('remote url 不允许跳转', 400, 'REMOTE_URL_REDIRECT');
  }
  if (!response.ok) {
    throw new Error(`下载结果失败: ${response.status}`);
  }
  const mimeType = (response.headers.get('content-type') || inferMimeType(url)).split(';')[0].trim();
  const bytes = await readResponseBuffer(response);
  return { bytes, mimeType, sourceUrl: safeUrl };
}

function detectMediaFormat(bytes) {
  if (!bytes || bytes.length < 4) {
    return null;
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: '.png', mediaType: 'image' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg', mediaType: 'image' };
  }
  if (bytes.length >= 6) {
    const signature = bytes.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return { mimeType: 'image/gif', extension: '.gif', mediaType: 'image' };
    }
  }
  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: '.webp', mediaType: 'image' };
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') {
      return { mimeType: 'video/quicktime', extension: '.mov', mediaType: 'video' };
    }
    return { mimeType: 'video/mp4', extension: '.mp4', mediaType: 'video' };
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mimeType: 'video/webm', extension: '.webm', mediaType: 'video' };
  }
  return null;
}

function decodeBase64Payload(raw) {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '');
  if (!normalized) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw httpError('fileData 不是合法的 base64', 400, 'UPLOAD_BASE64_INVALID');
  }
  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.length === 0) {
    throw httpError('上传文件为空', 400, 'UPLOAD_EMPTY');
  }
  return bytes;
}

function validateUploadedAsset({ bytes, filename, mimeType, mediaType }) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw httpError('上传文件为空', 400, 'UPLOAD_EMPTY');
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw httpError('上传文件过大', 413, 'UPLOAD_TOO_LARGE');
  }

  const safeFilename = sanitizeFilename(filename || 'upload');
  const cleanMimeType = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const declaredMimeType = cleanMimeType || inferMimeType(safeFilename, '');
  const declaredExtension = extname(safeFilename).toLowerCase();
  const detected = detectMediaFormat(bytes);
  const declaredMediaType = String(mediaType || '').trim().toLowerCase();
  if (!detected) {
    throw httpError('无法识别上传文件内容', 400, 'UPLOAD_CONTENT_UNRECOGNIZED');
  }
  const finalMimeType = detected.mimeType;
  const finalExtension = detected.extension;
  const finalMediaType = detected.mediaType;

  if (!finalMimeType || !ALLOWED_UPLOAD_MIME_TYPES.has(finalMimeType)) {
    throw httpError('不支持的上传文件类型', 400, 'UPLOAD_TYPE_UNSUPPORTED');
  }
  if (!finalExtension || !ALLOWED_UPLOAD_EXTENSIONS.has(finalExtension)) {
    throw httpError('不支持的上传文件扩展名', 400, 'UPLOAD_EXTENSION_UNSUPPORTED');
  }
  if (declaredMimeType && declaredMimeType !== finalMimeType) {
    throw httpError('上传文件类型与内容不匹配', 400, 'UPLOAD_TYPE_MISMATCH');
  }
  if (declaredExtension && declaredExtension !== finalExtension) {
    throw httpError('上传文件扩展名与内容不匹配', 400, 'UPLOAD_EXTENSION_MISMATCH');
  }
  if (declaredMediaType && declaredMediaType !== finalMediaType) {
    throw httpError('上传文件类型与内容不匹配', 400, 'UPLOAD_TYPE_MISMATCH');
  }

  return {
    filename: declaredExtension ? safeFilename : `${safeFilename}${finalExtension}`,
    mimeType: finalMimeType,
    mediaType: finalMediaType,
  };
}

let activeExportJobs = 0;
const exportWaiters = [];

async function withExportSlot(task) {
  if (activeExportJobs >= MAX_CONCURRENT_EXPORTS) {
    await new Promise((resolvePromise) => exportWaiters.push(resolvePromise));
  }
  activeExportJobs += 1;
  try {
    return await task();
  } finally {
    activeExportJobs = Math.max(0, activeExportJobs - 1);
    const next = exportWaiters.shift();
    if (next) {
      next();
    }
  }
}

async function withSessionRefreshSlot(task) {
  if (activeSessionRefreshes >= MAX_CONCURRENT_SESSION_REFRESHES) {
    await new Promise((resolvePromise) => sessionRefreshWaiters.push(resolvePromise));
  }
  activeSessionRefreshes += 1;
  try {
    return await task();
  } finally {
    activeSessionRefreshes = Math.max(0, activeSessionRefreshes - 1);
    const next = sessionRefreshWaiters.shift();
    if (next) {
      next();
    }
  }
}

function buildExportStem(project, suffix = '') {
  const stamp = nowIso().replace(/[-:.TZ]/g, '').slice(0, 14);
  const label = suffix ? `_${suffix}` : '';
  return `${sanitizeFilename(project.name || project.id)}${label}_${stamp}_${uuidv4().slice(0, 8)}`;
}

function runCommand(command, args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      const error = new Error(`${command} timeout after ${timeoutMs}ms`);
      error.code = 'COMMAND_TIMEOUT';
      reject(error);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolvePromise({
        status: status ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

function isPrivateIpAddress(address) {
  if (!address) {
    return false;
  }

  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpAddress(normalized.slice(7));
  }

  const version = isIP(normalized);
  if (version === 4) {
    const octets = normalized.split('.').map((part) => Number(part));
    return (
      octets[0] === 0
      || octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
    );
  }

  if (version === 6) {
    return (
      normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:')
    );
  }

  return false;
}

async function assertSafeRemoteUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw httpError('remote url 非法', 400, 'REMOTE_URL_INVALID');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw httpError('remote url 只允许 http/https 协议', 400, 'REMOTE_URL_INVALID');
  }
  if (parsed.username || parsed.password) {
    throw httpError('remote url 不允许内嵌认证信息', 400, 'REMOTE_URL_INVALID');
  }

  if (ALLOW_PRIVATE_REMOTE_URLS) {
    return parsed.toString();
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw httpError('禁止访问本地或局域网 remote url', 400, 'REMOTE_URL_BLOCKED');
  }
  if (isPrivateIpAddress(hostname)) {
    throw httpError('禁止访问私有地址 remote url', 400, 'REMOTE_URL_BLOCKED');
  }

  try {
    const resolved = await lookup(hostname, { all: true, verbatim: true });
    if (!resolved.length) {
      throw httpError('remote url 主机解析失败', 400, 'REMOTE_URL_INVALID');
    }
    if (resolved.some((entry) => isPrivateIpAddress(entry.address))) {
      throw httpError('禁止访问私有地址 remote url', 400, 'REMOTE_URL_BLOCKED');
    }
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }
    throw httpError('remote url 主机解析失败', 400, 'REMOTE_URL_INVALID');
  }

  return parsed.toString();
}

async function readResponseBuffer(response) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_REMOTE_DOWNLOAD_BYTES) {
    throw httpError('远程文件过大', 413, 'REMOTE_URL_TOO_LARGE');
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_REMOTE_DOWNLOAD_BYTES) {
      throw httpError('远程文件过大', 413, 'REMOTE_URL_TOO_LARGE');
    }
    return bytes;
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > MAX_REMOTE_DOWNLOAD_BYTES) {
      throw httpError('远程文件过大', 413, 'REMOTE_URL_TOO_LARGE');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function storeFileBuffer({
  bytes,
  filename,
  mime_type = inferMimeType(filename),
  media_type = guessMediaType(mime_type, filename),
  project_id,
  node_id = null,
  prompt = '',
  scene_id = null,
  source_url = null,
}) {
  const timestamp = nowIso();
  const id = uuidv4();
  const safeFilename = sanitizeFilename(filename || `asset${inferExtension('', mime_type)}`);
  const ext = inferExtension(safeFilename, mime_type);
  const storedFilename = `${id}${ext || ''}`;
  const blobPath = join(BLOB_DIR, storedFilename);
  writeFileSync(blobPath, bytes);

  const file = {
    id,
    project_id,
    node_id,
    filename: safeFilename,
    stored_filename: storedFilename,
    mime_type,
    media_type,
    prompt,
    scene_id,
    size: bytes.length,
    source_url,
    created_at: timestamp,
    updated_at: timestamp,
    url: `/media/files/${storedFilename}`,
  };
  writeRecord(FILES_DIR, id, file);
  const project = requireProject(project_id);
  addUnique(project.file_ids, id);
  saveProject(project);
  return file;
}

function fileNameFromUrl(url, fallback = 'result') {
  try {
    const parsed = new URL(url);
    const candidate = basename(parsed.pathname || '') || fallback;
    return candidate;
  } catch {
    return fallback;
  }
}

async function storeSessionResult(session, node, payload) {
  const urls = extractUrls(payload);
  const base64Results = extractBase64Result(payload);
  let storedFile = null;
  let publicUrl = null;

  if (urls.length > 0) {
    const remoteUrl = urls[0];
    const downloaded = await downloadRemoteAsset(remoteUrl);
    storedFile = storeFileBuffer({
      bytes: downloaded.bytes,
      filename: fileNameFromUrl(remoteUrl, `${session.media_type}-result`),
      mime_type: downloaded.mimeType,
      media_type: session.media_type,
      project_id: session.project_id,
      node_id: node.id,
      prompt: session.message,
      scene_id: node.scene_id,
      source_url: downloaded.sourceUrl,
    });
    publicUrl = storedFile.url;
  } else if (base64Results.length > 0) {
    const mimeType = session.media_type === 'video' ? 'video/mp4' : 'image/png';
    storedFile = storeFileBuffer({
      bytes: toArrayBufferBytes(base64Results[0]),
      filename: `${session.media_type}-result${inferExtension('', mimeType)}`,
      mime_type: mimeType,
      media_type: session.media_type,
      project_id: session.project_id,
      node_id: node.id,
      prompt: session.message,
      scene_id: node.scene_id,
    });
    publicUrl = storedFile.url;
  }

  const updatedSession = {
    ...session,
    status: 'completed',
    task_id: session.task_id || extractTaskId(payload) || '',
    upstream_status: 'completed',
    result_urls: publicUrl ? [publicUrl] : urls,
    error: null,
    updated_at: nowIso(),
  };
  writeRecord(SESSIONS_DIR, session.id, updatedSession);

  const updatedNode = updateNodeRecord(node.id, {
    status: 'completed',
    file_id: storedFile?.id || node.file_id,
    result_url: publicUrl || urls[0] || node.result_url,
    error: null,
    task_id: updatedSession.task_id,
  });

  clearScheduledSessionRefresh(session.id);
  sessionRefreshBackoffAttempts.delete(session.id);

  return { session: updatedSession, node: updatedNode };
}

async function failSession(session, message) {
  const updatedSession = {
    ...session,
    status: 'error',
    upstream_status: 'error',
    error: message,
    updated_at: nowIso(),
  };
  writeRecord(SESSIONS_DIR, session.id, updatedSession);
  updateNodeRecord(session.node_id, {
    status: 'error',
    error: message,
  });
  clearScheduledSessionRefresh(session.id);
  sessionRefreshBackoffAttempts.delete(session.id);
  return updatedSession;
}

function clearScheduledSessionRefresh(sessionId) {
  const scheduled = scheduledSessionRefreshes.get(sessionId);
  if (!scheduled) {
    return;
  }
  clearTimeout(scheduled.timer);
  scheduledSessionRefreshes.delete(sessionId);
}

function nextSessionRefreshDelay(session) {
  const attempts = sessionRefreshBackoffAttempts.get(session.id) || 0;
  const baseDelay = session.media_type === 'video' ? 2_500 : 1_000;
  return Math.min(
    SESSION_REFRESH_MAX_INTERVAL_MS,
    Math.max(SESSION_REFRESH_MIN_INTERVAL_MS, baseDelay * (2 ** Math.min(attempts, 4))),
  );
}

function scheduleSessionRefresh(sessionId, delayMs = SESSION_REFRESH_MIN_INTERVAL_MS) {
  if (!SESSION_BACKGROUND_REFRESH_ENABLED) {
    return;
  }
  const session = readRecord(SESSIONS_DIR, sessionId);
  if (!session || session.status !== 'generating' || !session.task_id || !AI_API_BASE) {
    clearScheduledSessionRefresh(sessionId);
    return;
  }

  const safeDelay = Math.max(0, delayMs);
  const dueAt = Date.now() + safeDelay;
  const current = scheduledSessionRefreshes.get(sessionId);
  if (current && current.dueAt <= dueAt) {
    return;
  }
  if (current) {
    clearTimeout(current.timer);
  }

  const timer = setTimeout(() => {
    scheduledSessionRefreshes.delete(sessionId);
    refreshSession(sessionId).catch((error) => {
      console.error(`[session-refresh] ${sessionId}: ${error.message}`);
    });
  }, safeDelay);
  timer.unref?.();
  scheduledSessionRefreshes.set(sessionId, { timer, dueAt });
}

function refreshProjectSessions(sessionIds, { wait = false, force = false } = {}) {
  const uniqueIds = [...new Set((sessionIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (wait) {
    return Promise.all(uniqueIds.map((sessionId) => refreshSession(sessionId, { force })));
  }
  uniqueIds.forEach((sessionId) => scheduleSessionRefresh(sessionId, 0));
  return Promise.resolve([]);
}

function recoverGeneratingSessions() {
  if (!SESSION_BACKGROUND_REFRESH_ENABLED) {
    return;
  }
  listRecords(SESSIONS_DIR)
    .filter((session) => session?.status === 'generating' && session?.task_id)
    .forEach((session) => scheduleSessionRefresh(session.id, SESSION_REFRESH_MIN_INTERVAL_MS));
}

function defaultNodePosition(project, parentNodeId = null) {
  if (parentNodeId) {
    const parent = readRecord(NODES_DIR, parentNodeId);
    if (parent) {
      return {
        x: clampNumber(parent.x, 60),
        y: clampNumber(parent.y, 60) + 320,
      };
    }
  }
  const count = project.node_ids.length;
  return {
    x: 60 + (count % 4) * 250,
    y: 60 + Math.floor(count / 4) * 320,
  };
}

async function createGenerationSession({
  message,
  project_id,
  media_type = 'image',
  aspect = 'origin',
  style = '',
  parent_node_id = null,
}) {
  const project = requireProject(project_id);
  const timestamp = nowIso();
  const position = defaultNodePosition(project, parent_node_id);
  const sceneId = project.node_ids.length + 1;

  const node = createNode({
    project_id,
    parent_node_id,
    scene_id: sceneId,
    media_type,
    x: position.x,
    y: position.y,
    prompt: message,
    status: AI_API_BASE ? 'generating' : 'error',
    aspect,
    style,
  });

  const session = {
    id: uuidv4(),
    project_id,
    node_id: node.id,
    parent_node_id,
    message,
    media_type,
    aspect,
    style,
    status: AI_API_BASE ? 'generating' : 'error',
    task_id: '',
    upstream_status: AI_API_BASE ? 'pending' : 'error',
    result_urls: [],
    error: AI_API_BASE ? null : 'AI_API_BASE 未配置',
    last_polled_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  if (parent_node_id) {
    createEdge({
      project_id,
      source_node_id: parent_node_id,
      target_node_id: node.id,
      edge_type: media_type === 'video' ? 'image_to_video' : 'story_branch',
    });
  }

  const currentProject = requireProject(project_id);
  writeRecord(SESSIONS_DIR, session.id, session);
  addUnique(currentProject.session_ids, session.id);
  saveProject(currentProject);

  if (!AI_API_BASE) {
    await failSession(session, 'AI_API_BASE 未配置');
    return { session: readRecord(SESSIONS_DIR, session.id), node: readRecord(NODES_DIR, node.id) };
  }

  try {
    const payload = await invokeAi(AI_GENERATE_PATH, buildGeneratePayload(session));
    const taskId = extractTaskId(payload);
    const immediateStatus = normalizeStatus(payload?.status || payload?.state);

    if (extractUrls(payload).length > 0 || extractBase64Result(payload).length > 0 || immediateStatus === 'completed') {
      const completed = await storeSessionResult(
        {
          ...session,
          task_id: taskId,
          upstream_status: 'completed',
        },
        node,
        payload,
      );
      return completed;
    }

    if (!taskId) {
      await failSession(session, '上游接口未返回 taskId 或结果 URL');
      return { session: readRecord(SESSIONS_DIR, session.id), node: readRecord(NODES_DIR, node.id) };
    }

    const runningSession = {
      ...session,
      task_id: taskId,
      upstream_status: immediateStatus || 'generating',
      updated_at: nowIso(),
    };
    writeRecord(SESSIONS_DIR, session.id, runningSession);
    updateNodeRecord(node.id, {
      status: 'generating',
      task_id: taskId,
    });
    sessionRefreshBackoffAttempts.set(session.id, 0);
    scheduleSessionRefresh(session.id, nextSessionRefreshDelay(runningSession));
    return { session: runningSession, node: readRecord(NODES_DIR, node.id) };
  } catch (error) {
    await failSession(session, error.message);
    return { session: readRecord(SESSIONS_DIR, session.id), node: readRecord(NODES_DIR, node.id) };
  }
}

async function refreshSessionInternal(sessionId, { force = false } = {}) {
  const session = readRecord(SESSIONS_DIR, sessionId);
  if (!session) {
    return null;
  }
  if (session.status !== 'generating' || !session.task_id || !AI_API_BASE) {
    clearScheduledSessionRefresh(sessionId);
    sessionRefreshBackoffAttempts.delete(sessionId);
    return session;
  }

  const lastPolledAt = session.last_polled_at ? new Date(session.last_polled_at).getTime() : 0;
  if (!force && Date.now() - lastPolledAt < SESSION_REFRESH_MIN_INTERVAL_MS) {
    scheduleSessionRefresh(session.id, SESSION_REFRESH_MIN_INTERVAL_MS - (Date.now() - lastPolledAt));
    return session;
  }

  const claimedSession = {
    ...session,
    last_polled_at: nowIso(),
    updated_at: nowIso(),
  };
  writeRecord(SESSIONS_DIR, session.id, claimedSession);

  try {
    const payload = await withSessionRefreshSlot(() =>
      invokeAi(buildTaskPath(claimedSession.task_id), null, 'GET'),
    );
    const status = normalizeStatus(payload?.status || payload?.state || payload?.progress);
    const node = readRecord(NODES_DIR, claimedSession.node_id);

    if (!node) {
      return await failSession(claimedSession, '关联节点不存在');
    }

    if (status === 'completed' || extractUrls(payload).length > 0 || extractBase64Result(payload).length > 0) {
      const completed = await storeSessionResult(
        {
          ...claimedSession,
          task_id: claimedSession.task_id,
          upstream_status: status || 'completed',
        },
        node,
        payload,
      );
      clearScheduledSessionRefresh(session.id);
      sessionRefreshBackoffAttempts.delete(session.id);
      return completed.session;
    }

    if (status === 'error') {
      return await failSession(claimedSession, payload?.error || payload?.message || '生成失败');
    }

    const next = {
      ...claimedSession,
      upstream_status: status || 'generating',
      updated_at: nowIso(),
    };
    writeRecord(SESSIONS_DIR, session.id, next);
    updateNodeRecord(node.id, {
      status: 'generating',
    });
    sessionRefreshBackoffAttempts.set(session.id, (sessionRefreshBackoffAttempts.get(session.id) || 0) + 1);
    scheduleSessionRefresh(session.id, nextSessionRefreshDelay(next));
    return next;
  } catch (error) {
    return await failSession(claimedSession, error.message);
  }
}

async function refreshSession(sessionId, { force = false } = {}) {
  if (inFlightSessionRefreshes.has(sessionId)) {
    return inFlightSessionRefreshes.get(sessionId);
  }
  const pending = refreshSessionInternal(sessionId, { force })
    .finally(() => {
      inFlightSessionRefreshes.delete(sessionId);
    });
  inFlightSessionRefreshes.set(sessionId, pending);
  return pending;
}

recoverInterruptedExportJobs();
recoverGeneratingSessions();

function projectSummaries() {
  return listRecords(PROJECTS_DIR)
    .map((project) => serializeProject(project))
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))
    .map((project) => ({
      id: project.id,
      name: project.name,
      script_text: project.script_text,
      nodeCount: project.nodeCount,
      edgeCount: project.edgeCount,
      fileCount: project.fileCount,
      sessionCount: project.sessionCount,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      canvasUrl: project.canvasUrl,
      sessions: project.sessions.map((session) => ({
        id: session.id,
        status: session.status,
        media_type: session.media_type,
        mediaType: session.mediaType,
      })),
    }));
}

function getMediaFilePath(file) {
  if (!file?.stored_filename) {
    return null;
  }
  const filePath = join(BLOB_DIR, file.stored_filename);
  return existsSync(filePath) ? filePath : null;
}

async function ffprobeDuration(filePath) {
  if (!filePath) {
    return 3;
  }
  const probe = await runCommand(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { timeoutMs: 30_000 },
  ).catch(() => null);
  if (!probe || probe.status !== 0) {
    return 3;
  }
  try {
    const payload = JSON.parse(probe.stdout || '{}');
    const videoStream = (payload.streams || []).find((stream) => stream.codec_type === 'video');
    const duration = Number(videoStream?.duration || payload?.format?.duration || 0);
    return duration > 0 ? duration : 3;
  } catch {
    return 3;
  }
}

function formatSrtTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function orderedNodes(project) {
  return [...project.nodes].sort((left, right) => {
    const leftScene = Number(left.scene_id ?? left.sceneId ?? 0);
    const rightScene = Number(right.scene_id ?? right.sceneId ?? 0);
    if (leftScene !== rightScene) {
      return leftScene - rightScene;
    }
    return new Date(left.createdAt) - new Date(right.createdAt);
  });
}

async function exportSubtitle(project) {
  const sortedNodes = orderedNodes(project);
  const videoNodes = sortedNodes.filter((node) => node.media_type === 'video' && node.file?.stored_filename);
  const nodes = videoNodes.length > 0 ? videoNodes : sortedNodes;
  if (nodes.length === 0) {
    const error = new Error('项目没有节点');
    error.statusCode = 400;
    throw error;
  }

  let currentTime = 0;
  const rows = [];
  for (const node of nodes) {
    const duration =
      node.media_type === 'video' && node.file?.stored_filename
        ? await ffprobeDuration(getMediaFilePath(node.file))
        : 3;
    const row = {
      node,
      start: currentTime,
      end: currentTime + duration,
      duration,
    };
    currentTime += duration;
    rows.push(row);
  }

  const exportStem = buildExportStem(project, 'subtitle');
  const srtPath = join(EXPORT_ROOT, `${exportStem}.srt`);
  const scriptPath = join(EXPORT_ROOT, `${exportStem}_script.md`);

  const srt = rows
    .map((row, index) => {
      const prompt = row.node.prompt || `Scene ${index + 1}`;
      return `${index + 1}\n${formatSrtTime(row.start)} --> ${formatSrtTime(row.end)}\n${prompt}\n`;
    })
    .join('\n');
  writeFileSync(srtPath, srt, 'utf8');

  const markdown = [
    `# ${project.name}`,
    '',
    `总时长: ${formatSrtTime(currentTime)}`,
    '',
    ...rows.map((row, index) => `## 镜头 ${index + 1}\n\n- 类型: ${row.node.media_type}\n- 时长: ${row.duration.toFixed(2)}s\n- 提示词: ${row.node.prompt || '(空)'}`),
    '',
  ].join('\n');
  writeFileSync(scriptPath, markdown, 'utf8');

  return {
    srt: srtPath,
    script: scriptPath,
    srt_url: `/media/exports/${basename(srtPath)}`,
    script_url: `/media/exports/${basename(scriptPath)}`,
    total_duration: Number(currentTime.toFixed(2)),
    scenes: rows.length,
  };
}

async function exportVideo(project, aspect, { outputToken = '' } = {}) {
  const preset = EXPORT_ASPECTS.get(aspect);
  if (!preset && aspect !== 'origin') {
    const error = new Error('invalid aspect');
    error.statusCode = 422;
    throw error;
  }

  const nodes = orderedNodes(project).filter((node) => node.media_type === 'video' && node.file?.stored_filename);
  if (nodes.length === 0) {
    const error = new Error('项目中没有视频节点');
    error.statusCode = 400;
    throw error;
  }

  const tempRoot = join(tmpdir(), `trix-canvas-${uuidv4()}`);
  mkdirSync(tempRoot, { recursive: true });
  const concatPath = join(tempRoot, 'concat.txt');
  const safeAspect = String(aspect || 'origin').replace(/[^a-zA-Z0-9_-]/g, '_');
  const exportStem = buildExportStem(project, `${safeAspect}${outputToken ? `_${outputToken}` : ''}`);
  const outPath = join(
    EXPORT_ROOT,
    `${exportStem}.mp4`,
  );

  return withExportSlot(async () => {
    try {
      const segmentPaths = [];
      for (const [index, node] of nodes.entries()) {
        const sourcePath = getMediaFilePath(node.file);
        if (!sourcePath) {
          continue;
        }
        const duration = await ffprobeDuration(sourcePath);
        const segmentPath = join(tempRoot, `segment-${String(index).padStart(3, '0')}.mp4`);
        const args = ['-y', '-hide_banner', '-loglevel', 'warning', '-i', sourcePath];
        if (preset) {
          args.push(
            '-vf',
            `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black,fps=30`,
          );
        }
        args.push(
          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '23',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-t',
          String(duration),
          segmentPath,
        );
        const result = await runCommand('ffmpeg', args, { timeoutMs: 5 * 60_000 });
        if (result.status !== 0) {
          const error = new Error(`片段转码失败: ${result.stderr || result.stdout}`);
          error.statusCode = 500;
          throw error;
        }
        segmentPaths.push(segmentPath);
      }

      if (segmentPaths.length === 0) {
        const error = new Error('没有可导出的视频文件');
        error.statusCode = 400;
        throw error;
      }

      writeFileSync(concatPath, segmentPaths.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
      const result = await runCommand(
        'ffmpeg',
        ['-y', '-hide_banner', '-loglevel', 'warning', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c:v', 'copy', '-c:a', 'aac', outPath],
        { timeoutMs: 5 * 60_000 },
      );
      if (result.status !== 0) {
        const error = new Error(`视频拼接失败: ${result.stderr || result.stdout}`);
        error.statusCode = 500;
        throw error;
      }

      return {
        path: outPath,
        url: `/media/exports/${basename(outPath)}`,
        aspect,
        segments: segmentPaths.length,
        size: statSync(outPath).size,
      };
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
}

function buildVideoExportKey(projectId, aspect) {
  return `${projectId}:${aspect || 'origin'}`;
}

function createVideoExportJob(projectId, aspect) {
  const key = buildVideoExportKey(projectId, aspect);
  const existing = inFlightVideoExportJobs.get(key);
  if (existing) {
    return existing;
  }

  const job = createExportJob({
    project_id: projectId,
    job_type: 'video',
    aspect,
  });
  const promise = (async () => {
    saveExportJob({
      ...job,
      status: 'running',
    });
    try {
      const project = serializeProject(requireProject(projectId));
      const result = await exportVideo(project, aspect, {
        outputToken: job.id.slice(0, 8),
      });
      const completed = saveExportJob({
        ...(readExportJob(job.id) || job),
        status: 'completed',
        output_url: result.url,
        output_path: result.path,
        size: result.size,
        segments: result.segments,
        aspect: result.aspect,
        error: null,
      });
      return completed;
    } catch (error) {
      saveExportJob({
        ...(readExportJob(job.id) || job),
        status: 'error',
        error: error.message,
      });
      throw error;
    } finally {
      inFlightVideoExportJobs.delete(key);
    }
  })();

  const entry = {
    key,
    jobId: job.id,
    promise,
  };
  inFlightVideoExportJobs.set(key, entry);
  return entry;
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'trix-canvas',
    port: PORT,
    aiConfigured: Boolean(AI_API_BASE),
  });
});

app.get('/', (_req, res) => {
  const html = join(__dirname, 'public', 'canvas.html');
  res.type('html').send(readFileSync(html, 'utf8'));
});

app.get('/canvas', (_req, res) => {
  const html = join(__dirname, 'public', 'canvas.html');
  res.type('html').send(readFileSync(html, 'utf8'));
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: matchesCanvasAccessToken(getCanvasPresentedToken(req)),
    requiresAuth: CANVAS_REQUIRE_AUTH,
  });
});

app.post('/api/auth/login', (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!matchesCanvasAccessToken(token)) {
    return res.status(401).json({ error: '访问令牌无效' });
  }
  const secureCookie = /^https:/i.test(APP_ORIGIN);
  res.setHeader(
    'Set-Cookie',
    serializeCookie(CANVAS_AUTH_COOKIE, CANVAS_ACCESS_TOKEN, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: secureCookie,
      maxAge: 7 * 24 * 60 * 60,
    }),
  );
  return res.json({ success: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(CANVAS_AUTH_COOKIE, '', {
      httpOnly: true,
      sameSite: 'Strict',
      secure: /^https:/i.test(APP_ORIGIN),
      maxAge: 0,
    }),
  );
  return res.json({ success: true });
});

app.get('/api/projects', (_req, res) => {
  res.json({ data: projectSummaries() });
});

app.post('/api/projects', (req, res, next) => {
  try {
    const project = createProject({
      name: req.body?.name || 'Untitled project',
      script_text: req.body?.script_text || '',
    });
    res.status(201).json({
      id: project.id,
      name: project.name,
      script_text: project.script_text,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      canvasUrl: `${APP_ORIGIN}/canvas?projectId=${project.id}`,
    });
  } catch (error) {
    next(error);
  }
});

app.get(['/api/projects/:projectId', '/api/project/:projectId'], async (req, res, next) => {
  try {
    const project = requireProject(req.params.projectId);
    const shouldWaitForRefresh = readBooleanFlag(req.query.refreshSessions) || readBooleanFlag(req.query.refresh);
    await refreshProjectSessions(project.session_ids || [], {
      wait: shouldWaitForRefresh,
      force: shouldWaitForRefresh,
    });
    res.json({ data: serializeProject(requireProject(req.params.projectId)) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/projects/:projectId', (req, res, next) => {
  try {
    const project = requireProject(req.params.projectId);
    const nextProject = {
      ...project,
      name: req.body?.name || project.name,
      script_text: req.body?.script_text ?? project.script_text,
    };
    saveProject(nextProject);
    res.json({ data: serializeProject(nextProject) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/projects/:projectId', (req, res, next) => {
  try {
    if (!deleteProject(req.params.projectId)) {
      return res.status(404).json({ error: '项目不存在' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/projects/:projectId/files', (req, res, next) => {
  try {
    const project = serializeProject(requireProject(req.params.projectId));
    res.json({ data: project.files });
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:projectId/export/subtitle', async (req, res, next) => {
  try {
    const project = serializeProject(requireProject(req.params.projectId));
    res.json(await exportSubtitle(project));
  } catch (error) {
    next(error);
  }
});

app.get('/api/projects/:projectId/export/video', async (req, res, next) => {
  try {
    const aspect = req.query.aspect ? String(req.query.aspect) : 'origin';
    const entry = createVideoExportJob(req.params.projectId, aspect);
    if (readBooleanFlag(req.query.async) || prefersAsyncResponse(req)) {
      return res.status(202).json({ data: serializeExportJob(readExportJob(entry.jobId)) });
    }
    const job = await entry.promise;
    return res.json({
      path: job.output_path,
      url: job.output_url,
      aspect: job.aspect,
      segments: job.segments,
      size: job.size,
      exportJobId: job.id,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/projects/:projectId/export/video', (req, res, next) => {
  try {
    const aspect = req.body?.aspect ? String(req.body.aspect) : 'origin';
    const entry = createVideoExportJob(req.params.projectId, aspect);
    res.status(202).json({ data: serializeExportJob(readExportJob(entry.jobId)) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/export-jobs/:jobId', (req, res, next) => {
  try {
    const job = readExportJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: '导出任务不存在' });
    }
    return res.json({ data: serializeExportJob(job) });
  } catch (error) {
    return next(error);
  }
});

app.post(['/api/upload', '/api/file/upload'], async (req, res, next) => {
  try {
    const body = req.body || {};
    const projectId = String(body.project_id || body.projectId || '');
    if (!projectId) {
      return res.status(400).json({ error: 'project_id 不能为空' });
    }
    requireProject(projectId);
    const nodeId = body.node_id || body.nodeId || null;
    if (nodeId) {
      requireNode(String(nodeId), { projectId });
    }

    let bytes = null;
    if (typeof body.fileData === 'string' || typeof body.file_data === 'string') {
      bytes = decodeBase64Payload(body.fileData ?? body.file_data);
    } else if (typeof body.external_url === 'string' || typeof body.externalUrl === 'string') {
      const remoteUrl = body.external_url || body.externalUrl;
      const downloaded = await downloadRemoteAsset(remoteUrl);
      bytes = downloaded.bytes;
      body.mime_type = body.mime_type || body.mimeType || downloaded.mimeType;
      body.filename = body.filename || fileNameFromUrl(remoteUrl);
      body.source_url = downloaded.sourceUrl;
    }

    if (!bytes || bytes.length === 0) {
      return res.status(400).json({ error: '请传入 fileData(base64) 或 external_url' });
    }

    const validatedAsset = validateUploadedAsset({
      bytes,
      filename: body.filename || fileNameFromUrl(body.source_url || body.sourceUrl || 'upload'),
      mimeType: body.mime_type || body.mimeType || inferMimeType(body.filename || ''),
      mediaType: body.media_type || body.mediaType || guessMediaType(body.mime_type || body.mimeType || '', body.filename || ''),
    });

    const file = storeFileBuffer({
      bytes,
      filename: validatedAsset.filename,
      mime_type: validatedAsset.mimeType,
      media_type: validatedAsset.mediaType,
      project_id: projectId,
      node_id: nodeId,
      prompt: body.prompt || '',
      scene_id: body.scene_id ?? body.sceneId ?? null,
      source_url: body.source_url || body.sourceUrl || null,
    });

    if (nodeId) {
      updateNodeRecord(String(nodeId), { file_id: file.id, result_url: file.url });
    }

    res.json(serializeFile(file));
  } catch (error) {
    next(error);
  }
});

app.post('/api/nodes', (req, res, next) => {
  try {
    const projectId = String(req.body?.project_id || req.body?.projectId || '');
    requireProject(projectId);
    const parentNodeId = req.body?.parent_node_id || req.body?.parentNodeId || null;
    const fileId = req.body?.file_id || req.body?.fileId || null;
    const sessionId = req.body?.session_id || req.body?.sessionId || null;
    if (parentNodeId) {
      requireNode(String(parentNodeId), { projectId });
    }
    if (fileId) {
      requireFile(String(fileId), { projectId });
    }
    if (sessionId) {
      requireSession(String(sessionId), { projectId });
    }
    const node = createNode({
      project_id: projectId,
      session_id: sessionId,
      file_id: fileId,
      parent_node_id: parentNodeId,
      scene_id: req.body?.scene_id ?? req.body?.sceneId ?? null,
      media_type: req.body?.media_type || req.body?.mediaType || 'image',
      x: req.body?.x ?? 60,
      y: req.body?.y ?? 60,
      prompt: req.body?.prompt || '',
      status: req.body?.status || 'pending',
      aspect: req.body?.aspect || 'origin',
      style: req.body?.style || '',
      task_id: req.body?.task_id || req.body?.taskId || '',
      result_url: null,
      error: req.body?.error || null,
    });
    res.status(201).json(serializeNode(node));
  } catch (error) {
    next(error);
  }
});

app.get('/api/nodes/:nodeId', (req, res, next) => {
  try {
    const node = readRecord(NODES_DIR, req.params.nodeId);
    if (!node) {
      return res.status(404).json({ error: '节点不存在' });
    }
    const file = node.file_id ? readRecord(FILES_DIR, node.file_id) : null;
    const fileMap = new Map();
    if (file) {
      fileMap.set(file.id, file);
    }
    return res.json(serializeNode(node, fileMap));
  } catch (error) {
    return next(error);
  }
});

app.patch('/api/nodes/:nodeId', (req, res, next) => {
  try {
    const currentNode = requireNode(req.params.nodeId);
    const projectId = currentNode.project_id;
    const patch = {};
    const body = req.body || {};
    const normalizeLinkedId = (value) => {
      if (value === undefined) {
        return undefined;
      }
      if (value === null) {
        return null;
      }
      const next = String(value).trim();
      return next ? next : null;
    };
    const fileId = normalizeLinkedId(body.file_id ?? body.fileId);
    const parentNodeId = normalizeLinkedId(body.parent_node_id ?? body.parentNodeId);
    if (fileId !== undefined) {
      if (fileId) {
        requireFile(fileId, { projectId });
      }
      patch.file_id = fileId;
    }
    if (parentNodeId !== undefined) {
      if (parentNodeId) {
        requireNode(parentNodeId, { projectId });
      }
      patch.parent_node_id = parentNodeId;
    }
    [
      ['scene_id', body.scene_id ?? body.sceneId],
      ['media_type', body.media_type ?? body.mediaType],
      ['prompt', body.prompt],
      ['status', body.status],
      ['aspect', body.aspect],
      ['style', body.style],
      ['task_id', body.task_id ?? body.taskId],
      ['error', body.error],
    ].forEach(([key, value]) => {
      if (value !== undefined) {
        patch[key] = value;
      }
    });
    if (body.x !== undefined) {
      patch.x = clampNumber(body.x, 60);
    }
    if (body.y !== undefined) {
      patch.y = clampNumber(body.y, 60);
    }
    const node = updateNodeRecord(req.params.nodeId, patch);
    const file = node.file_id ? readRecord(FILES_DIR, node.file_id) : null;
    const fileMap = new Map();
    if (file) {
      fileMap.set(file.id, file);
    }
    res.json(serializeNode(node, fileMap));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/nodes/:nodeId', (req, res, next) => {
  try {
    if (!removeNode(req.params.nodeId)) {
      return res.status(404).json({ error: '节点不存在' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/edges', (req, res, next) => {
  try {
    const projectId = String(req.body?.project_id || req.body?.projectId || '');
    const sourceNodeId = String(req.body?.source_node_id || req.body?.sourceNodeId || '');
    const targetNodeId = String(req.body?.target_node_id || req.body?.targetNodeId || '');
    if (!projectId || !sourceNodeId || !targetNodeId) {
      return res.status(400).json({ error: 'project_id/source_node_id/target_node_id 必填' });
    }
    requireProject(projectId);
    requireNode(sourceNodeId, { projectId });
    requireNode(targetNodeId, { projectId });
    const edge = createEdge({
      project_id: projectId,
      source_node_id: sourceNodeId,
      target_node_id: targetNodeId,
      edge_type: req.body?.edge_type || req.body?.edgeType || 'scene_order',
    });
    res.status(201).json(serializeEdge(edge));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/edges/:edgeId', (req, res, next) => {
  try {
    if (!removeEdge(req.params.edgeId)) {
      return res.status(404).json({ error: '连线不存在' });
    }
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/session/change-project', (_req, res, next) => {
  try {
    const project = createProject({ name: '新项目' });
    res.json({
      data: {
        projectUuid: project.id,
        projectId: project.id,
        projectUrl: `${APP_ORIGIN}/canvas?projectId=${project.id}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/session', async (req, res, next) => {
  try {
    const body = req.body || {};
    const projectId = String(body.project_id || body.projectId || '');
    const message = String(body.message || body.prompt || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message 不能为空' });
    }

    const targetProject = projectId || createProject({ name: message.slice(0, 24) || 'New project' }).id;
    if (body.parent_node_id || body.parentNodeId) {
      requireNode(String(body.parent_node_id || body.parentNodeId), { projectId: targetProject });
    }
    const created = await createGenerationSession({
      message,
      project_id: targetProject,
      media_type: body.media_type || body.mediaType || 'image',
      aspect: body.aspect || 'origin',
      style: body.style || '',
      parent_node_id: body.parent_node_id || body.parentNodeId || null,
    });

    res.json({
      data: {
        projectUuid: targetProject,
        projectId: targetProject,
        projectUrl: `${APP_ORIGIN}/canvas?projectId=${targetProject}`,
        sessionId: created.session.id,
        nodeId: created.node.id,
        taskId: created.session.task_id || '',
        status: created.session.status,
        resultUrls: created.session.result_urls || [],
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/session/:sessionId', async (req, res, next) => {
  try {
    const session = await refreshSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'session 不存在' });
    }
    return res.json({ data: serializeSession(readRecord(SESSIONS_DIR, req.params.sessionId)) });
  } catch (error) {
    return next(error);
  }
});

app.get('/media/files/:filename', (req, res) => {
  const filename = basename(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(BLOB_DIR, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  return res.sendFile(filePath);
});

app.get('/media/exports/:filename', (req, res) => {
  const filename = basename(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(EXPORT_ROOT, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: '导出文件不存在' });
  }
  return res.sendFile(filePath);
});

app.use((error, _req, res, _next) => {
  const statusCode = error?.statusCode || 500;
  res.status(statusCode).json({
    error: error?.message || '服务异常',
    detail: error?.message || '服务异常',
  });
});

const server = createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`TRIX Canvas Service running at ${APP_ORIGIN}`);
  console.log(`  Canvas UI: ${APP_ORIGIN}/canvas`);
  console.log(`  Health:    ${APP_ORIGIN}/health`);
  console.log(`  Data dir:  ${DATA_ROOT}`);
  console.log(`  Export dir:${EXPORT_ROOT}`);
  console.log(`  Auth:      ${CANVAS_REQUIRE_AUTH ? 'enabled' : 'disabled'}`);
  if (CANVAS_REQUIRE_AUTH) {
    console.log(`  Auth token source: ${CANVAS_AUTH_TOKEN_INFO.source}`);
    if (CANVAS_AUTH_TOKEN_INFO.source !== 'env') {
      console.log(`  Auth token file:   ${CANVAS_AUTH_TOKEN_FILE}`);
    }
  }
  if (!isLoopbackHost(HOST) && !CANVAS_REQUIRE_AUTH) {
    console.warn(
      '⚠ Canvas is exposed on a non-loopback host without auth because '
      + 'CANVAS_ALLOW_INSECURE_PUBLIC=true. Put it behind your own gateway.',
    );
  }
  if (!AI_API_BASE) {
    console.warn('⚠ AI_API_BASE 未配置，生成接口会返回错误状态');
  }
});
