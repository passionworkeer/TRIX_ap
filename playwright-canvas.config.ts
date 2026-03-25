import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E Config — TRIX Canvas Service
 *
 * Tests the Python FastAPI Canvas backend (port 8789):
 * - API endpoints: health, projects CRUD, nodes, edges, upload, export
 * - Web UI: LiteGraph canvas, toolbar, project management
 *
 * Prerequisites:
 *   cd skills/trix-canvas-skill/canvas
 *   pip install -r requirements.txt  (fastapi, uvicorn, python-multipart)
 *
 * Usage:
 *   npx playwright test canvas.spec.ts --config playwright-canvas.config.ts
 */

const CANVAS_PORT = 8789;
const CANVAS_BASE = `http://127.0.0.1:${CANVAS_PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'canvas.spec.ts',
  timeout: 60_000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: CANVAS_BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
  },
  webServer: {
    // 启动 Python FastAPI Canvas 服务
    command: 'D:/python/python.exe skills/trix-canvas-skill/canvas/canvas_server.py',
    url: `${CANVAS_BASE}/health`,
    reuseExistingServer: true,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { channel: 'chromium' },
    },
  ],
});

export { CANVAS_BASE, CANVAS_PORT };
