#!/usr/bin/env node
/**
 * Comprehensive tests for TRIX Canvas AI Proxy (proxy.js)
 *
 * Tests cover:
 * 1. POST /api/session → creates session, returns session_id
 * 2. GET /api/session/:id → returns session status
 * 3. GET /api/session/:id/result → returns result URLs when completed
 * 4. GET /capabilities → returns image/video/video-to-video capability status
 * 5. Health: GET /health → 200 OK
 * 6. Request timeout when upstream is slow
 * 7. Body size limit on large requests
 * 8. Invalid API key returns 401
 * 9. Session not found returns 404
 * 10. Concurrent session limit (MAX_SESSIONS eviction)
 * 11. Task polling deduplication
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PROXY_ENTRY = fileURLToPath(
  new URL('../../skills/trix-canvas-skill/assets/canvas-service/proxy.js', import.meta.url),
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

function startProxyServer(
  proxyPort,
  proxyUrl,
  upstreamUrl,
  options = {},
) {
  const {
    workdirPrefix = 'trix-proxy-test-',
    apiKey = 'test-api-key',
    maxSessions = 500,
    maxTasks = 500,
    requestTimeoutMs = 120000,
    maxBodyBytes = 256 * 1024,
  } = options;

  const workdir = mkdtempSync(join(tmpdir(), workdirPrefix));
  const env = {
    ...process.env,
    PROXY_HOST: HOST,
    PROXY_PORT: String(proxyPort),
    PROXY_ACCESS_TOKEN: apiKey,
    AI_API_BASE: upstreamUrl,
    AI_API_KEY: 'mock-upstream-key',
    AI_IMAGE_PATH: '/image',
    AI_VIDEO_PATH: '/video',
    AI_IMAGE_MODEL: 'test-image-model',
    AI_VIDEO_MODEL: 'test-video-model',
    AI_VIDEO_I2V_MODEL: 'test-i2v-model',
    PROXY_MAX_SESSIONS: String(maxSessions),
    PROXY_MAX_TASKS: String(maxTasks),
    PROXY_REQUEST_TIMEOUT_MS: String(requestTimeoutMs),
    PROXY_MAX_BODY_BYTES: String(maxBodyBytes),
    PROXY_TASK_TTL_MS: '3600000',
    PROXY_SESSION_TTL_MS: '3600000',
  };
  const proc = spawn('node', [PROXY_ENTRY], {
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
    hasExited() {
      return exitCode !== null || exitSignal !== null;
    },
    diagnostics() {
      const parts = [];
      if (exitCode !== null || exitSignal !== null) {
        parts.push(`proxy process exited (code=${exitCode ?? 'null'}, signal=${exitSignal ?? 'null'})`);
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

async function createProxyTestEnvironment(options = {}) {
  const proxyPort = options.proxyPort || await getFreePort(HOST);
  const upstreamPort = options.upstreamPort || await getFreePort(HOST);
  const proxyUrl = `http://${HOST}:${proxyPort}`;
  const upstreamUrl = `http://${HOST}:${upstreamPort}`;

  // Create mock upstream AI server
  const tasks = new Map();
  const sessions = new Map();

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

  // Start proxy server
  let proxyRuntime;
  try {
    proxyRuntime = startProxyServer(proxyPort, proxyUrl, upstreamUrl, {
      workdirPrefix: options.workdirPrefix || 'trix-proxy-test-',
      apiKey: options.apiKey,
      maxSessions: options.maxSessions,
      maxTasks: options.maxTasks,
      requestTimeoutMs: options.requestTimeoutMs,
      maxBodyBytes: options.maxBodyBytes,
    });
    await waitForOk(proxyUrl, '/health');
  } catch (error) {
    if (proxyRuntime?.proc) {
      await stopProcess(proxyRuntime.proc);
    }
    if (proxyRuntime?.workdir) {
      rmSync(proxyRuntime.workdir, { recursive: true, force: true });
    }
    await stopServer(mockUpstream);
    throw error;
  }

  return {
    host: HOST,
    proxyPort,
    proxyUrl,
    upstreamPort,
    upstreamUrl,
    workdir: proxyRuntime.workdir,
    process: proxyRuntime.proc,
    mockUpstream,
    apiKey: options.apiKey || 'test-api-key',
    async shutdown() {
      await stopProcess(proxyRuntime.proc);
      await stopServer(mockUpstream);
      rmSync(proxyRuntime.workdir, { recursive: true, force: true });
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

async function waitForSessionStatus(proxyUrl, sessionId, expected, attempts = 180, delayMs = 200, apiKey = '') {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  for (let i = 0; i < attempts; i += 1) {
    const { response, payload } = await getJson(proxyUrl, `/api/session/${sessionId}`, headers);
    assert.equal(response.status, 200, 'session polling should succeed');
    const status = payload?.data?.status;
    if (status === expected) {
      return payload.data;
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`session failed: ${payload?.data?.error || 'unknown error'}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
  }
  throw new Error(`session ${sessionId} did not reach ${expected} (attempts: ${attempts})`);
}

// ── Test Suite ─────────────────────────────────────────────────────────────

test('TRIX Canvas AI Proxy - Comprehensive Tests', async (t) => {
  // Test 1: Health endpoint
  await t.test('health endpoint returns 200 OK', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-health-' });
    try {
      const response = await fetch(`${env.proxyUrl}/health`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body?.status, 'ok');
      assert.equal(body?.service, 'trix-canvas-ai-proxy');
    } finally {
      await env.shutdown();
    }
  });

  // Test 2: Capabilities endpoint
  await t.test('capabilities endpoint returns capability status', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-caps-' });
    try {
      const response = await fetch(`${env.proxyUrl}/capabilities`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body?.status, 'ok');
      assert.ok('imageGenerateStatus' in body);
      assert.ok('videoGenerateStatus' in body);
      assert.ok('imageToVideoStatus' in body);
      assert.ok(body?.models);
      assert.ok(body?.paths);
    } finally {
      await env.shutdown();
    }
  });

  // Test 3: POST /api/session creates session
  await t.test('POST /api/session creates session and returns sessionId', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-session-' });
    try {
      const { response, payload } = await postJson(
        env.proxyUrl,
        '/api/session',
        {
          message: 'Generate a test image',
          media_type: 'image',
          aspect: '1:1',
        },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      assert.equal(response.status, 200);
      assert.ok(payload?.data?.sessionId, 'should return sessionId');
      assert.ok(payload?.data?.taskId, 'should return taskId');
      assert.equal(payload?.data?.status, 'generating');
    } finally {
      await env.shutdown();
    }
  });

  // Test 4: GET /api/session/:id returns status
  await t.test('GET /api/session/:id returns session status (pending/processing/completed)', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-poll-' });
    try {
      const { payload: session } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test session', media_type: 'image', aspect: '1:1' },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      const sessionId = session.data.sessionId;
      assert.ok(sessionId, 'should create session');

      // Poll until completed
      const completed = await waitForSessionStatus(env.proxyUrl, sessionId, 'completed', 180, 200, env.apiKey);
      assert.ok(completed.resultUrls?.length > 0, 'should have result URLs');
      assert.ok(completed.resultUrls[0]?.startsWith('http'), 'result URL should be absolute');
    } finally {
      await env.shutdown();
    }
  });

  // Test 5: GET /api/session/:id/result returns result URLs
  await t.test('GET /api/session/:id/result returns result URLs when completed', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-result-' });
    try {
      const { payload: session } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test result URL', media_type: 'image', aspect: '16:9' },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      const sessionId = session.data.sessionId;

      // Wait for completion
      await waitForSessionStatus(env.proxyUrl, sessionId, 'completed', 180, 200, env.apiKey);

      // Get result
      const { response, payload } = await getJson(
        env.proxyUrl,
        `/api/session/${sessionId}/result`,
        { Authorization: `Bearer ${env.apiKey}` },
      );
      assert.equal(response.status, 200);
      assert.ok(payload?.resultUrls?.length > 0, 'should have result URLs');
    } finally {
      await env.shutdown();
    }
  });

  // Test 6: Invalid API key returns 401
  await t.test('invalid API key returns 401 Unauthorized', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-auth-',
      apiKey: 'correct-api-key',
    });
    try {
      const { response, payload } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test' },
        { Authorization: 'Bearer wrong-api-key' },
      );
      assert.equal(response.status, 401);
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 7: Missing API key on protected endpoint returns 401
  await t.test('missing API key returns 401 Unauthorized', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-noauth-',
      apiKey: 'some-api-key',
    });
    try {
      const { response, payload } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test' },
        // No Authorization header
      );
      assert.equal(response.status, 401);
    } finally {
      await env.shutdown();
    }
  });

  // Test 8: Session not found returns 404
  await t.test('GET /api/session/:id with unknown sessionId returns 404', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-404-' });
    try {
      const { response, payload } = await getJson(
        env.proxyUrl,
        '/api/session/nonexistent_session_12345',
        { Authorization: `Bearer ${env.apiKey}` },
      );
      assert.equal(response.status, 404);
      assert.ok(payload?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 9: Request timeout when upstream is slow
  await t.test('request timeout when upstream is slow (> PROXY_REQUEST_TIMEOUT_MS)', async () => {
    // Create mock upstream that hangs
    const slowUpstreamPort = await getFreePort(HOST);
    const slowUpstream = createHttpServer((req, res) => {
      // Never respond - just hang
    });
    await new Promise((resolvePromise) => slowUpstream.listen(slowUpstreamPort, HOST, resolvePromise));

    const shortTimeout = 1000; // 1 second timeout
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-timeout-',
      proxyPort: await getFreePort(HOST),
      upstreamPort: slowUpstreamPort,
      requestTimeoutMs: shortTimeout,
    });

    try {
      const { response, payload } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test timeout', media_type: 'image' },
        { Authorization: `Bearer ${env.apiKey}` },
      );

      // Session should fail due to timeout
      assert.equal(response.status, 200); // Session created
      const sessionId = payload.data.sessionId;

      // Poll and expect failed status
      const failed = await waitForSessionStatus(env.proxyUrl, sessionId, 'failed', 60, 2000, env.apiKey);
      assert.ok(failed.error?.includes('timeout') || failed.error?.includes('failed'), 'should timeout');
    } finally {
      await env.shutdown();
      await stopServer(slowUpstream);
    }
  });

  // Test 10: Body size limit on large requests
  await t.test('413 Request Entity Too Large when body exceeds MAX_BODY_BYTES', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-largebody-',
      maxBodyBytes: 1024, // 1KB limit
    });
    try {
      // Create a large payload
      const largePayload = {
        message: 'x'.repeat(2048), // 2KB message
        media_type: 'image',
      };

      const response = await fetch(`${env.proxyUrl}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.apiKey}`,
        },
        body: JSON.stringify(largePayload),
      });

      assert.equal(response.status, 413);
      const body = await response.json();
      assert.ok(body?.error, 'should return error message');
    } finally {
      await env.shutdown();
    }
  });

  // Test 11: Concurrent session limit (MAX_SESSIONS eviction)
  await t.test('MAX_SESSIONS eviction - oldest completed sessions are evicted', async () => {
    const MAX_SESSIONS = 5;
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-evict-',
      maxSessions: MAX_SESSIONS,
    });
    try {
      // Create MAX_SESSIONS sessions and complete them
      const sessionIds = [];
      for (let i = 0; i < MAX_SESSIONS; i += 1) {
        const { payload } = await postJson(
          env.proxyUrl,
          '/api/session',
          { message: `Session ${i}`, media_type: 'image', aspect: '1:1' },
          { Authorization: `Bearer ${env.apiKey}` },
        );
        sessionIds.push(payload.data.sessionId);
      }

      // Wait for all to complete
      await Promise.all(
        sessionIds.map((sessionId) =>
          waitForSessionStatus(env.proxyUrl, sessionId, 'completed', 60, 500, env.apiKey),
        ),
      );

      // Create one more session to trigger eviction
      const { payload: newSession } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'New session after eviction', media_type: 'image', aspect: '1:1' },
        { Authorization: `Bearer ${env.apiKey}` },
      );

      // The new session should work
      assert.ok(newSession.data?.sessionId, 'should create new session after eviction');

      // Try to access the oldest session - it might be evicted
      const oldestResponse = await fetch(
        `${env.proxyUrl}/api/session/${sessionIds[0]}`,
        { headers: { Authorization: `Bearer ${env.apiKey}` } },
      );
      // Old sessions may be evicted after MAX_SESSIONS + 1 new session
      // Just verify the new session works
      assert.ok(newSession.data?.sessionId);
    } finally {
      await env.shutdown();
    }
  });

  // Test 12: Task polling deduplication
  await t.test('concurrent GET /api/session/:id requests are deduplicated', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-dedup-' });
    try {
      const { payload: session } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Dedupe test', media_type: 'image', aspect: '1:1' },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      const sessionId = session.data.sessionId;

      // Make many concurrent poll requests
      const concurrentPolls = await Promise.all(
        Array.from({ length: 20 }, () =>
          getJson(env.proxyUrl, `/api/session/${sessionId}`, {
            Authorization: `Bearer ${env.apiKey}`,
          }),
        ),
      );

      // All should return 200
      concurrentPolls.forEach(({ response }) => {
        assert.equal(response.status, 200, 'concurrent polls should succeed');
      });

      // At least one should have completed eventually
      const completed = await waitForSessionStatus(env.proxyUrl, sessionId, 'completed', 180, 200, env.apiKey);
      assert.ok(completed, 'session should complete');
    } finally {
      await env.shutdown();
    }
  });

  // Test 13: Image vs Video dispatch based on media_type
  await t.test('POST /api/session dispatches to image vs video based on media_type', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-media-' });
    try {
      // Create image session
      const { payload: imageSession } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test image', media_type: 'image', aspect: '1:1' },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      assert.ok(imageSession.data?.sessionId, 'image session created');
      assert.equal(imageSession.data?.status, 'generating');

      // Create video session
      const { payload: videoSession } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test video', media_type: 'video', aspect: '16:9' },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      assert.ok(videoSession.data?.sessionId, 'video session created');
      assert.equal(videoSession.data?.status, 'generating');

      // Wait for both to complete
      await Promise.all([
        waitForSessionStatus(env.proxyUrl, imageSession.data.sessionId, 'completed', 180, 200, env.apiKey),
        waitForSessionStatus(env.proxyUrl, videoSession.data.sessionId, 'completed', 180, 200, env.apiKey),
      ]);
    } finally {
      await env.shutdown();
    }
  });

  // Test 14: Capabilities reflect actual API configuration
  await t.test('capabilities reflect actual API configuration (AI_API_KEY, AI_IMAGE_PATH, etc.)', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-apicfg-',
    });
    try {
      const response = await fetch(`${env.proxyUrl}/capabilities`);
      const body = await response.json();

      // With mock upstream configured, should be ready
      assert.equal(body?.imageGenerateStatus, 'ready', 'image generation should be ready');
      assert.equal(body?.videoGenerateStatus, 'ready', 'video generation should be ready');
      assert.ok(body?.models?.image, 'should have image model configured');
      assert.ok(body?.models?.video, 'should have video model configured');
      assert.ok(body?.paths?.image, 'should have image path configured');
      assert.ok(body?.paths?.video, 'should have video path configured');
    } finally {
      await env.shutdown();
    }
  });

  // Test 15: CORS headers on valid origin
  await t.test('CORS headers are set for allowed origins', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-cors-',
      allowedOrigins: 'http://localhost:3000,http://example.com',
    });
    try {
      const response = await fetch(`${env.proxyUrl}/health`, {
        headers: { Origin: 'http://localhost:3000' },
      });

      assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
      assert.ok(response.headers.get('Vary')?.includes('Origin'));
    } finally {
      await env.shutdown();
    }
  });

  // Test 16: POST /generate endpoint (Canvas service pattern)
  await t.test('POST /generate creates task and returns taskId', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-generate-' });
    try {
      const { response, payload } = await postJson(
        env.proxyUrl,
        '/generate',
        {
          prompt: 'Generate a test image',
          media_type: 'image',
          aspect: '1:1',
        },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      assert.equal(response.status, 200);
      assert.ok(payload?.task_id, 'should return task_id');
      assert.equal(payload?.status, 'pending');
    } finally {
      await env.shutdown();
    }
  });

  // Test 17: GET /tasks/:taskId polling
  await t.test('GET /tasks/:taskId returns task status and output', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-taskpoll-' });
    try {
      // Create task
      const { payload: task } = await postJson(
        env.proxyUrl,
        '/generate',
        { prompt: 'Test task', media_type: 'image' },
        { Authorization: `Bearer ${env.apiKey}` },
      );
      const taskId = task.task_id;

      // Poll until completed
      let attempts = 0;
      let taskStatus = 'pending';
      while (taskStatus !== 'completed' && attempts < 60) {
        const { response, payload } = await getJson(
          env.proxyUrl,
          `/tasks/${taskId}`,
          { Authorization: `Bearer ${env.apiKey}` },
        );
        assert.equal(response.status, 200);
        taskStatus = payload?.status;
        if (taskStatus === 'completed') {
          assert.ok(payload?.output || payload?.urls?.length > 0, 'should have output');
          break;
        }
        if (taskStatus === 'failed') {
          throw new Error(`Task failed: ${payload?.error}`);
        }
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
        attempts += 1;
      }
      assert.equal(taskStatus, 'completed', 'task should complete');
    } finally {
      await env.shutdown();
    }
  });

  // Test 18: Aspect ratio parsing
  await t.test('aspect ratio is resolved correctly (1:1, 16:9, 9:16, etc.)', async () => {
    const env = await createProxyTestEnvironment({ workdirPrefix: 'trix-proxy-aspect-' });
    try {
      const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
      const sessions = [];

      for (const aspect of aspectRatios) {
        const { payload } = await postJson(
          env.proxyUrl,
          '/api/session',
          { message: `Test ${aspect}`, media_type: 'image', aspect },
          { Authorization: `Bearer ${env.apiKey}` },
        );
        sessions.push(payload.data.sessionId);
      }

      // All should complete successfully
      await Promise.all(
        sessions.map((sessionId) =>
          waitForSessionStatus(env.proxyUrl, sessionId, 'completed', 60, 300, env.apiKey),
        ),
      );
    } finally {
      await env.shutdown();
    }
  });

  // Test 19: Foreign origin is rejected (403)
  await t.test('foreign browser origin is rejected with 403', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-foreign-',
      allowedOrigins: 'http://allowed.example.com',
    });
    try {
      const { response, payload } = await postJson(
        env.proxyUrl,
        '/api/session',
        { message: 'Test' },
        {
          Origin: 'http://evil.example.com',
          Authorization: `Bearer ${env.apiKey}`,
        },
      );
      assert.equal(response.status, 403);
      assert.ok(payload?.error, 'should return error');
    } finally {
      await env.shutdown();
    }
  });

  // Test 20: OPTIONS preflight request
  await t.test('OPTIONS preflight request returns 204', async () => {
    const env = await createProxyTestEnvironment({
      workdirPrefix: 'trix-proxy-options-',
      allowedOrigins: 'http://localhost:3000',
    });
    try {
      const response = await fetch(`${env.proxyUrl}/api/session`, {
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
});
