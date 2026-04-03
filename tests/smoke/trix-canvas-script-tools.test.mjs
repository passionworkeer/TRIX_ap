import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SCRIPTS_DIR = resolve(REPO_ROOT, 'skills/trix-canvas-skill/scripts');
const GENERATE_SCRIPT = resolve(SCRIPTS_DIR, 'generate.py');
const PARSE_SCRIPT = resolve(SCRIPTS_DIR, 'parse_script.py');
const FIXTURE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEhAQEBIQEA8PEA8QDw8PEA8PDw8QFREWFhURFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGi0fHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6A//xAAZEAEBAQEBAQAAAAAAAAAAAAABEQIhMWH/2gAIAQEAAT8Aowx0dD3/xAAVEQEBAAAAAAAAAAAAAAAAAAABEP/aAAgBAgEBPwCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwCf/9k=',
  'base64',
);

function runPython(args, options = {}) {
  return spawnSync('D:/python/python.exe', args, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...options.env },
    ...options,
  });
}

function runPythonAsync(args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('D:/python/python.exe', args, {
      cwd: REPO_ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      ...options,
    });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectPromise);
    child.on('close', (code, signal) => {
      resolvePromise({ code, signal, stdout, stderr });
    });
  });
}

test('parse_script preserves scene media types from JSON payloads', () => {
  const payload = JSON.stringify([
    { text: '镜头一：雨夜街口', media_type: 'image' },
    { prompt: '镜头二：人物冲入店内', mediaType: 'video' },
  ]);
  const result = runPython([PARSE_SCRIPT, payload]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const scenes = JSON.parse(result.stdout);
  assert.deepEqual(
    scenes.map((scene) => ({ index: scene.index, media_type: scene.media_type })),
    [
      { index: 1, media_type: 'image' },
      { index: 2, media_type: 'video' },
    ],
  );
});

test('parse_script reads image:: and video:: markers from plain text blocks', () => {
  const payload = [
    'image:: 镜头一：雨夜街口',
    'video:: 镜头二：镜头推进到女孩侧脸',
    '镜头三：没有前缀时默认图片',
  ].join('\n');
  const result = runPython([PARSE_SCRIPT, payload]);
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const scenes = JSON.parse(result.stdout);
  assert.deepEqual(
    scenes.map((scene) => ({ index: scene.index, media_type: scene.media_type, text: scene.text })),
    [
      { index: 1, media_type: 'image', text: '镜头一：雨夜街口' },
      { index: 2, media_type: 'video', text: '镜头二：镜头推进到女孩侧脸' },
      { index: 3, media_type: 'image', text: '镜头三：没有前缀时默认图片' },
    ],
  );
});

test('generate.py chooses a default file extension that matches the returned mime', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'trix-canvas-generate-'));
  const token = 'generate-default-ext-token';
  let polls = 0;

  const server = createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      for await (const _chunk of req) {
        // Drain request body so the Python client never stalls on a half-open socket.
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess-jpeg', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess-jpeg') {
      polls += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: {
          sessionId: 'sess-jpeg',
          status: polls >= 2 ? 'completed' : 'generating',
          resultUrls: ['/media/files/result.jpeg'],
        },
      }));
      return;
    }

    if (req.method === 'GET' && req.url === '/media/files/result.jpeg') {
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(FIXTURE_JPEG);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  const port = await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        rejectPromise(new Error('failed to bind test server'));
        return;
      }
      resolvePromise(address.port);
    });
  });

  try {
    const result = await runPythonAsync(
      [GENERATE_SCRIPT, '雨夜便利店门口的重逢', '--type', 'image'],
      {
        cwd: tempRoot,
        env: {
          ...process.env,
          CANVAS_BASE_URL: `http://127.0.0.1:${port}`,
          CANVAS_ACCESS_TOKEN: token,
        },
      },
    );
    assert.equal(result.code, 0, result.stderr || result.stdout);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true, payload.error || 'generate should succeed');
    assert.match(payload.path, /output_image\.jpeg$/);
    assert.equal(existsSync(join(tempRoot, payload.path)), true);
    assert.ok(readFileSync(join(tempRoot, payload.path)).length > 0);
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('_wait_jobs marks queue-time failures instead of silently skipping them', () => {
  const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(SCRIPTS_DIR)})
import workflow

workflow._poll_job = lambda job, timeout=300: {**job, "result": {"status": "completed"}}
completed, failed = workflow._wait_jobs([
    {"scene_index": 1, "scene_text": "ok", "media_type": "image", "session_id": "sess-1", "node_id": "node-1"},
    {"scene_index": 2, "scene_text": "bad", "media_type": "image", "session_id": "", "node_id": "", "error": "sessionId missing from response"},
], concurrent=2)
print(json.dumps({
    "completed": len(completed),
    "failed": len(failed),
    "error": failed[0]["result"]["error"],
}, ensure_ascii=False))
`;

  const result = runPython(['-c', script]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const lines = result.stdout.trim().split('\n');
  const payload = JSON.parse(lines[lines.length - 1]);
  assert.equal(payload.completed, 1);
  assert.equal(payload.failed, 1);
  assert.match(payload.error, /sessionId missing/i);
});
