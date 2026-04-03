import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SYNC_SCRIPT = resolve(
  REPO_ROOT,
  'skills/trix-canvas-skill/scripts/sync_canvas_runtime.py',
);

test('packaged canvas runtime stays in sync with repo runtime', () => {
  const result = spawnSync('D:/python/python.exe', [SYNC_SCRIPT, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout.trim());
  assert.equal(payload.ok, true, result.stdout);
});
