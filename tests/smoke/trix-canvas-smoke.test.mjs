import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIXTURE_IMAGE_BUFFER,
  createCanvasTestEnvironment,
} from '../helpers/canvas-test-env.mjs';

async function waitForSession(canvasUrl, sessionId, expected = 'completed', attempts = 180) {
  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(`${canvasUrl}/api/session/${sessionId}`);
    assert.equal(response.status, 200, 'session polling should succeed');
    const payload = await response.json();
    const data = payload.data;
    if (data?.status === expected) {
      return data;
    }
    if (data?.status === 'error' && expected !== 'error') {
      throw new Error(`session failed: ${data?.error || 'unknown error'}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`session ${sessionId} did not reach ${expected}`);
}

async function postJson(canvasUrl, path, body) {
  const response = await fetch(`${canvasUrl}${path}`, {
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

async function patchJson(canvasUrl, path, body) {
  const response = await fetch(`${canvasUrl}${path}`, {
    method: 'PATCH',
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
  const env = await createCanvasTestEnvironment({ workdirPrefix: 'trix-canvas-smoke-' });
  const { canvasUrl } = env;

  let projectId = '';
  try {
    await t.test('health endpoint is reachable', async () => {
      const response = await fetch(`${canvasUrl}/health`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body?.status, 'ok');
    });

    await t.test('backup or debug static artifacts are not exposed', async () => {
      const backupResponse = await fetch(`${canvasUrl}/canvas.html.bak`);
      assert.equal(backupResponse.status, 404);

      const debugResponse = await fetch(`${canvasUrl}/test.html`);
      assert.equal(debugResponse.status, 404);
    });

    await t.test('create and fetch project', async () => {
      const { response, payload } = await postJson(canvasUrl, '/api/projects', {
        name: 'smoke canvas',
        script_text: 'scene-one',
      });
      assert.equal(response.status, 201);
      projectId = payload.id;
      assert.ok(projectId);

      const listReq = await fetch(`${canvasUrl}/api/projects`);
      const list = await listReq.json();
      assert.ok(Array.isArray(list.data));
      assert.ok(list.data.some((item) => item.id === projectId));

      const detailReq = await fetch(`${canvasUrl}/api/project/${projectId}`);
      const detail = await detailReq.json();
      assert.equal(detail?.data?.id, projectId);
    });

    await t.test('foreign browser origin is rejected', async () => {
      const response = await fetch(`${canvasUrl}/api/session/change-project`, {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example',
          'Content-Type': 'text/plain;charset=UTF-8',
        },
        body: '',
      });
      assert.equal(response.status, 403);
    });

    await t.test('private external_url uploads are rejected when strict mode is enabled', async () => {
      const strictEnv = await createCanvasTestEnvironment({
        workdirPrefix: 'trix-canvas-smoke-strict-',
        allowPrivateRemoteUrls: false,
      });
      try {
        const created = await postJson(strictEnv.canvasUrl, '/api/projects', {
          name: 'strict-remote-upload',
        });
        assert.equal(created.response.status, 201);
        const strictProjectId = created.payload.id;
        assert.ok(strictProjectId);

        const attemptedUpload = await postJson(strictEnv.canvasUrl, '/api/upload', {
          projectId: strictProjectId,
          externalUrl: 'http://127.0.0.1:1/private.png',
        });
        assert.equal(attemptedUpload.response.status, 400);
        assert.match(String(attemptedUpload.payload.error || ''), /本地|局域网|私有地址/);
      } finally {
        await strictEnv.shutdown();
      }
    });

    await t.test('cross-project mutations are rejected', async () => {
      const { payload: otherProject } = await postJson(canvasUrl, '/api/projects', {
        name: 'isolation target',
      });
      const otherProjectId = otherProject.id;
      assert.ok(otherProjectId);

      const nodeA = await postJson(canvasUrl, '/api/nodes', {
        projectId,
        prompt: 'node-a',
      });
      assert.equal(nodeA.response.status, 201);

      const nodeB = await postJson(canvasUrl, '/api/nodes', {
        projectId: otherProjectId,
        prompt: 'node-b',
      });
      assert.equal(nodeB.response.status, 201);

      const fileB = await postJson(canvasUrl, '/api/upload', {
        projectId: otherProjectId,
        fileData: FIXTURE_IMAGE_BUFFER.toString('base64'),
        filename: 'foreign.png',
        mimeType: 'image/png',
      });
      assert.equal(fileB.response.status, 200);

      const crossEdge = await postJson(canvasUrl, '/api/edges', {
        projectId,
        sourceNodeId: nodeA.payload.id,
        targetNodeId: nodeB.payload.id,
      });
      assert.equal(crossEdge.response.status, 409);

      const foreignUpload = await postJson(canvasUrl, '/api/upload', {
        projectId,
        nodeId: nodeB.payload.id,
        fileData: FIXTURE_IMAGE_BUFFER.toString('base64'),
        filename: 'cross-attach.png',
        mimeType: 'image/png',
      });
      assert.equal(foreignUpload.response.status, 409);

      const patchForeignFile = await patchJson(canvasUrl, `/api/nodes/${nodeA.payload.id}`, {
        fileId: fileB.payload.id,
      });
      assert.equal(patchForeignFile.response.status, 409);

      const patchForeignParent = await patchJson(canvasUrl, `/api/nodes/${nodeA.payload.id}`, {
        parentNodeId: nodeB.payload.id,
      });
      assert.equal(patchForeignParent.response.status, 409);
    });

    await t.test('concurrent refresh does not duplicate stored files', async () => {
      const { payload: isolatedProject } = await postJson(canvasUrl, '/api/projects', {
        name: 'poll-dedupe',
      });
      assert.ok(isolatedProject.id);

      const created = await postJson(canvasUrl, '/api/session', {
        projectId: isolatedProject.id,
        message: 'Poll dedupe image',
        mediaType: 'image',
        aspect: '1:1',
      });
      assert.equal(created.response.status, 200);

      await Promise.all(
        Array.from({ length: 12 }, () =>
          fetch(`${canvasUrl}/api/session/${created.payload.data.sessionId}`),
        ),
      );

      const session = await waitForSession(canvasUrl, created.payload.data.sessionId);
      assert.equal(session.status, 'completed');

      const detailReq = await fetch(`${canvasUrl}/api/projects/${isolatedProject.id}`);
      const detail = await detailReq.json();
      assert.equal(detail?.data?.files?.length, 1);
      assert.equal(detail?.data?.nodes?.length, 1);
    });

    await t.test('invalid upstream URL marks session as error', async () => {
      const { payload: isolatedProject } = await postJson(canvasUrl, '/api/projects', {
        name: 'bad-url-project',
      });
      assert.ok(isolatedProject.id);

      const created = await postJson(canvasUrl, '/api/session', {
        projectId: isolatedProject.id,
        message: 'bad-url image',
        mediaType: 'image',
        aspect: '1:1',
      });
      assert.equal(created.response.status, 200);

      const failed = await waitForSession(canvasUrl, created.payload.data.sessionId, 'error');
      assert.equal(failed.status, 'error');
      assert.equal(failed.resultUrls?.length || 0, 0);
    });

    await t.test('image session completes and stores media locally', async () => {
      const { response, payload } = await postJson(canvasUrl, '/api/session', {
        projectId,
        message: 'Hello smoke image',
        mediaType: 'image',
        aspect: '1:1',
      });
      assert.equal(response.status, 200);
      assert.equal(payload.data?.status, 'generating');
      assert.ok(payload.data?.sessionId);

      const session = await waitForSession(canvasUrl, payload.data.sessionId);
      assert.equal(session.status, 'completed');
      assert.ok(session.resultUrls[0]?.startsWith('/media/files/'));

      const mediaReq = await fetch(`${canvasUrl}${session.resultUrls[0]}`);
      assert.equal(mediaReq.status, 200);
      assert.match(mediaReq.headers.get('content-type') || '', /image\/png/);
    });

    await t.test('video session completes and export endpoints work', async () => {
      const { payload } = await postJson(canvasUrl, '/api/session', {
        projectId,
        message: 'Hello smoke video',
        mediaType: 'video',
        aspect: '16:9',
      });
      assert.equal(payload.data?.status, 'generating');

      const videoSession = await waitForSession(canvasUrl, payload.data.sessionId);
      assert.equal(videoSession.status, 'completed');
      assert.ok(videoSession.resultUrls[0]?.startsWith('/media/files/'));

      const subtitleReq = await fetch(`${canvasUrl}/api/projects/${projectId}/export/subtitle`);
      assert.equal(subtitleReq.status, 200);
      const subtitle = await subtitleReq.json();
      assert.ok(subtitle.srt_url?.startsWith('/media/exports/'));

      const videoExportReq = await fetch(`${canvasUrl}/api/projects/${projectId}/export/video?aspect=1:1`);
      assert.equal(videoExportReq.status, 200);
      const videoExport = await videoExportReq.json();
      assert.ok(videoExport.url?.startsWith('/media/exports/'));

      const exportedVideoReq = await fetch(`${canvasUrl}${videoExport.url}`);
      assert.equal(exportedVideoReq.status, 200);
      assert.match(exportedVideoReq.headers.get('content-type') || '', /video\/mp4/);
    });
  } finally {
    if (projectId) {
      await fetch(`${canvasUrl}/api/projects/${projectId}`, { method: 'DELETE' });
    }
    await env.shutdown();
  }
});
