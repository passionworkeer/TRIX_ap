import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const CANVAS_SERVER_ENTRY = fileURLToPath(
  new URL('../../packages/trix-canvas-service/server.js', import.meta.url),
);
const FIXTURE_VIDEO_PATH = fileURLToPath(
  new URL('../../public/videos/role1/idle.mp4', import.meta.url),
);

export const FIXTURE_IMAGE_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XnV0AAAAASUVORK5CYII=',
  'base64',
);

export async function getFreePort(host = HOST) {
  const server = createNetServer();
  return new Promise((resolve, reject) => {
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

export async function waitForOk(baseUrl, endpoint = '/health', attempts = 300, delayMs = 100) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`);
      if (response.ok) {
        return response;
      }
    } catch {
      // Retry until the timeout budget is exhausted.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
  }
  throw new Error(`Failed to reach ${baseUrl}${endpoint}`);
}

async function createMockAiServer(mockAiPort, mockAiUrl) {
  const tasks = new Map();
  const videoBytes = readFileSync(FIXTURE_VIDEO_PATH);

  const server = createHttpServer(async (req, res) => {
    const url = new URL(req.url, mockAiUrl);

    if (req.method === 'POST' && url.pathname === '/generate') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const payload = body ? JSON.parse(body) : {};
      const mediaType = payload.media_type || payload.mediaType || 'image';
      const prompt = String(payload.prompt || payload.message || '');
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const mode = prompt.toLowerCase().includes('bad-url') ? 'bad-url' : 'normal';
      tasks.set(taskId, { polls: 0, mediaType, mode });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ task_id: taskId, status: 'pending' }));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/tasks/')) {
      const taskId = url.pathname.split('/').pop();
      const task = tasks.get(taskId);
      if (!task) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
        return;
      }

      task.polls += 1;
      if (task.polls < 2) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ task_id: taskId, status: 'processing' }));
        return;
      }

      const assetPath = task.mode === 'bad-url'
        ? 'http://127.0.0.1:1/missing.png'
        : `${mockAiUrl}${task.mediaType === 'video' ? '/mock.mp4' : '/mock.png'}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          task_id: taskId,
          status: 'completed',
          urls: [assetPath],
        }),
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/mock.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(FIXTURE_IMAGE_BUFFER);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/mock.mp4') {
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      res.end(videoBytes);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolvePromise) => server.listen(mockAiPort, HOST, resolvePromise));
  return server;
}

function startCanvasServer(
  canvasPort,
  canvasUrl,
  mockAiUrl,
  {
    workdirPrefix = 'trix-canvas-test-',
    allowPrivateRemoteUrls = true,
  } = {},
) {
  const workdir = mkdtempSync(join(tmpdir(), workdirPrefix));
  const dataDir = join(workdir, 'data');
  const exportDir = join(workdir, 'exports');
  const env = {
    ...process.env,
    CANVAS_HOST: HOST,
    CANVAS_PORT: String(canvasPort),
    CANVAS_BASE_URL: canvasUrl,
    CANVAS_DATA_DIR: dataDir,
    CANVAS_EXPORT_DIR: exportDir,
    AI_API_BASE: mockAiUrl,
    AI_GENERATE_PATH: '/generate',
    AI_TASK_PATH_TEMPLATE: '/tasks/:taskId',
    CANVAS_ALLOW_PRIVATE_REMOTE_URLS: allowPrivateRemoteUrls ? 'true' : 'false',
  };
  const proc = spawn('node', [CANVAS_SERVER_ENTRY], {
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return { proc, workdir };
}

async function stopProcess(proc) {
  if (!proc || proc.killed) {
    return;
  }
  proc.kill('SIGINT');
  await new Promise((resolvePromise) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolvePromise();
      }
    };
    proc.once('exit', finish);
    setTimeout(finish, 1500);
  });
}

async function stopServer(server) {
  if (!server?.listening) {
    return;
  }
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

export async function createCanvasTestEnvironment(options = {}) {
  const canvasPort = options.canvasPort || await getFreePort(HOST);
  const mockAiPort = options.mockAiPort || await getFreePort(HOST);
  const canvasUrl = `http://${HOST}:${canvasPort}`;
  const mockAiUrl = `http://${HOST}:${mockAiPort}`;

  let mockAiServer;
  let canvasRuntime;
  try {
    mockAiServer = await createMockAiServer(mockAiPort, mockAiUrl);
    canvasRuntime = startCanvasServer(
      canvasPort,
      canvasUrl,
      mockAiUrl,
      {
        workdirPrefix: options.workdirPrefix || 'trix-canvas-test-',
        allowPrivateRemoteUrls: options.allowPrivateRemoteUrls ?? true,
      },
    );
    await waitForOk(canvasUrl, '/health');
  } catch (error) {
    if (canvasRuntime?.proc) {
      await stopProcess(canvasRuntime.proc);
    }
    if (canvasRuntime?.workdir) {
      rmSync(canvasRuntime.workdir, { recursive: true, force: true });
    }
    if (mockAiServer) {
      await stopServer(mockAiServer);
    }
    throw error;
  }

  return {
    host: HOST,
    canvasPort,
    canvasUrl,
    mockAiPort,
    mockAiUrl,
    workdir: canvasRuntime.workdir,
    process: canvasRuntime.proc,
    mockAiServer,
    async shutdown() {
      await stopProcess(canvasRuntime.proc);
      await stopServer(mockAiServer);
      rmSync(canvasRuntime.workdir, { recursive: true, force: true });
    },
  };
}
