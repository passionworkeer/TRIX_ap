/**
 * Visual Regression Tests using Playwright screenshots
 *
 * Compares page screenshots against baseline snapshots.
 * Run with: npm run test:visual
 * Update baselines: npm run test:visual:update
 *
 * Tests cover:
 * 1. Login page
 * 2. Home page
 * 3. Chat page
 * 4. Study page
 * 5. Map page
 * 6. Profile page
 * 7. Pairing page
 * 8. Responsive layouts (mobile, tablet, desktop)
 */
import { test, expect, mockSession, waitForI18n } from './test-config';

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

// Helper: stabilize dynamic content before screenshot
async function stabilizePage(page: import('@playwright/test').Page) {
  // Wait for network idle
  await page.waitForLoadState('networkidle');
  // Disable animations
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; }
      [data-hero-background] { background: #1a1a1a !important; }
      [data-hero-background] video,
      [data-hero-background] canvas {
        opacity: 0 !important;
        visibility: hidden !important;
      }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll('video').forEach((video) => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Some browsers reject seeking before metadata is ready; hiding the
        // element above still keeps the screenshot deterministic.
      }
    });
  });
  // Wait a frame
  await page.waitForTimeout(100);
}

async function prepareVisualPage(page: import('@playwright/test').Page) {
  await waitForI18n(page);
  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, 'BarcodeDetector', {
        configurable: true,
        value: undefined,
      });
    } catch {
      try {
        (window as Window & { BarcodeDetector?: unknown }).BarcodeDetector = undefined;
      } catch {
        // Ignore if the browser blocks patching the API.
      }
    }
  });
}

async function waitForPageReady(page: import('@playwright/test').Page, path: string) {
  if (path === '/#/login') {
    await expect(page.locator('#email-input')).toBeVisible({ timeout: 15000 });
  } else if (path === '/') {
    await expect(page.getByTestId('home-bot-collapsed-trigger')).toBeVisible({ timeout: 15000 });
  } else if (path === '/#/chat') {
    await expect(page.getByRole('heading', { name: '聊天' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'TRIX Bot', exact: true })).toBeVisible({ timeout: 15000 });
  } else if (path === '/#/study') {
    await expect(page.getByRole('heading', { name: '自习室' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /开始专注/ })).toBeVisible({ timeout: 15000 });
  } else if (path === '/#/map') {
    await expect(page.locator('input[placeholder^="搜索地点"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Virtual World')).toBeVisible({ timeout: 15000 });
  } else if (path === '/#/profile') {
    await expect(page.getByRole('heading', { name: '个人中心' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('TestUser')).toBeVisible({ timeout: 15000 });
    await page.waitForFunction(() => {
      const images = Array.from(document.querySelectorAll<HTMLImageElement>('img'));
      return images.length >= 3 && images.every((image) => image.complete && image.naturalWidth > 0);
    }, undefined, { timeout: 15000 });
  } else if (path === '/#/pairing') {
    await expect(page.getByRole('heading', { name: '配对 TRIX Native' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('请输入 TRIX Native 上的 6 位配对码')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(4500);
  }

  await expect(page.getByText('页面加载中...')).toHaveCount(0);
  await expect(page.getByText('加载中...')).toHaveCount(0);
  await expect(page.getByText('出错了')).toHaveCount(0);
}

async function gotoPublicPage(page: import('@playwright/test').Page, path: string) {
  await prepareVisualPage(page);
  await page.goto(path);
  await stabilizePage(page);
  await waitForPageReady(page, path);
}

async function gotoProtectedPage(page: import('@playwright/test').Page, path: string) {
  await prepareVisualPage(page);
  await mockSession(page);
  await page.goto(path);
  await stabilizePage(page);
  await waitForPageReady(page, path);
}

test.describe('Visual Regression - Login', () => {
  test('login page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoPublicPage(page, '/#/login');
    await expect(page).toHaveScreenshot('login-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - Home', () => {
  test('home page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoProtectedPage(page, '/');
    await expect(page).toHaveScreenshot('home-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('home page matches baseline @tablet', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await gotoProtectedPage(page, '/');
    await expect(page).toHaveScreenshot('home-tablet.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - Chat', () => {
  test('chat page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoProtectedPage(page, '/#/chat');
    await expect(page).toHaveScreenshot('chat-mobile.png', {
      maxDiffPixelRatio: 0.02, // Allow 2% diff for dynamic content
    });
  });
});

test.describe('Visual Regression - Study', () => {
  test('study page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoProtectedPage(page, '/#/study');
    await expect(page).toHaveScreenshot('study-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - Map', () => {
  test('map page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoProtectedPage(page, '/#/map');
    await expect(page).toHaveScreenshot('map-mobile.png', {
      maxDiffPixelRatio: 0.03, // Map content varies
    });
  });
});

test.describe('Visual Regression - Profile', () => {
  test('profile page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoProtectedPage(page, '/#/profile');
    await expect(page).toHaveScreenshot('profile-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - Pairing', () => {
  test('pairing page matches baseline @mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await gotoProtectedPage(page, '/#/pairing');
    await expect(page).toHaveScreenshot('pairing-mobile.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});

test.describe('Visual Regression - Responsive', () => {
  test('home responsive @desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await gotoProtectedPage(page, '/');
    await expect(page).toHaveScreenshot('home-desktop.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
