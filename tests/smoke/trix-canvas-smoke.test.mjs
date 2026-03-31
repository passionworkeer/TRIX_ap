import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CANVAS_PORT = 8801;
const CANVAS_URL = `http://127.0.0.1:${CANVAS_PORT}`;
const MOCK_AI_PORT = 8802;
const MOCK_AI_URL = `http://127.0.0.1:${MOCK_AI_PORT}`;
const CANVAS_SERVER_ENTRY = fileURLToPath(new URL('../../packages/trix-canvas-service/server.js', import.meta.url));
const FIXTURE_VIDEO = fileURLToPath(new URL('../../public/videos/role1/idle.mp4', import.meta.url));
const FIXTURE_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XnV0AAAAASUVORK5CYII=',
  'base64',
);

function spawnCanvasServer() {
  const workdir = mkdtempSync(join(tmpdir(), 'trix-canvas-smoke-'));
  const dataDir = join(workdir, 'data');
  const exportDir = join(workdir, 'exports');
  const env = {
    ...process.env,
    CANVAS_PORT: String(CANVAS_PORT),
    CANVAS_BASE_URL: CANVAS_URL,
    CANVAS_DATA_DIR: dataDir,
    CANVAS_EXPORT_DIR: exportDir,
    AI_API_BASE: MOCK_AI_URL,
    AI_GENERATE_PATH: '/generate',
    AI_TASK_PATH_TEMPLATE: '/tasks/:taskId',
    CANVAS_ALLOW_PRIVATE_REMOTE_URLS: 'true',
  };
  const proc = spawn('node', [CANVAS_SERVER_ENTRY], {
    env,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  return { proc, workdir };
}

async function spawnMockAiServer() {
  const tasks = new Map();
  const videoBytes = readFileSync(FIXTURE_VIDEO);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, MOCK_AI_URL);

    if (req.method === 'POST' && url.pathname === '/generate') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const payload = body ? JSON.parse(body) : {};
      const mediaType = payload.media_type || payload.mediaType || 'image';
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      tasks.set(taskId, { polls: 0, mediaType });
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

      const assetPath = task.mediaType === 'video' ? '/mock.mp4' : '/mock.png';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          task_id: taskId,
          status: 'completed',
          urls: [`${MOCK_AI_URL}${assetPath}`],
        }),
      );
      return;
    }

    if (req.method === 'GET' && url.pathname === '/mock.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(FIXTURE_IMAGE);
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

  await new Promise((resolvePromise) => server.listen(MOCK_AI_PORT, '127.0.0.1', resolvePromise));
  return server;
}

async function waitFor(endpoint, attempts = 300) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${CANVAS_URL}${endpoint}`);
      if (response.ok) {
        return response;
      }
    } catch {
      // keep trying
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Failed to reach ${endpoint}`);
}

async function waitForSession(sessionId, expected = 'completed', attempts = 180) {
  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(`${CANVAS_URL}/api/session/${sessionId}`);
    assert.equal(response.status, 200, 'session polling should succeed');
    const payload = await response.json();
    const data = payload.data;
    if (data?.status === expected) {
      return data;
    }
    if (data?.status === 'error') {
      throw new Error(`session failed: ${data?.error || 'unknown error'}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`session ${sessionId} did not reach ${expected}`);
}

async function postJson(path, body) {
  const response = await fetch(`${CANVAS_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    payload: text ? JSON.parse(text) : {},
  };
}

test('Canvas service smoke flow', async (t) => {
  const mockAi = await spawnMockAiServer();
  const { proc, workdir } = spawnCanvasServer();

  let projectId = '';
  try {
    await t.test('wait for health', async () => {
      const response = await waitFor('/health');
      const body = await response.json();
      assert.equal(body?.status, 'ok', 'Health endpoint should return ok');
    });

    await t.test('create and fetch project', async () => {
      const { response, payload } = await postJson('/api/projects', {
        name: 'smoke canvas',
        script_text: 'scene-one',
      });
      assert.equal(response.status, 201, 'project creation should return 201');
      projectId = payload.id;
      assert.ok(projectId, 'project id must exist');
      assert.equal(payload.name, 'smoke canvas');

      const listReq = await fetch(`${CANVAS_URL}/api/projects`);
      const list = await listReq.json();
      assert.ok(Array.isArray(list.data), 'projects listing should return a data array');
      assert.ok(list.data.some((item) => item.id === projectId), 'new project should appear in list');

      const detailReq = await fetch(`${CANVAS_URL}/api/project/${projectId}`);
      const detail = await detailReq.json();
      assert.equal(detail?.data?.id, projectId, 'project detail must match');
    });

    await t.test('image session completes and stores media locally', async () => {
      const { response, payload } = await postJson('/api/session', {
        projectId,
        message: 'Hello smoke image',
        mediaType: 'image',
        aspect: '1:1',
      });
      assert.equal(response.status, 200, 'session creation should succeed');
      assert.equal(payload.data?.status, 'generating', 'session should start generating');
      assert.ok(payload.data?.sessionId, 'sessionId should be returned');
      assert.ok(payload.data?.nodeId, 'nodeId should be returned');

      const session = await waitForSession(payload.data.sessionId);
      assert.equal(session.status, 'completed', 'session should complete');
      assert.ok(Array.isArray(session.resultUrls), 'resultUrls should exist');
      assert.ok(session.resultUrls[0]?.startsWith('/media/files/'), 'result should be served locally');

      const mediaReq = await fetch(`${CANVAS_URL}${session.resultUrls[0]}`);
      assert.equal(mediaReq.status, 200, 'stored image should be downloadable');
      assert.match(mediaReq.headers.get('content-type') || '', /image\/png/, 'content type should be image/png');
    });

    await t.test('video session completes and export endpoints work', async () => {
      const { payload } = await postJson('/api/session', {
        projectId,
        message: 'Hello smoke video',
        mediaType: 'video',
        aspect: '16:9',
      });
      assert.equal(payload.data?.status, 'generating', 'video session should start generating');
      const videoSession = await waitForSession(payload.data.sessionId);
      assert.equal(videoSession.status, 'completed', 'video session should complete');
      assert.ok(videoSession.resultUrls[0]?.startsWith('/media/files/'), 'video result should be localized');

      const detailReq = await fetch(`${CANVAS_URL}/api/projects/${projectId}`);
      const detail = await detailReq.json();
      assert.ok(detail.data?.files?.length >= 2, 'project should contain generated files');
      assert.ok(detail.data?.nodes?.length >= 2, 'project should contain generated nodes');

      const subtitleReq = await fetch(`${CANVAS_URL}/api/projects/${projectId}/export/subtitle`);
      assert.equal(subtitleReq.status, 200, 'subtitle export should succeed');
      const subtitle = await subtitleReq.json();
      assert.ok(subtitle.srt_url?.startsWith('/media/exports/'), 'subtitle export should return a media URL');

      const videoExportReq = await fetch(`${CANVAS_URL}/api/projects/${projectId}/export/video?aspect=1:1`);
      assert.equal(videoExportReq.status, 200, 'video export should succeed');
      const videoExport = await videoExportReq.json();
      assert.ok(videoExport.url?.startsWith('/media/exports/'), 'video export should return a media URL');

      const exportedVideoReq = await fetch(`${CANVAS_URL}${videoExport.url}`);
      assert.equal(exportedVideoReq.status, 200, 'exported video should be downloadable');
      assert.match(exportedVideoReq.headers.get('content-type') || '', /video\/mp4/, 'exported video content type should be video/mp4');
    });
  } finally {
    if (projectId) {
      await fetch(`${CANVAS_URL}/api/projects/${projectId}`, { method: 'DELETE' });
    }
    proc.kill('SIGINT');
    await new Promise((resolvePromise) => {
      proc.once('exit', resolvePromise);
      setTimeout(resolvePromise, 1000);
    });
    await new Promise((resolvePromise) => mockAi.close(resolvePromise));
    rmSync(workdir, { recursive: true, force: true });
  }
});
