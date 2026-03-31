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
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  // Wait a frame
  await page.waitForTimeout(100);
}

async function gotoPublicPage(page: import('@playwright/test').Page, path: string) {
  await waitForI18n(page);
  await page.goto(path);
  await stabilizePage(page);
}

async function gotoProtectedPage(page: import('@playwright/test').Page, path: string) {
  await waitForI18n(page);
  await mockSession(page);
  await page.goto(path);
  await stabilizePage(page);
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
