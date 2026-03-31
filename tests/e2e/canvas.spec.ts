import { test, expect } from '@playwright/test';

import { createCanvasTestEnvironment, FIXTURE_IMAGE_BUFFER } from '../helpers/canvas-test-env.mjs';

test.describe.configure({ mode: 'serial' });

let canvasBase = '';
let env;

async function fetchJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${canvasBase}${path}`, init);
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

function projectIdFromUrl(url: string): string {
  return new URL(url).searchParams.get('projectId') || '';
}

async function waitForProject(projectId: string, attempts = 180) {
  for (let index = 0; index < attempts; index += 1) {
    const { status, body } = await fetchJson(`/api/projects/${projectId}`);
    if (status === 200 && body?.data) {
      return body.data;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`project ${projectId} not ready`);
}

async function waitForSession(sessionId: string, expected = 'completed', attempts = 180) {
  for (let index = 0; index < attempts; index += 1) {
    const { status, body } = await fetchJson(`/api/session/${sessionId}`);
    if (status === 200 && body?.data?.status === expected) {
      return body.data;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  throw new Error(`session ${sessionId} did not reach ${expected}`);
}

async function waitForNodeMove(nodeId: string, previousX: number, previousY: number, attempts = 60) {
  for (let index = 0; index < attempts; index += 1) {
    const { status, body } = await fetchJson(`/api/nodes/${nodeId}`);
    if (status === 200) {
      const moved = body.x !== previousX || body.y !== previousY;
      if (moved) {
        return body;
      }
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`node ${nodeId} position did not change`);
}

test.beforeAll(async () => {
  env = await createCanvasTestEnvironment({ workdirPrefix: 'trix-canvas-e2e-' });
  canvasBase = env.canvasUrl;
});

test.afterAll(async () => {
  if (env) {
    await env.shutdown();
  }
});

test('canvas primary workflow: create -> generate -> drag -> refresh still persisted', async ({ page }) => {
  await page.goto(`${canvasBase}/canvas`, { waitUntil: 'networkidle' });

  await page.click('#btn-new-project');
  await expect
    .poll(() => projectIdFromUrl(page.url()), { timeout: 10_000 })
    .not.toBe('');
  const projectId = projectIdFromUrl(page.url());

  await page.click('#leftPanelToggleButton');
  await expect(page.locator('#generateButton')).toBeVisible({ timeout: 10_000 });
  await page.fill('#promptInput', 'A magical forest with glowing mushrooms');
  await page.selectOption('#mediaTypeSelect', 'image');
  await page.selectOption('#aspect-select', '1:1');
  await page.click('#generateButton');

  await expect(page.locator('.node-item')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('#sessionCount')).not.toHaveText('0', { timeout: 15_000 });

  const projectSnapshot = await waitForProject(projectId);
  expect(projectSnapshot.sessions.length).toBeGreaterThan(0);
  const sessionId = projectSnapshot.sessions[0].id;
  const nodeId = projectSnapshot.nodes[0].id;
  const originX = projectSnapshot.nodes[0].x;
  const originY = projectSnapshot.nodes[0].y;

  const session = await waitForSession(sessionId, 'completed');
  expect(session.resultUrls.length).toBeGreaterThan(0);

  await page.click('#leftPanelToggleButton');
  const startPoint = await page.evaluate(({ nodeX, nodeY }) => {
    const debugApi = (window as typeof window & {
      __TRIX_CANVAS_DEBUG__?: {
        getMetrics: () => {
          nodeWidth: number;
          headerHeight: number;
          previewHeight: number;
        };
        worldToClient: (worldX: number, worldY: number) => { x: number; y: number };
      };
    }).__TRIX_CANVAS_DEBUG__;
    if (!debugApi) {
      throw new Error('canvas debug api unavailable');
    }
    const metrics = debugApi.getMetrics();
    return debugApi.worldToClient(
      nodeX + metrics.nodeWidth / 2,
      nodeY + metrics.headerHeight + metrics.previewHeight / 2,
    );
  }, { nodeX: originX, nodeY: originY });
  const startX = startPoint.x;
  const startY = startPoint.y;
  const endX = startX + 140;
  const endY = startY + 100;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();

  const movedNode = await waitForNodeMove(nodeId, originX, originY);
  expect(movedNode.x).not.toBe(originX);
  expect(movedNode.y).not.toBe(originY);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#projectName')).not.toHaveText('未载入项目');
  expect(projectIdFromUrl(page.url())).toBe(projectId);

  const { status: nodeStatus, body: nodeAfterReload } = await fetchJson(`/api/nodes/${nodeId}`);
  expect(nodeStatus).toBe(200);
  expect(nodeAfterReload.x).toBe(movedNode.x);
  expect(nodeAfterReload.y).toBe(movedNode.y);
});

test('canvas upload workflow: create reference node and attach asset', async ({ page }) => {
  await page.goto(`${canvasBase}/canvas`, { waitUntil: 'networkidle' });

  await page.click('#btn-new-project');
  await expect
    .poll(() => projectIdFromUrl(page.url()), { timeout: 10_000 })
    .not.toBe('');
  const projectId = projectIdFromUrl(page.url());

  await page.click('#leftPanelToggleButton');
  await expect(page.locator('#createRefButton')).toBeVisible({ timeout: 10_000 });
  await page.click('#createRefButton');
  await expect(page.locator('.node-item').first()).toBeVisible({ timeout: 10_000 });
  const projectAfterRefNode = await waitForProject(projectId);
  expect(projectAfterRefNode.nodes.length).toBeGreaterThan(0);

  await page.locator('#referenceUploadInput').setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: FIXTURE_IMAGE_BUFFER,
  });

  await expect(page.locator('#fileCount')).not.toHaveText('0', { timeout: 10_000 });

  const project = await waitForProject(projectId);
  expect(project.files.length).toBeGreaterThan(0);
  expect(project.nodes.some((node: { file_id?: string | null }) => Boolean(node.file_id))).toBeTruthy();
});
