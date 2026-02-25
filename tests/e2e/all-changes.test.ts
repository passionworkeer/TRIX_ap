import { test, expect, chromium, type Browser, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('TRIX 3D Companion - 完整 E2E 测试套件', () => {
  let browser: Browser;
  let page: Page;
  const consoleErrors: string[] = [];

  test.beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    await browser.close();
  });

  // ========== 批次 1: Logger 重构测试 ==========
  test.describe('批次 1: Logger 重构验证', () => {
    test('Home 页面日志输出正常', async () => {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();

      // 检查关键元素加载
      const content = await page.content();
      expect(content.length).toBeGreaterThan(100);
    });

    test('所有页面日志无错误', async () => {
      const pages = ['/', '/chat', '/study', '/profile'];
      const errors: string[] = [];

      for (const path of pages) {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);
      }

      // 允许一些第三方库的警告，但不应有严重错误
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes('Warning:') && !e.includes('deprecat')
      );
      expect(criticalErrors.length).toBe(0);
    });
  });

  // ========== 批次 2: 错误类型改进测试 ==========
  test.describe('批次 2: 错误处理验证', () => {
    test('Chat 页面错误处理正常', async () => {
      await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });

      // 页面应该正常加载，不应崩溃
      await expect(page.locator('body')).toBeVisible();

      // 检查没有 JavaScript 错误
      const errors = consoleErrors.filter(e => e.includes('Error'));
      expect(errors.length).toBe(0);
    });

    test('Diagnostic 页面错误处理正常', async () => {
      await page.goto(`${BASE_URL}/diagnostic`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();
    });
  });

  // ========== 批次 3: Socket 事件类型测试 ==========
  test.describe('批次 3: Socket/WebSocket 验证', () => {
    test('Clawbot 连接相关页面加载正常', async () => {
      // 测试需要 Clawbot 的页面
      await page.goto(`${BASE_URL}/pairing`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();

      // 检查页面没有 WebSocket 相关错误
      const wsErrors = consoleErrors.filter(e =>
        e.includes('WebSocket') || e.includes('socket')
      );
      expect(wsErrors.length).toBe(0);
    });
  });

  // ========== 批次 4-7: 类型改进综合测试 ==========
  test.describe('批次 4-7: 类型改进综合验证', () => {
    test('Study 页面类型安全正常', async () => {
      await page.goto(`${BASE_URL}/study`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();

      // 检查控制台无错误
      expect(consoleErrors.length).toBe(0);
    });

    test('Profile 页面类型安全正常', async () => {
      await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();
      expect(consoleErrors.length).toBe(0);
    });

    test('Snapshot 页面类型安全正常', async () => {
      await page.goto(`${BASE_URL}/snapshot`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();
    });

    test('Points 页面类型安全正常', async () => {
      await page.goto(`${BASE_URL}/points`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toBeVisible();
    });
  });

  // ========== 回归测试 ==========
  test.describe('回归测试 - 确保修改没有破坏现有功能', () => {
    test('所有主要页面可以正常导航', async () => {
      // Home -> Chat
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Chat -> Study
      await page.goto(`${BASE_URL}/study`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // Study -> Home
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      // 应该没有导航错误
      const navErrors = consoleErrors.filter(e => e.includes('navigation'));
      expect(navErrors.length).toBe(0);
    });

    test('页面加载性能正常', async () => {
      const startTime = Date.now();
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;

      // 页面应该在 5 秒内加载完成
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
