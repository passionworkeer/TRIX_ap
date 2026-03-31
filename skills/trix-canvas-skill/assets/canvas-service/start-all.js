#!/usr/bin/env node
/**
 * Combined startup script: starts AI proxy + canvas service together.
 * Prefers env vars, falls back to ~/.openclaw/openclaw.json for convenience.
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENCLAW_CONFIG = join(process.env.HOME || '', '.openclaw', 'openclaw.json');
const CANVAS_HOST = (process.env.CANVAS_HOST || '127.0.0.1').trim() || '127.0.0.1';
const PROXY_HOST = (process.env.PROXY_HOST || '127.0.0.1').trim() || '127.0.0.1';
const PASSTHROUGH_ENV_KEYS = new Set([
  'HOME',
  'PATH',
  'USER',
  'LOGNAME',
  'LANG',
  'SHELL',
  'TERM',
  'TMPDIR',
  'TMP',
  'TEMP',
  'PWD',
  'NODE_OPTIONS',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
]);
const PASSTHROUGH_ENV_PREFIXES = [
  'LC_',
  'CANVAS_',
  'AI_',
  'PROXY_',
  'TRIX_CANVAS_',
  'MINIMAX_',
  'OPENAI_',
  'ANTHROPIC_',
];

function isLoopbackHost(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}

function defaultBaseUrl(host, port) {
  const publicHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const formattedHost = publicHost.includes(':') && !publicHost.startsWith('[')
    ? `[${publicHost}]`
    : publicHost;
  return `http://${formattedHost}:${port}`;
}

function readOpenClawApiKey() {
  try {
    const cfg = JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf8'));
    return cfg?.env?.vars?.MINIMAX_API_KEY || '';
  } catch {
    return '';
  }
}

function shouldPassEnvKey(key) {
  return PASSTHROUGH_ENV_KEYS.has(key)
    || PASSTHROUGH_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function buildChildEnv(overrides = {}) {
  const env = {};
  Object.entries(process.env).forEach(([key, value]) => {
    if (value !== undefined && shouldPassEnvKey(key)) {
      env[key] = value;
    }
  });
  return {
    ...env,
    ...overrides,
  };
}

const PORT = Number(process.env.CANVAS_PORT || 8789);
const PXYPORT = Number(process.env.PROXY_PORT || 8790);
const allowOpenClawFallback = /^(1|true|yes)$/i.test(process.env.TRIX_CANVAS_ALLOW_OPENCLAW_CONFIG || '')
  || (isLoopbackHost(CANVAS_HOST) && isLoopbackHost(PROXY_HOST));
const proxyApiKey =
  process.env.AI_API_KEY
  || process.env.MINIMAX_API_KEY
  || process.env.PROXY_UPSTREAM_KEY
  || (allowOpenClawFallback ? readOpenClawApiKey() : '');
const proxyAccessToken = process.env.PROXY_ACCESS_TOKEN || '';

const proxyEnv = buildChildEnv({
  PROXY_PORT: String(PXYPORT),
  PROXY_HOST,
  AI_API_BASE:
    process.env.PROXY_UPSTREAM_BASE
    || process.env.AI_PROVIDER_BASE
    || process.env.AI_API_BASE
    || 'https://api.minimaxi.com',
  AI_API_KEY: proxyApiKey,
  AI_IMAGE_PATH: process.env.PROXY_IMAGE_PATH || process.env.AI_IMAGE_PATH || '/v1/image_generation',
  AI_IMAGE_MODEL: process.env.PROXY_IMAGE_MODEL || process.env.AI_IMAGE_MODEL || 'image-01',
  AI_GENERATE_PATH:
    process.env.PROXY_GENERATE_PATH
    || process.env.AI_GENERATE_PATH
    || '/anthropic/v1/messages',
  AI_MODEL: process.env.PROXY_MODEL || process.env.AI_MODEL || 'MiniMax-M2.7',
});

const serverEnv = buildChildEnv({
  CANVAS_PORT: String(PORT),
  CANVAS_HOST,
  CANVAS_BASE_URL: process.env.CANVAS_BASE_URL || defaultBaseUrl(CANVAS_HOST, PORT),
  AI_API_BASE: `http://127.0.0.1:${PXYPORT}`,
  AI_API_KEY: proxyAccessToken,
  AI_GENERATE_PATH: '/generate',
  AI_TASK_PATH_TEMPLATE: '/tasks/:taskId',
});

const children = [];

function spawnChild(label, file, env) {
  const child = spawn('node', [file], {
    cwd: __dirname,
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
    shutdown(label);
  });
  children.push(child);
  return child;
}

function shutdown(origin = 'signal') {
  while (children.length > 0) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill('SIGINT');
    }
  }
  if (origin !== 'signal') {
    process.exit(process.exitCode || 0);
  }
}

process.on('SIGINT', () => shutdown('signal'));
process.on('SIGTERM', () => shutdown('signal'));

if (!proxyApiKey) {
  console.warn(
    'Proxy upstream key is empty. Set AI_API_KEY/MINIMAX_API_KEY/PROXY_UPSTREAM_KEY, or allow ~/.openclaw/openclaw.json via TRIX_CANVAS_ALLOW_OPENCLAW_CONFIG=true.',
  );
}

console.log(`Starting proxy on ${PROXY_HOST}:${PXYPORT} and canvas on ${CANVAS_HOST}:${PORT}`);
spawnChild('proxy', 'proxy.js', proxyEnv);
setTimeout(() => {
  spawnChild('server', 'server.js', serverEnv);
}, 800);
