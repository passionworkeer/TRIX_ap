import process from 'node:process';
import { performance } from 'node:perf_hooks';

import { createCanvasTestEnvironment } from '../helpers/canvas-test-env.mjs';

const config = {
  sessions: Number(process.env.CANVAS_PRESSURE_SESSIONS || 24),
  concurrency: Number(process.env.CANVAS_PRESSURE_CONCURRENCY || 8),
  pollIntervalMs: Number(process.env.CANVAS_PRESSURE_POLL_INTERVAL_MS || 200),
  pollTimeoutMs: Number(process.env.CANVAS_PRESSURE_POLL_TIMEOUT_MS || 45_000),
};

function chunk(array, size) {
  const groups = [];
  for (let index = 0; index < array.length; index += size) {
    groups.push(array.slice(index, index + size));
  }
  return groups;
}

function summarize(values) {
  if (!values.length) {
    return { count: 0 };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
  const sum = sorted.reduce((acc, item) => acc + item, 0);
  return {
    count: sorted.length,
    minMs: Math.round(sorted[0]),
    p50Ms: Math.round(percentile(0.5)),
    p95Ms: Math.round(percentile(0.95)),
    maxMs: Math.round(sorted[sorted.length - 1]),
    avgMs: Math.round(sum / sorted.length),
  };
}

async function requestJson(baseUrl, path, init = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, init);
  const elapsedMs = performance.now() - started;
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    elapsedMs,
    body: text ? JSON.parse(text) : {},
  };
}

async function waitForSession(baseUrl, sessionId) {
  const started = performance.now();
  const deadline = Date.now() + config.pollTimeoutMs;
  while (Date.now() < deadline) {
    const { ok, body } = await requestJson(baseUrl, `/api/session/${sessionId}`);
    if (!ok) {
      throw new Error(`poll failed for ${sessionId}`);
    }
    const status = String(body?.data?.status || '').toLowerCase();
    if (status === 'completed') {
      return { status, elapsedMs: performance.now() - started };
    }
    if (status === 'error') {
      throw new Error(`session failed: ${sessionId}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, config.pollIntervalMs));
  }
  throw new Error(`session timeout: ${sessionId}`);
}

async function main() {
  const env = await createCanvasTestEnvironment({ workdirPrefix: 'trix-canvas-pressure-' });
  const timings = {
    submitMs: [],
    completeMs: [],
  };
  let projectId = '';

  try {
    const project = await requestJson(env.canvasUrl, '/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `pressure-${Date.now()}` }),
    });
    if (!project.ok) {
      throw new Error(`create project failed: ${project.status}`);
    }
    projectId = project.body.id;

    const requests = Array.from({ length: config.sessions }, (_, index) => ({
      index,
      message: `pressure scene ${index + 1}`,
      mediaType: index % 3 === 0 ? 'video' : 'image',
    }));

    const sessionIds = [];
    const batchedRequests = chunk(requests, Math.max(1, config.concurrency));
    for (const batch of batchedRequests) {
      const created = await Promise.all(
        batch.map(async (item) => {
          const submit = await requestJson(env.canvasUrl, '/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              message: item.message,
              mediaType: item.mediaType,
              aspect: item.mediaType === 'video' ? '16:9' : '1:1',
            }),
          });
          if (!submit.ok || !submit.body?.data?.sessionId) {
            throw new Error(`submit failed (${submit.status}) for scene ${item.index + 1}`);
          }
          timings.submitMs.push(submit.elapsedMs);
          return submit.body.data.sessionId;
        }),
      );
      sessionIds.push(...created);
    }

    const completion = await Promise.all(sessionIds.map((sessionId) => waitForSession(env.canvasUrl, sessionId)));
    completion.forEach((item) => timings.completeMs.push(item.elapsedMs));

    const summary = {
      sessions: config.sessions,
      concurrency: config.concurrency,
      submit: summarize(timings.submitMs),
      complete: summarize(timings.completeMs),
      canvasUrl: env.canvasUrl,
      projectId,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await env.shutdown();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
