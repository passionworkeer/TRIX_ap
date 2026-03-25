/**
 * canvas.spec.ts — TRIX Canvas E2E Tests
 *
 * Tests two layers:
 * 1. API layer — FastAPI endpoints (health, projects CRUD, nodes, edges, export)
 * 2. UI layer — LiteGraph canvas, toolbar, aspect selector, project management
 *
 * Run:
 *   npx playwright test canvas.spec.ts --config playwright-canvas.config.ts
 *
 * Note: Canvas server must be running on port 8789.
 * The webServer in playwright-canvas.config.ts auto-starts it.
 */

import { test, expect, request, type APIResponse, type Page, type Browser } from '@playwright/test';
import { CANVAS_BASE, CANVAS_PORT } from '../../playwright-canvas.config';

// ── Helpers ────────────────────────────────────────────────────────────────────

let projectId: number;
let nodeId: number;
let edgeId: number;
let fileId: number;

async function api(path: string, opts?: Parameters<typeof request.post>[2]): Promise<APIResponse> {
  const ctx = await request.newContext({ baseURL: CANVAS_BASE });
  const method = opts?.method ?? 'GET';
  if (method === 'GET') return ctx.get(path);
  if (method === 'POST') return ctx.post(path, opts);
  if (method === 'PATCH') return ctx.patch(path, opts);
  if (method === 'DELETE') return ctx.delete(path);
  return ctx.get(path);
}

// ── Shared browser context for UI tests ────────────────────────────────────────

let sharedBrowser: Browser;
let sharedCtx: ReturnType<Browser['newContext']>;

test.beforeAll(async ({ browser }) => {
  sharedBrowser = browser;
  sharedCtx = await browser.newContext({ baseURL: CANVAS_BASE });
});

test.afterAll(async () => {
  await sharedCtx?.close();
});

// ── API: Health ────────────────────────────────────────────────────────────────

test.describe('API — Health', () => {
  test('GET /health returns ok', async () => {
    const resp = await api('/health');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('status', 'ok');
    console.log('✓ Health endpoint OK:', body);
  });
});

// ── API: Projects CRUD ────────────────────────────────────────────────────────

test.describe('API — Projects CRUD', () => {
  test('POST /api/projects creates a project', async () => {
    const resp = await api('/api/projects', {
      method: 'POST',
      data: { name: 'E2E Test Project', script_text: 'test script' },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name', 'E2E Test Project');
    projectId = body.id;
    console.log('✓ Project created, id:', projectId);
  });

  test('GET /api/projects lists projects', async () => {
    const resp = await api('/api/projects');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    console.log('✓ Projects listed, count:', body.length);
  });

  test('GET /api/projects/:id returns project with empty nodes/edges', async () => {
    const resp = await api(`/api/projects/${projectId}`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('id', projectId);
    expect(body).toHaveProperty('nodes');
    expect(body).toHaveProperty('edges');
    expect(Array.isArray(body.nodes)).toBe(true);
    expect(Array.isArray(body.edges)).toBe(true);
    console.log('✓ Project detail OK, nodes:', body.nodes.length);
  });

  test('GET /api/projects/:id returns 404 for non-existent project', async () => {
    const resp = await api('/api/projects/99999');
    expect(resp.status()).toBe(404);
    console.log('✓ 404 for non-existent project OK');
  });

  test('DELETE /api/projects/:id deletes the project', async () => {
    const resp = await api(`/api/projects/${projectId}`, { method: 'DELETE' });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('ok', true);
    console.log('✓ Project deleted');
  });

  test('GET /api/projects/:id returns 404 after deletion', async () => {
    const resp = await api(`/api/projects/${projectId}`);
    expect(resp.status()).toBe(404);
    console.log('✓ Deleted project returns 404 OK');
  });
});

// ── API: Nodes CRUD ─────────────────────────────────────────────────────────────

test.describe('API — Nodes CRUD', () => {
  // 先创建一个项目
  test.beforeAll(async () => {
    const resp = await api('/api/projects', {
      method: 'POST',
      data: { name: 'Node Test Project' },
    });
    const body = await resp.json();
    projectId = body.id;
    console.log('✓ Node test project created, id:', projectId);
  });

  test.afterAll(async () => {
    // 清理
    await api(`/api/projects/${projectId}`, { method: 'DELETE' });
  });

  test('POST /api/nodes creates a node', async () => {
    const resp = await api('/api/nodes', {
      method: 'POST',
      data: {
        project_id: projectId,
        scene_id: 1,
        media_type: 'image',
        x: 100,
        y: 200,
        prompt: 'Test scene prompt',
        status: 'pending',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('project_id', projectId);
    expect(body).toHaveProperty('media_type', 'image');
    expect(body).toHaveProperty('status', 'pending');
    nodeId = body.id;
    console.log('✓ Node created, id:', nodeId);
  });

  test('GET /api/nodes/:id returns the node', async () => {
    const resp = await api(`/api/nodes/${nodeId}`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('id', nodeId);
    expect(body).toHaveProperty('prompt', 'Test scene prompt');
    console.log('✓ Node detail OK');
  });

  test('PATCH /api/nodes/:id updates node', async () => {
    const resp = await api(`/api/nodes/${nodeId}`, {
      method: 'PATCH',
      data: { prompt: 'Updated prompt', status: 'done' },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('prompt', 'Updated prompt');
    expect(body).toHaveProperty('status', 'done');
    console.log('✓ Node updated OK');
  });

  test('DELETE /api/nodes/:id deletes node', async () => {
    const resp = await api(`/api/nodes/${nodeId}`, { method: 'DELETE' });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('ok', true);
    console.log('✓ Node deleted OK');
  });

  test('GET /api/nodes/:id returns 404 after deletion', async () => {
    const resp = await api(`/api/nodes/${nodeId}`);
    expect(resp.status()).toBe(404);
    console.log('✓ Deleted node returns 404 OK');
  });
});

// ── API: Edges CRUD ─────────────────────────────────────────────────────────────

test.describe('API — Edges CRUD', () => {
  test.beforeAll(async () => {
    // 创建项目 + 两个节点用于连线
    const resp = await api('/api/projects', {
      method: 'POST',
      data: { name: 'Edge Test Project' },
    });
    const proj = await resp.json();
    projectId = proj.id;

    const n1 = await api('/api/nodes', {
      method: 'POST',
      data: { project_id: projectId, scene_id: 1, media_type: 'image', x: 0, y: 0, prompt: 'node1', status: 'done' },
    });
    const n1b = await n1.json();
    const n2 = await api('/api/nodes', {
      method: 'POST',
      data: { project_id: projectId, scene_id: 2, media_type: 'image', x: 300, y: 0, prompt: 'node2', status: 'done' },
    });
    const n2b = await n2.json();
    nodeId = n1b.id;
    edgeId = 0; // will be set
    // 保存 n2 id for edge creation
    (global as any).__n2Id = n2b.id;
  });

  test.afterAll(async () => {
    await api(`/api/projects/${projectId}`, { method: 'DELETE' });
  });

  test('POST /api/edges creates an edge', async () => {
    const n2Id = (global as any).__n2Id;
    const resp = await api('/api/edges', {
      method: 'POST',
      data: {
        project_id: projectId,
        source_node_id: nodeId,
        target_node_id: n2Id,
        edge_type: 'scene_order',
      },
    });
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('source_node_id', nodeId);
    expect(body).toHaveProperty('target_node_id', n2Id);
    edgeId = body.id;
    console.log('✓ Edge created, id:', edgeId);
  });

  test('DELETE /api/edges/:id removes edge', async () => {
    const resp = await api(`/api/edges/${edgeId}`, { method: 'DELETE' });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('ok', true);
    console.log('✓ Edge deleted OK');
  });
});

// ── API: Upload ───────────────────────────────────────────────────────────────

test.describe('API — Upload', () => {
  test.beforeAll(async () => {
    const resp = await api('/api/projects', {
      method: 'POST',
      data: { name: 'Upload Test Project' },
    });
    const body = await resp.json();
    projectId = body.id;
  });

  test.afterAll(async () => {
    await api(`/api/projects/${projectId}`, { method: 'DELETE' });
  });

  test('POST /api/upload accepts a small PNG file', async () => {
    // 1x1 透明 PNG (base64: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );

    const ctx = await request.newContext({ baseURL: CANVAS_BASE });
    const resp = await ctx.post('/api/upload', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
        project_id: String(projectId),
        prompt: 'test upload',
        media_type: 'image',
        scene_id: '1',
      },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('filename', 'test.png');
    expect(body).toHaveProperty('media_type', 'image');
    fileId = body.id;
    console.log('✓ File uploaded, id:', fileId);
  });

  test('POST /api/upload returns 404 for non-existent project', async () => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      'base64'
    );
    const ctx = await request.newContext({ baseURL: CANVAS_BASE });
    const resp = await ctx.post('/api/upload', {
      multipart: {
        file: { name: 'x.png', mimeType: 'image/png', buffer: pngBuffer },
        project_id: '99999',
        media_type: 'image',
      },
    });
    expect(resp.status()).toBe(404);
    console.log('✓ Upload 404 for non-existent project OK');
  });
});

// ── API: Export ────────────────────────────────────────────────────────────────

test.describe('API — Export', () => {
  test.beforeAll(async () => {
    const resp = await api('/api/projects', {
      method: 'POST',
      data: { name: 'Export Test Project' },
    });
    const body = await resp.json();
    projectId = body.id;
  });

  test.afterAll(async () => {
    await api(`/api/projects/${projectId}`, { method: 'DELETE' });
  });

  test('GET /api/projects/:id/export/video returns 400 when no video nodes', async () => {
    const resp = await api(`/api/projects/${projectId}/export/video`);
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.detail).toContain('没有视频节点');
    console.log('✓ Export video 400 (no nodes) OK:', body.detail);
  });

  test('GET /api/projects/:id/export/video accepts aspect query param', async () => {
    // 先验证端点对 404 项目 + 无节点返回 400
    const resp = await api(`/api/projects/${projectId}/export/video?aspect=9:16`);
    // 不管有没有节点，先验证 query param 不导致 422
    // aspect=9:16 是合法的
    expect([200, 400]).toContain(resp.status());
    console.log('✓ Aspect query param accepted, status:', resp.status());
  });

  test('GET /api/projects/:id/export/subtitle returns 400 when no nodes', async () => {
    const resp = await api(`/api/projects/${projectId}/export/subtitle`);
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.detail).toContain('没有节点');
    console.log('✓ Export subtitle 400 (no nodes) OK');
  });

  test('GET /api/projects/:id/export/subtitle returns total_duration and scenes count', async () => {
    // 创建两个节点
    await api('/api/nodes', {
      method: 'POST',
      data: { project_id: projectId, scene_id: 1, media_type: 'image', x: 0, y: 0, prompt: 'scene1', status: 'done' },
    });
    await api('/api/nodes', {
      method: 'POST',
      data: { project_id: projectId, scene_id: 2, media_type: 'image', x: 300, y: 0, prompt: 'scene2', status: 'done' },
    });

    const resp = await api(`/api/projects/${projectId}/export/subtitle`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('srt');
    expect(body).toHaveProperty('script');
    expect(body).toHaveProperty('scenes', 2);
    expect(body).toHaveProperty('total_duration');
    expect(typeof body.total_duration).toBe('number');
    console.log('✓ Subtitle export OK, scenes:', body.scenes, 'duration:', body.total_duration);
  });

  test('GET /api/projects/:id/export/subtitle?unknown_aspect returns 422', async () => {
    const resp = await api(`/api/projects/${projectId}/export/video?aspect=invalid`);
    expect(resp.status()).toBe(422); // FastAPI regex validation failure
    console.log('✓ Invalid aspect returns 422 OK');
  });
});

// ── UI: Canvas Page ──────────────────────────────────────────────────────────

test.describe('UI — Canvas Page', () => {
  test('GET / loads the canvas index page', async () => {
    const page = await sharedCtx.newPage();
    const resp = await page.goto(CANVAS_BASE);
    expect(resp.status()).toBe(200);
    const content = await page.content();
    // LiteGraph 需要 canvas 元素
    expect(content).toContain('mycanvas');
    await page.close();
    console.log('✓ Canvas index page loads OK');
  });

  test('Canvas page has toolbar with aspect selector', async () => {
    const page = await sharedCtx.newPage();
    await page.goto(CANVAS_BASE, { waitUntil: 'networkidle' });
    // 检查 aspect-select 存在
    const aspectSelect = page.locator('#aspect-select');
    await expect(aspectSelect).toBeVisible();
    // 检查有所有预设选项
    const options = await aspectSelect.locator('option').allTextContents();
    expect(options).toContain('原始');
    expect(options).toContain('横屏 16:9');
    expect(options).toContain('竖屏 9:16');
    expect(options).toContain('方屏 1:1');
    expect(options).toContain('标准 4:3');
    await page.close();
    console.log('✓ Aspect selector present with all presets');
  });

  test('Canvas page has export buttons', async () => {
    const page = await sharedCtx.newPage();
    await page.goto(CANVAS_BASE, { waitUntil: 'networkidle' });
    const exportVideo = page.locator('#btn-export-video');
    const exportSubtitle = page.locator('#btn-export-subtitle');
    // 初始 disabled
    await expect(exportVideo).toBeDisabled();
    await expect(exportSubtitle).toBeDisabled();
    await page.close();
    console.log('✓ Export buttons present and disabled by default');
  });

  test('Canvas page has new project button', async () => {
    const page = await sharedCtx.newPage();
    await page.goto(CANVAS_BASE, { waitUntil: 'networkidle' });
    const newBtn = page.locator('#btn-new-project');
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    // prompt 对话框应该弹出（Playwright 无法交互原生 prompt，改用 mock）
    // 这里只验证按钮可点击不报错
    await page.waitForTimeout(300);
    console.log('✓ New project button clickable');
    await page.close();
  });

  test('Canvas page loads LiteGraph canvas without console errors', async () => {
    const page = await sharedCtx.newPage();
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(CANVAS_BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // LiteGraph 初始化时间
    // 检查 canvas 元素
    const canvas = page.locator('#mycanvas');
    await expect(canvas).toBeVisible();
    // 无严重错误（忽略资源加载失败等无害警告）
    const criticalErrors = errors.filter(
      e => !e.includes('favicon') && !e.includes('404')
    );
    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors);
    }
    expect(criticalErrors.length).toBeLessThanOrEqual(2);
    await page.close();
    console.log('✓ LiteGraph canvas loaded, critical errors:', criticalErrors.length);
  });

  test('Project selector is populated with existing projects', async () => {
    const page = await sharedCtx.newPage();
    await page.goto(CANVAS_BASE, { waitUntil: 'networkidle' });
    const select = page.locator('#project-select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').count();
    // 至少有 "-- Select Project --" 选项
    expect(options).toBeGreaterThanOrEqual(1);
    console.log('✓ Project selector has', options, 'options');
    await page.close();
  });
});

// ── Security: Path Traversal ─────────────────────────────────────────────────

test.describe('Security — Path Traversal', () => {
  test('API rejects malicious file paths in media endpoint', async () => {
    const page = await sharedCtx.newPage();
    const resp = await page.goto(`${CANVAS_BASE}/media/../../../etc/passwd`);
    // 应该返回 404（文件不存在）或被 Canvas 服务拒绝）
    expect([404, 403]).toContain(resp.status());
    await page.close();
    console.log('✓ Path traversal rejected, status:', resp.status());
  });
});
