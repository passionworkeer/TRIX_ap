#!/usr/bin/env node
/**
 * Compatibility launcher for agents/tools that expect a start_all.js entry
 * under the skill scripts directory.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const explicitServiceDir = (process.env.TRIX_CANVAS_SERVICE_DIR || '').trim();
const serviceDir = explicitServiceDir
  ? resolve(explicitServiceDir)
  : resolve(__dirname, '..', 'assets', 'canvas-service');
const entry = join(serviceDir, 'start-all.js');

if (!existsSync(entry)) {
  console.error(`TRIX Canvas runtime not found: ${entry}`);
  process.exit(1);
}

const child = spawn('node', [entry, ...process.argv.slice(2)], {
  cwd: serviceDir,
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
