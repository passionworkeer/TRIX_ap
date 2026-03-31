#!/usr/bin/env node
/**
 * Compatibility launcher for agents/tools that expect a start_all.js entry
 * under the skill scripts directory.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(__dirname, '..');
const explicitServiceDir = (process.env.TRIX_CANVAS_SERVICE_DIR || '').trim();
const serviceDir = explicitServiceDir
  ? resolve(explicitServiceDir)
  : resolve(__dirname, '..', 'assets', 'canvas-service');
const entry = join(serviceDir, 'start-all.js');
const runtimeRoot = resolve(process.env.TRIX_CANVAS_RUNTIME_DIR || join(skillRoot, 'runtime'));

function defaultBaseUrl(host, port) {
  const rawHost = (host || '').trim() || '127.0.0.1';
  const publicHost = rawHost === '0.0.0.0' || rawHost === '::' ? '127.0.0.1' : rawHost;
  const formattedHost = publicHost.includes(':') && !publicHost.startsWith('[')
    ? `[${publicHost}]`
    : publicHost;
  return `http://${formattedHost}:${port}`;
}

function ensureRuntimeDirs(env) {
  const dataDir = resolve(env.CANVAS_DATA_DIR || join(runtimeRoot, 'data'));
  const exportDir = resolve(env.CANVAS_EXPORT_DIR || join(runtimeRoot, 'exports'));
  for (const name of ['projects', 'nodes', 'edges', 'files', 'sessions', 'blobs']) {
    mkdirSync(join(dataDir, name), { recursive: true });
  }
  mkdirSync(exportDir, { recursive: true });
  env.CANVAS_DATA_DIR = dataDir;
  env.CANVAS_EXPORT_DIR = exportDir;
}

function ensureNodeRuntime() {
  if (existsSync(join(serviceDir, 'node_modules', 'express'))) {
    return;
  }
  const result = spawnSync('npm', ['install', '--no-fund', '--no-audit'], {
    cwd: serviceDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(entry)) {
  console.error(`TRIX Canvas runtime not found: ${entry}`);
  process.exit(1);
}

ensureNodeRuntime();

const childEnv = { ...process.env };
childEnv.CANVAS_HOST = (childEnv.CANVAS_HOST || '127.0.0.1').trim() || '127.0.0.1';
childEnv.PROXY_HOST = (childEnv.PROXY_HOST || '127.0.0.1').trim() || '127.0.0.1';
childEnv.CANVAS_PORT = (childEnv.CANVAS_PORT || '8789').trim() || '8789';
childEnv.CANVAS_BASE_URL = (
  childEnv.CANVAS_BASE_URL
  || defaultBaseUrl(childEnv.CANVAS_HOST, childEnv.CANVAS_PORT)
).trim();
ensureRuntimeDirs(childEnv);

const child = spawn('node', [entry, ...process.argv.slice(2)], {
  cwd: serviceDir,
  env: childEnv,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
