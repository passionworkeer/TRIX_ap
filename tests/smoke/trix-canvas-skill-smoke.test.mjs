import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const INSTALL_SCRIPT = fileURLToPath(
  new URL('../../skills/trix-canvas-skill/scripts/install_openclaw_skill.py', import.meta.url),
);
const PACKAGED_CANVAS_HTML = fileURLToPath(
  new URL('../../packages/trix-canvas-service/public/canvas.html', import.meta.url),
);
const PACKAGED_SERVER_JS = fileURLToPath(
  new URL('../../packages/trix-canvas-service/server.js', import.meta.url),
);
const FIXTURE_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XnV0AAAAASUVORK5CYII=',
  'base64',
);

function sha1(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex');
}

async function runPythonAsync(args, options = {}) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('python3', args, options);
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

test('Canvas skill install sync + generate flow', async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'trix-canvas-skill-smoke-'));
  const workspace = join(tempRoot, 'workspace');
  const outputPath = join(tempRoot, 'generated.png');

  const installProc = spawnSync(
    'python3',
    [INSTALL_SCRIPT, '--workspace', workspace],
    { encoding: 'utf-8' },
  );
  assert.equal(
    installProc.status,
    0,
    `install script failed: ${installProc.stderr || installProc.stdout}`,
  );
  const installPayload = JSON.parse(installProc.stdout);
  const installedRoot = installPayload.installed_to;
  assert.ok(installedRoot, 'install output should include installed_to');

  const installedCanvasSecurity = join(installedRoot, 'assets', 'canvas-service', 'canvasSecurity.js');
  const installedCanvasHtml = join(installedRoot, 'assets', 'canvas-service', 'public', 'canvas.html');
  const installedServerJs = join(installedRoot, 'assets', 'canvas-service', 'server.js');
  assert.ok(existsSync(installedCanvasSecurity), 'installed canvasSecurity.js should exist');
  assert.ok(existsSync(installedCanvasHtml), 'installed canvas.html should exist');
  assert.ok(existsSync(installedServerJs), 'installed server.js should exist');
  assert.equal(sha1(installedCanvasHtml), sha1(PACKAGED_CANVAS_HTML), 'installed canvas.html should match package runtime');
  assert.equal(sha1(installedServerJs), sha1(PACKAGED_SERVER_JS), 'installed server.js should match package runtime');

  const token = 'skill-smoke-token';
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let sessionPolls = 0;
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
      assert.ok(payload.message, 'session request should include message');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { sessionId: 'sess_1', status: 'generating' } }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/session/sess_1') {
      sessionPolls += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            sessionId: 'sess_1',
            status: sessionPolls >= 2 ? 'completed' : 'generating',
            resultUrls: ['/media/files/mock.png'],
          },
        }),
      );
      return;
    }

    if (req.method === 'GET' && req.url === '/media/files/mock.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(FIXTURE_IMAGE);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));

  try {
    const generateScript = join(installedRoot, 'scripts', 'generate.py');
    const genProc = await runPythonAsync(
      [generateScript, 'A short drama frame', '--type', 'image', '--output', outputPath],
      {
        env: {
          ...process.env,
          CANVAS_BASE_URL: baseUrl,
          CANVAS_ACCESS_TOKEN: token,
        },
      },
    );
    assert.equal(genProc.code, 0, `generate script failed: ${genProc.stderr || genProc.stdout}`);
    const generatePayload = JSON.parse(genProc.stdout);
    assert.equal(generatePayload.ok, true, 'generate payload should be ok');
    assert.ok(existsSync(outputPath), 'generated output file should exist');
    assert.ok(readFileSync(outputPath).length > 0, 'generated output file should contain bytes');
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise));
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
