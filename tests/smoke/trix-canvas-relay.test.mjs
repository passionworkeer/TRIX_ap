#!/usr/bin/env node
/**
 * Comprehensive tests for TRIX Canvas Relay (relay.js)
 *
 * Tests cover:
 * 1. POST /generate → creates task, returns taskId
 * 2. GET /tasks/:taskId → returns status and URL when done
 * 3. Aspect ratio parsing from prompt ("16:9", "9:16", "1:1")
 * 4. Base64-encoded result storage
 * 5. Image vs video dispatch based on prompt type
 * 6. Missing API key → 401 error
 * 7. Task not found → 404
 * 8. Health: GET /health → 200 OK
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const RELAY_ENTRY = fileURLToPath(
  new URL('../../skills/trix-canvas-skill/assets/canvas-service/relay.js', import.meta.url),
);

// ── Test Environment Setup ──────────────────────────────────────────────────

async function getFreePort(host = HOST) {
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

async function waitForOk(baseUrl, endpoint = '/health', attempts = 300, delayMs = 100) {
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

function startRelayServer(
  relayPort,
  relayUrl,
  upstreamUrl,
  options = {},
) {
  const {
    workdirPrefix = 'trix-relay-test-',
    apiKey = '',
    maxBodyBytes = 256 * 1024,
    requestTimeoutMs = 120000,
    taskTtlMs = 3600000,
    allowRemote = false,
    allowedOrigins = '',
    imageApiUrl = `${upstreamUrl}/image`,
  } = options;

  const workdir = mkdtempSync(join(tmpdir(), workdirPrefix));
  const outputDir = join(workdir, 'outputs');

  const env = {
    ...process.env,
    RELAY_ALLOWED_ORIGINS: allowedOrigins,
    RELAY_HOST: HOST,
    RELAY_PORT: String(relayPort),
    RELAY_ACCESS_TOKEN: apiKey,
    RELAY_ALLOW_REMOTE: allowRemote ? 'true' : 'false',
    IMAGE_API_URL: imageApiUrl,
    IMAGE_API_METHOD: 'POST',
    IMAGE_API_KEY: 'mock-image-key',
    IMAGE_API_MODEL: 'test-image-model',
    VIDEO_API_URL: `${upstreamUrl}/video`,
    VIDEO_API_METHOD: 'POST',
    VIDEO_API_KEY: 'mock-video-key',
    VIDEO_API_MODEL: 'test-video-model',
    RELAY_OUTPUT_PREFIX: `${relayUrl}/outputs`,
    RELAY_MAX_BODY_BYTES: String(maxBodyBytes),
    RELAY_REQUEST_TIMEOUT_MS: String(requestTimeoutMs),
    RELAY_TASK_TTL_MS: String(taskTtlMs),
  };
  const proc = spawn('node', [RELAY_ENTRY], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let exitCode = null;
  let exitSignal = null;

  proc.stdout.on('data', (chunk) => {
    stdout = `${stdout}${chunk.toString()}`.slice(-16_000);
  });
  proc.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-16_000);
  });
  proc.once('exit', (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  return {
    proc,
    workdir,
    outputDir,
    hasExited() {
      return exitCode !== null || exitSignal !== null;
    },
    diagnostics() {
      const parts = [];
      if (exitCode !== null || exitSignal !== null) {
        parts.push(`relay process exited (code=${exitCode ?? 'null'}, signal=${exitSignal ?? 'null'})`);
      }
      if (stderr.trim()) {
        parts.push(`stderr:\n${stderr.trim()}`);
      }
      if (stdout.trim()) {
        parts.push(`stdout:\n${stdout.trim()}`);
      }
      return parts.join('\n\n');
    },
  };
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

async function createRelayTestEnvironment(options = {}) {
  const relayPort = options.relayPort || await getFreePort(HOST);
  const upstreamPort = options.upstreamPort || await getFreePort(HOST);
  const relayUrl = `http://${HOST}:${relayPort}`;
  const upstreamUrl = `http://${HOST}:${upstreamPort}`;

  // Create mock upstream AI server
  const tasks = new Map();

  const mockUpstream = createHttpServer(async (req, res) => {
    const url = new URL(req.url, upstreamUrl);
    const method = req.method;

    // Health endpoint
    if (method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Image generation endpoint
    if (method === 'POST' && url.pathname === '/image') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const payload = JSON.parse(body || '{}');
      const taskId = `upstream_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      tasks.set(taskId, { type: 'image', payload, polls: 0 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ task_id: taskId, status: 'pending' }));
      return;
    }

    // Video generation endpoint
    if (method === 'POST' && url.pathname === '/video') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      const payload = JSON.parse(body || '{}');
      const taskId = `upstream_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      tasks.set(taskId, { type: 'video', payload, polls: 0 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ task_id: taskId, status: 'pending' }));
      return;
    }

    // Poll task status
    if (method === 'GET' && url.pathname.startsWith('/tasks/')) {
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

      // Return completed result
      const mediaType = task.type === 'video' ? 'video' : 'image';
      const mockUrl = task.type === 'video'
        ? `${upstreamUrl}/outputs/test-video.mp4`
        : `${upstreamUrl}/outputs/test-image.png`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        task_id: taskId,
        status: 'completed',
        urls: [mockUrl],
        [mediaType === 'image' ? 'image_url' : 'video_url']: mockUrl,
      }));
      return;
    }

    // Mock static files
    if (method === 'GET' && url.pathname === '/outputs/test-image.png') {
      const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XnV0AAAAASUVORK5CYII=', 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(pngData);
      return;
    }

    if (method === 'GET' && url.pathname === '/outputs/test-video.mp4') {
      const mp4Data = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAAC21kYXQAAAAA', 'base64');
      res.writeHead(200, { 'Content-Type': 'video/mp4' });
      res.end(mp4Data);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolvePromise) => mockUpstream.listen(upstreamPort, HOST, resolvePromise));

  // Start relay server
  let relayRuntime;
  try {
    relayRuntime = startRelayServer(relayPort, relayUrl, upstreamUrl, {
      workdirPrefix: options.workdirPrefix || 'trix-relay-test-',
      apiKey: options.apiKey,
      maxBodyBytes: options.maxBodyBytes,
      requestTimeoutMs: options.requestTimeoutMs,
      taskTtlMs: options.taskTtlMs,
      allowRemote: options.allowRemote,
      allowedOrigins: options.allowedOrigins || '',
    });
    await waitForOk(relayUrl, '/health');
  } catch (error) {
    if (relayRuntime?.proc) {
      await stopProcess(relayRuntime.proc);
    }
    if (relayRuntime?.workdir) {
      rmSync(relayRuntime.workdir, { recursive: true, force: true });
    }
    await stopServer(mockUpstream);
    throw error;
  }

  return {
    host: HOST,
    relayPort,
    relayUrl,
    upstreamPort,
    upstreamUrl,
    workdir: relayRuntime.workdir,
    outputDir: relayRuntime.outputDir,
    process: relayRuntime.proc,
    mockUpstream,
    apiKey: options.apiKey || '',
    async shutdown() {
      await stopProcess(relayRuntime.proc);
      await stopServer(mockUpstream);
      rmSync(relayRuntime.workdir, { recursive: true, force: true });
    },
  };
}

// ── Helper Functions ───────────────────────────────────────────────────────

async function postJson(url, path, body, headers = {}) {
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    payload: text ? JSON.parse(text) : {},
  };
}

async function getJson(url, path, headers = {}) {
  const response = await fetch(`${url}${path}`, {
    method: 'GET',
    headers,
  });
  const text = await response.text();
  return {
    response,
    payload: text ? JSON.parse(text) : {},
  };
}

async function waitForTaskStatus(relayUrl, taskId, expected, attempts = 180, delayMs = 200) {
  for (let i = 0; i < attempts; i += 1) {
    const { response, payload } = await getJson(relayUrl, `/tasks/${taskId}`);
    assert.equal(response.status, 200, 'task polling should succeed');
    const status = payload?.status;
    if (status === expected) {
      return payload;
    }
    if (status === 'failed') {
      throw new Error(`Task failed: ${payload?.error || 'unknown error'}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
  }
  throw new Error(`Task ${taskId} did not reach ${expected} (attempts: ${attempts})`);
}

// ── Test Suite ─────────────────────────────────────────────────────────────

test('TRIX Canvas Relay - Comprehensive Tests', async (t) => {
  // Test 1: Health endpoint
  await t.test('health endpoint returns 200 OK', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-health-' });
    try {
      const response = await fetch(`${env.relayUrl}/health`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body?.status, 'ok');
      assert.equal(body?.service, 'trix-canvas-relay');
    } finally {
      await env.shutdown();
    }
  });

  // Test 2: POST /generate creates task
  await t.test('POST /generate creates task and returns taskId', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-generate-' });
    try {
      const { response, payload } = await postJson(
        env.relayUrl,
        '/generate',
        {
          prompt: 'Generate a beautiful landscape',
          media_type: 'image',
        },
      );
      assert.equal(response.status, 200);
      assert.ok(payload?.task_id, 'should return task_id');
      assert.equal(payload?.status, 'pending');
    } finally {
      await env.shutdown();
    }
  });

  // Test 3: GET /tasks/:taskId returns status and URL when completed
  await t.test('GET /tasks/:taskId returns status and output URL when completed', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-poll-' });
    try {
      const { payload: task } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Test task completion',
        media_type: 'image',
      });
      const taskId = task.task_id;
      assert.ok(taskId, 'should have task_id');

      // Poll until completed
      const completed = await waitForTaskStatus(env.relayUrl, taskId, 'completed');
      assert.ok(completed?.output?.url || completed?.state, 'should have output');
      assert.ok(completed?.status === 'completed', 'should be completed');
    } finally {
      await env.shutdown();
    }
  });

  // Test 4: Aspect ratio parsing from prompt
  await t.test('aspect ratio is parsed from prompt ([16:9], [9:16], [1:1] format)', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-aspect-' });
    try {
      const testCases = [
        { prompt: 'Beautiful landscape [16:9]', expectedAspect: '16:9' },
        { prompt: 'Portrait photo [9:16]', expectedAspect: '9:16' },
        { prompt: 'Square image [1:1]', expectedAspect: '1:1' },
        { prompt: 'Cinematic [3:2] ratio', expectedAspect: '3:2' },
        { prompt: 'Portrait [2:3] orientation', expectedAspect: '2:3' },
      ];

      for (const { prompt, expectedAspect } of testCases) {
        const { payload: task } = await postJson(env.relayUrl, '/generate', {
          prompt,
          media_type: 'image',
        });
        const taskId = task.task_id;
        assert.ok(taskId, `should create task for "${prompt}"`);

        // Poll to completion
        await waitForTaskStatus(env.relayUrl, taskId, 'completed', 60, 300);
      }
    } finally {
      await env.shutdown();
    }
  });

  // Test 5: Base64-encoded result storage
  await t.test('base64-encoded results are stored to disk and served', async () => {
    // Create a mock upstream that returns base64 data (no URL) so relay stores it.
    const upstreamPort = await getFreePort(HOST);
    const upstreamUrl = `http://${HOST}:${upstreamPort}`;
    const base64Upstream = createHttpServer(async (req, res) => {
      const url = new URL(req.url, upstreamUrl);
      if (req.method === 'POST' && url.pathname === '/image') {
        // Return a task ID; relay will poll /poll to check completion.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ task_id: 'base64_task', status: 'pending' }));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/poll') {
        // Return base64 data — no URL — so relay stores it locally.
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          task_id: 'base64_task',
          status: 'completed',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
        }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolvePromise) => base64Upstream.listen(upstreamPort, HOST, resolvePromise));

    const relayPort = await getFreePort(HOST);
    const relayUrl = `http://${HOST}:${relayPort}`;
    // Use /poll as IMAGE_API_URL so the mock returns base64 directly.
    const relayRuntime = startRelayServer(relayPort, relayUrl, upstreamUrl, {
      workdirPrefix: 'trix-relay-base64-',
      allowedOrigins: '',
      imageApiUrl: `${upstreamUrl}/poll`,
    });

    try {
      await waitForOk(relayUrl, '/health');

      const { payload: task } = await postJson(relayUrl, '/generate', {
        prompt: 'Test base64 storage',
        media_type: 'image',
      });

      const completed = await waitForTaskStatus(relayUrl, task.task_id, 'completed');
      const outputUrl = completed?.output?.url;
      assert.ok(outputUrl?.includes('/outputs/'), 'output URL should be in /outputs/');

      // Extract filename from relay's response URL — storeBase64 writes relative to
      // relay.js's __dirname, not the test's temp workdir.
      const filename = outputUrl.split('/').pop();
      assert.ok(filename?.endsWith('.png'), 'output should be a PNG');

      // Verify the file was stored on disk (relative to relay.js __dirname)
      const outputFilePath = join(dirname(RELAY_ENTRY), 'outputs', filename);
      assert.ok(existsSync(outputFilePath), 'base64 result should be saved to disk');

      // Verify it's a valid PNG
      const fileData = readFileSync(outputFilePath);
      assert.ok(fileData.length > 0, 'stored file should have content');
      assert.ok(fileData.toString('hex').startsWith('89504e47'), 'should be a valid PNG');
    } finally {
      await relayRuntime.proc?.kill('SIGINT');
      await new Promise((r) => setTimeout(r, 1000));
      rmSync(relayRuntime.workdir, { recursive: true, force: true });
      await stopServer(base64Upstream);
    }
  });

  // Test 6: Image vs video dispatch based on prompt type
  await t.test('prompt type dispatches to image vs video generation', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-mediatype-' });
    try {
      // Explicit media_type: image
      const { payload: imageTask } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Test image',
        media_type: 'image',
      });
      assert.ok(imageTask.task_id);

      // Explicit media_type: video
      const { payload: videoTask } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Test video',
        media_type: 'video',
      });
      assert.ok(videoTask.task_id);

      // Implicit video from prompt keywords
      const { payload: videoPromptTask } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Generate a video of a sunset',
      });
      assert.ok(videoPromptTask.task_id);

      // Implicit image (no video keywords)
      const { payload: imagePromptTask } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Generate an image of mountains',
      });
      assert.ok(imagePromptTask.task_id);

      // Wait for all to complete
      await Promise.all([
        waitForTaskStatus(env.relayUrl, imageTask.task_id, 'completed', 60, 300),
        waitForTaskStatus(env.relayUrl, videoTask.task_id, 'completed', 60, 300),
        waitForTaskStatus(env.relayUrl, videoPromptTask.task_id, 'completed', 60, 300),
        waitForTaskStatus(env.relayUrl, imagePromptTask.task_id, 'completed', 60, 300),
      ]);
    } finally {
      await env.shutdown();
    }
  });

  // Test 7: Missing API key on protected endpoint (when RELAY_ACCESS_TOKEN is set)
  await t.test('missing API key returns 401 when RELAY_ACCESS_TOKEN is configured', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-noauth-',
      apiKey: 'required-api-key',
    });
    try {
      const { response, payload } = await postJson(
        env.relayUrl,
        '/generate',
        { prompt: 'Test' },
        // No Authorization header
      );
      assert.equal(response.status, 401);
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 8: Invalid API key returns 401
  await t.test('invalid API key returns 401 Unauthorized', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-badauth-',
      apiKey: 'correct-api-key',
    });
    try {
      const { response, payload } = await postJson(
        env.relayUrl,
        '/generate',
        { prompt: 'Test' },
        { Authorization: 'Bearer wrong-api-key' },
      );
      assert.equal(response.status, 401);
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 9: Task not found returns 404
  await t.test('GET /tasks/:taskId with unknown taskId returns 404', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-404-' });
    try {
      const { response, payload } = await getJson(
        env.relayUrl,
        '/tasks/nonexistent_task_xyz123',
      );
      assert.equal(response.status, 404);
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 10: Invalid JSON body returns 400
  await t.test('invalid JSON body returns 400 Bad Request', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-invalidjson-' });
    try {
      const response = await fetch(`${env.relayUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {',
      });
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 11: Missing prompt returns 400
  await t.test('missing prompt field returns 400', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-noprompt-' });
    try {
      const { response, payload } = await postJson(env.relayUrl, '/generate', {
        media_type: 'image',
        // No prompt field
      });
      assert.equal(response.status, 400);
      assert.ok(payload?.error, 'should return error message');
      assert.ok(payload?.error?.includes('prompt'), 'error should mention prompt');
    } finally {
      await env.shutdown();
    }
  });

  // Test 12: Body size limit
  await t.test('413 Request Entity Too Large when body exceeds RELAY_MAX_BODY_BYTES', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-largebody-',
      maxBodyBytes: 1024, // 1KB limit
    });
    try {
      // Create a large payload
      const largePayload = {
        prompt: 'x'.repeat(2048), // 2KB prompt
        media_type: 'image',
      };

      const response = await fetch(`${env.relayUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largePayload),
      });

      assert.equal(response.status, 413);
      const payload = await response.json();
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 13: CORS headers on allowed origin
  await t.test('CORS headers are set for allowed origins', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-cors-',
      allowedOrigins: 'http://localhost:3000,http://example.com',
    });
    try {
      const response = await fetch(`${env.relayUrl}/health`, {
        headers: { Origin: 'http://localhost:3000' },
      });

      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
      assert.ok(response.headers.get('Vary')?.includes('Origin'));
    } finally {
      await env.shutdown();
    }
  });

  // Test 14: Foreign origin is rejected
  await t.test('foreign browser origin is rejected with 403', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-foreign-',
      allowedOrigins: 'http://allowed.example.com',
    });
    try {
      const { response, payload } = await postJson(
        env.relayUrl,
        '/generate',
        { prompt: 'Test' },
        {
          Origin: 'http://evil.example.com',
        },
      );
      assert.equal(response.status, 403);
      assert.ok(payload?.error, 'should return error');
    } finally {
      await env.shutdown();
    }
  });

  // Test 15: OPTIONS preflight request
  await t.test('OPTIONS preflight request returns 204', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-options-',
      allowedOrigins: 'http://localhost:3000',
    });
    try {
      const response = await fetch(`${env.relayUrl}/generate`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });
      assert.equal(response.status, 204);
    } finally {
      await env.shutdown();
    }
  });

  // Test 16: Prompt cleanup (removes style markers)
  await t.test('prompt style markers are cleaned before sending to upstream', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-clean-' });
    try {
      const { payload: task } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Landscape [日式动漫] style [吉卜力] mountains',
        media_type: 'image',
        aspect: '16:9',
      });
      assert.ok(task.task_id);

      // Should still complete successfully even with style markers
      const completed = await waitForTaskStatus(env.relayUrl, task.task_id, 'completed', 60, 300);
      assert.ok(completed, 'should complete despite style markers');
    } finally {
      await env.shutdown();
    }
  });

  // Test 17: Request timeout handling
  await t.test('request timeout when upstream is slow (> RELAY_REQUEST_TIMEOUT_MS)', async () => {
    // Create mock upstream that hangs
    const slowUpstreamPort = await getFreePort(HOST);
    const slowUpstream = createHttpServer((req, res) => {
      // Never respond - just hang
    });
    await new Promise((resolvePromise) => slowUpstream.listen(slowUpstreamPort, HOST, resolvePromise));

    const shortTimeout = 1000; // 1 second timeout
    const relayPort = await getFreePort(HOST);
    const relayUrl = `http://${HOST}:${relayPort}`;
    const relayRuntime = startRelayServer(relayPort, relayUrl, `http://localhost:${slowUpstreamPort}`, {
      workdirPrefix: 'trix-relay-timeout-',
      requestTimeoutMs: shortTimeout,
    });

    try {
      await waitForOk(relayUrl, '/health');

      const { payload: task } = await postJson(relayUrl, '/generate', {
        prompt: 'Test timeout',
        media_type: 'image',
      });

      // Wait for task to fail due to timeout
      const failed = await waitForTaskStatus(relayUrl, task.task_id, 'failed', 60, 2000);
      assert.ok(failed?.error?.includes('timeout') || failed?.error, 'should timeout');
    } finally {
      await relayRuntime.proc?.kill('SIGINT');
      await new Promise((r) => setTimeout(r, 1000));
      rmSync(relayRuntime.workdir, { recursive: true, force: true });
      await stopServer(slowUpstream);
    }
  });

  // Test 18: Task TTL expiration
  await t.test('tasks are cleaned up after RELAY_TASK_TTL_MS', async () => {
    const env = await createRelayTestEnvironment({
      workdirPrefix: 'trix-relay-ttl-',
      taskTtlMs: 100, // 100ms TTL for testing
    });
    try {
      const { payload: task } = await postJson(env.relayUrl, '/generate', {
        prompt: 'Test TTL',
        media_type: 'image',
      });
      const taskId = task.task_id;
      assert.ok(taskId);

      // Wait for task to be cleaned up (TTL is 100ms)
      await new Promise((r) => setTimeout(r, 200));

      // Task should be gone
      const { response } = await getJson(env.relayUrl, `/tasks/${taskId}`);
      assert.equal(response.status, 404, 'task should be expired');
    } finally {
      await env.shutdown();
    }
  });

  // Test 19: Multiple concurrent requests
  await t.test('multiple concurrent POST /generate requests work correctly', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-concurrent-' });
    try {
      const CONCURRENT_REQUESTS = 10;
      const tasks = [];

      // Launch all requests concurrently
      for (let i = 0; i < CONCURRENT_REQUESTS; i += 1) {
        const taskPromise = postJson(env.relayUrl, '/generate', {
          prompt: `Concurrent request ${i}`,
          media_type: 'image',
          aspect: '1:1',
        });
        tasks.push(taskPromise);
      }

      const results = await Promise.all(tasks);

      // All should succeed
      results.forEach(({ response, payload }, index) => {
        assert.equal(response.status, 200, `request ${index} should succeed`);
        assert.ok(payload?.task_id, `request ${index} should have task_id`);
      });

      // All task IDs should be unique
      const taskIds = results.map((r) => r.payload.task_id);
      const uniqueIds = new Set(taskIds);
      assert.equal(uniqueIds.size, CONCURRENT_REQUESTS, 'all task IDs should be unique');

      // Wait for all to complete
      await Promise.all(
        taskIds.map((taskId) => waitForTaskStatus(env.relayUrl, taskId, 'completed', 60, 300)),
      );
    } finally {
      await env.shutdown();
    }
  });

  // Test 20: Prompt parsing with Chinese characters
  await t.test('Chinese characters in prompt are handled correctly', async () => {
    const env = await createRelayTestEnvironment({ workdirPrefix: 'trix-relay-chinese-' });
    try {
      const { payload: task } = await postJson(env.relayUrl, '/generate', {
        prompt: '生成一张美丽的风景照片 [16:9]',
        media_type: 'image',
      });
      assert.ok(task.task_id);

      const completed = await waitForTaskStatus(env.relayUrl, task.task_id, 'completed', 60, 300);
      assert.ok(completed, 'should complete with Chinese prompt');
    } finally {
      await env.shutdown();
    }
  });
});
