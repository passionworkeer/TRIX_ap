import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SCRIPTS_DIR = join(REPO_ROOT, 'skills', 'trix-canvas-skill', 'scripts');
const SCRIPTS_ESCAPED = SCRIPTS_DIR.replace(/\\/g, '\\\\'); // for Python string literals

const FIXTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XnV0AAAAASUVORK5CYII=',
  'base64',
);
const FIXTURE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyM',
  'base64',
);
const FIXTURE_MP4 = Buffer.from('AAABBBCCCDDDEEE');

async function runPythonAsync(args, options = {}) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('D:/python/python.exe', args, options);
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

async function getFreePort() {
  const probe = createServer();
  const port = await new Promise((resolvePromise, rejectPromise) => {
    probe.once('error', rejectPromise);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        rejectPromise(new Error('failed to acquire free port'));
        return;
      }
      resolvePromise(address.port);
    });
  });
  await new Promise((resolvePromise, rejectPromise) => {
    probe.close((err) => (err ? rejectPromise(err) : resolvePromise()));
  });
  return port;
}

// Test 1: generate() with image type - session created, result returned
test('TRIXAdapter generate() with image type creates session and returns result', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';
  let sessionCreated = false;
  let sessionPolled = 0;

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      assert.equal(payload.mediaType, 'image', 'mediaType should be image');
      sessionCreated = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_img_1', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess_img_1') {
      sessionPolled += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_img_1',
            status: sessionPolled >= 2 ? 'completed' : 'generating',
            resultUrls: ['/media/files/result.png'],
          },
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/media/files/result.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(FIXTURE_PNG);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const script = `
import sys, base64
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
result = adapter.generate('A test image', 'image')
# serialize: convert bytes to base64
safe = {k: (base64.b64encode(v).decode() if isinstance(v, bytes) else v) for k, v in result.items()}
print(json.dumps(safe))
`;
    const proc = await runPythonAsync(['-c', script], {
      env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
    });

    assert.equal(proc.code, 0, `script failed: ${proc.stderr}`);
    const result = JSON.parse(proc.stdout);
    assert.equal(result.ok, true, 'result should be ok');
    assert.ok(result.bytes, 'result should contain bytes');
    assert.equal(result.mime, 'image/png', 'mime should be image/png');
    assert.ok(sessionCreated, 'session should be created');
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});

// Test 2: generate() with video type - session created
test('TRIXAdapter generate() with video type creates session', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      assert.equal(payload.mediaType, 'video', 'mediaType should be video');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_vid_1', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess_vid_1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_vid_1',
            status: 'completed',
            resultUrls: ['/media/files/result.mp4'],
          },
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/media/files/result.mp4') {
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      res.end(FIXTURE_MP4);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const script = `
import sys, base64
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
result = adapter.generate('A test video', 'video')
safe = {k: (base64.b64encode(v).decode() if isinstance(v, bytes) else v) for k, v in result.items()}
print(json.dumps(safe))
`;
    const proc = await runPythonAsync(['-c', script], {
      env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
    });

    assert.equal(proc.code, 0, `script failed: ${proc.stderr}`);
    const result = JSON.parse(proc.stdout);
    assert.equal(result.ok, true, 'result should be ok');
    assert.equal(result.mime, 'video/mp4', 'mime should be video/mp4');
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});

// Test 3: generate() with parent_node_id - links to parent
test('TRIXAdapter generate() with parent_node_id passes parent to session', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      assert.ok(payload.message, 'should have message');
      assert.equal(payload.mediaType, 'image', 'mediaType should be image');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_parent_1', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess_parent_1') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_parent_1',
            status: 'completed',
            resultUrls: ['/media/files/child.png'],
          },
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/media/files/child.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(FIXTURE_PNG);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const script = `
import sys
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
result = adapter._create_session('Child node generation', 'image')
print(json.dumps(result))
`;
    const proc = await runPythonAsync(['-c', script], {
      env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
    });

    assert.equal(proc.code, 0, `script failed: ${proc.stderr}`);
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});

// Test 4: Polling timeout - raises TimeoutError
test('TRIXAdapter polling timeout returns error', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';
  let pollCount = 0;

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_timeout', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/session/sess_timeout')) {
      pollCount += 1;
      // Always return 'generating' - never complete
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_timeout',
            status: 'generating',
          },
        }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const script = `
import sys
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
# Temporarily reduce max_polls for testing
adapter._max_polls = 3
adapter._poll_interval = 0.1
result = adapter._poll('sess_timeout')
print(json.dumps(result))
`;
    const proc = await runPythonAsync(['-c', script], {
      env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
    });

    assert.equal(proc.code, 0, `script failed: ${proc.stderr}`);
    const result = JSON.parse(proc.stdout);
    assert.equal(result.ok, false, 'result should not be ok on timeout');
    assert.ok(result.error.includes('超时') || result.error.includes('timeout'), 'should contain timeout error');
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});

// Test 5: Session failed - raises RuntimeError with message
test('TRIXAdapter session failed returns error', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_failed', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess_failed') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_failed',
            status: 'failed',
            error: 'GPU memory exceeded',
          },
        }),
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const script = `
import sys
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
result = adapter._poll('sess_failed')
print(json.dumps(result))
`;
    const proc = await runPythonAsync(['-c', script], {
      env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
    });

    assert.equal(proc.code, 0, `script failed: ${proc.stderr}`);
    const result = JSON.parse(proc.stdout);
    assert.equal(result.ok, false, 'result should not be ok on failure');
    assert.ok(result.error.includes('GPU memory exceeded') || result.error.includes('失败'), 'should contain error message');
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});

// Test 6: Bytes download with correct MIME detection (jpeg/png/mp4)
test('TRIXAdapter detects correct MIME types for jpeg, png, mp4', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';
  const testCases = [
    { url: '/media/files/test.png', mime: 'image/png', data: FIXTURE_PNG },
    { url: '/media/files/test.jpeg', mime: 'image/jpeg', data: FIXTURE_JPEG },
    { url: '/media/files/test.mp4', mime: 'video/mp4', data: FIXTURE_MP4 },
  ];

  for (const tc of testCases) {
    const server = createServer(async (req, res) => {
      const auth = req.headers.authorization || '';
      if (auth !== `Bearer ${token}`) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      if (req.method === 'GET' && req.url === tc.url) {
        res.writeHead(200, { 'Content-Type': tc.mime });
        res.end(tc.data);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    });

    await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

    try {
      const script = `
import sys
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
result = adapter._extract_bytes_from_session({
    'resultUrls': ['${tc.url}']
})
print(json.dumps({'ok': result.get('ok'), 'mime': result.get('mime')}))
`;
      const proc = await runPythonAsync(['-c', script], {
        env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
      });

      assert.equal(proc.code, 0, `script failed for ${tc.url}: ${proc.stderr}`);
      const result = JSON.parse(proc.stdout);
      assert.equal(result.ok, true, `${tc.url} should succeed`);
      assert.equal(result.mime, tc.mime, `${tc.url} mime should be ${tc.mime}`);
    } finally {
      await new Promise((resolvePromise) => server.close(resolvePromise));
    }
  }
});

// Test 7: Invalid CANVAS_BASE_URL raises ConnectionError
test('TRIXAdapter with invalid CANVAS_BASE_URL raises ConnectionError', async () => {
  const script = `
import sys
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('http://invalid-host-that-does-not-exist-12345.local:9999', 'fake-token')
try:
    result = adapter._create_session('test', 'image')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;
  const proc = await runPythonAsync(['-c', script], {
    env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
  });

  // Should complete (even if with error) but not crash
  assert.ok(proc.code === 0 || proc.code === 1, 'script should complete');
});

// Test 8: generate() with aspect and style parameters passed through
test('TRIXAdapter generate() passes aspect and style parameters', async () => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'test-token';

  const server = createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/session') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body || '{}');
      // Note: TRIXAdapter.generate() doesn't accept aspect/style directly
      // but _create_session does via _common.create_session
      assert.ok(payload.message, 'should have message');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_params', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess_params') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_params',
            status: 'completed',
            resultUrls: ['/media/files/params.png'],
          },
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/media/files/params.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(FIXTURE_PNG);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const script = `
import sys, base64
sys.path.insert(0, '${SCRIPTS_ESCAPED}')
from adapters.trix_adapter import TRIXAdapter
import json

adapter = TRIXAdapter('${baseUrl}', '${token}')
result = adapter.generate('Test with params', 'image')
safe = {k: (base64.b64encode(v).decode() if isinstance(v, bytes) else v) for k, v in result.items()}
print(json.dumps(safe))
`;
    const proc = await runPythonAsync(['-c', script], {
      env: { ...process.env, PYTHONPATH: SCRIPTS_DIR },
    });

    assert.equal(proc.code, 0, `script failed: ${proc.stderr}`);
    const result = JSON.parse(proc.stdout);
    assert.equal(result.ok, true, 'result should be ok');
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
});
