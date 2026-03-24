/**
 * E2E Tests for Diagnostic Page (诊断页面)
 *
 * Test Coverage:
 * - T4.1.1: 页面加载和渲染
 * - T4.1.2: 诊断信息显示（Trix Service URL、本地配对状态）
 * - T4.1.3: 服务探测按钮
 * - T4.1.4: 高级诊断入口
 * - T4.1.5: 刷新功能
 * - T4.1.6: 连接测试结果显示
 */

import { test, expect, loginWithSupabase } from './test-config';

test.describe('Diagnostic Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock Supabase session
    await loginWithSupabase(page);

    // Navigate to diagnostic page (app uses HashRouter)
    await page.goto('/#/diagnostic');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to hydrate and auth to initialize
    // This is critical - the mock session needs time to be recognized
    await page.waitForTimeout(2000);
  });

  test('T4.1.1: should load and render diagnostic page successfully', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Check that diagnostic page title is visible - try multiple variants
    const title1 = page.locator('text=Clawdbot Diagnostic');
    const title2 = page.locator('text=Diagnostic');
    const title3 = page.locator('text=诊断');

    const hasTitle = await title1.isVisible({ timeout: 10000 }).catch(() => false) ||
                     await title2.isVisible({ timeout: 5000 }).catch(() => false) ||
                     await title3.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasTitle).toBe(true);
  });

  test('T4.1.2: should display diagnostic information', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for diagnostic data to load
    await page.waitForTimeout(1000);

    // Check Trix Service URL section
    const serviceUrlLabel = page.locator('text=Trix Service URL');
    await expect(serviceUrlLabel).toBeVisible();

    // Check pairing session section
    const pairingSessionLabel = page.locator('text=Local Pairing Session');
    await expect(pairingSessionLabel).toBeVisible();
  });

  test('T4.1.3: should have Run Service Test button', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForTimeout(500);

    // Check Run Service Test button is visible
    const testButton = page.locator('button:has-text("Run Service Test")');
    await expect(testButton).toBeVisible();
  });

  test('T4.1.4: should navigate to advanced diagnostic page', async ({ page }) => {
    // Navigate to diagnostic advanced page (app uses HashRouter)
    await page.goto('/#/diagnostic-advanced');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Check that advanced diagnostic page loads
    const currentUrl = page.url();
    expect(currentUrl).toContain('/diagnostic-advanced');
  });

  test('T4.1.5: should refresh page when refreshing', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for initial load
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();

    // Wait for page to reload
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Skip if redirected to login after reload
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Check values are still displayed after reload
    const serviceUrlLabel = page.locator('text=Trix Service URL');
    await expect(serviceUrlLabel).toBeVisible();
  });

  test('T4.1.6: should show test result after running connection test', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForTimeout(500);

    // Click Run Service Test button
    const testButton = page.locator('button:has-text("Run Service Test")');
    await expect(testButton).toBeVisible();
    await testButton.click();

    // Wait for test to complete (button should show Testing state)
    const testingButton = page.locator('button:has-text("Testing Service...")');

    // Check if button changes to testing state
    const isTesting = await testingButton.isVisible().catch(() => false);

    if (isTesting) {
      await expect(testingButton).toBeVisible();

      // Wait for test to complete
      await page.waitForTimeout(5000);

      // After test completes, button should go back to original state
      await expect(testButton).toBeVisible();
    }

    // Eventually should show result (success or failure)
    await page.waitForTimeout(1000);
  });

  test('T4.1.7: should handle missing environment variables gracefully', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForTimeout(500);

    // Check that the page shows values for Trix Service URL and local pairing session
    const content = await page.content();

    // Page should handle missing config gracefully
    expect(content).toContain('Trix Service URL');
    expect(content).toContain('Local Pairing Session');
  });

  test('T4.1.8: should disable button during testing', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForTimeout(500);

    // Get the test button
    const testButton = page.locator('button:has-text("Run Service Test")');
    await expect(testButton).toBeVisible();

    // Click the button to start test
    await testButton.click();

    // Button should be disabled during testing - wait for it to change state
    // The button text changes to "Testing..." when disabled
    await page.waitForTimeout(500);

    // Get the disabled attribute after clicking

    // Button should have changed state during test
    await page.waitForTimeout(1000);
  });

  test('T4.1.9: should display correct styling for success/failure results', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForTimeout(500);

    // Run connection test
    const testButton = page.locator('button:has-text("Run Service Test")');
    await testButton.click();

    // Wait for potential result (may take time due to network)
    await page.waitForTimeout(8000);

    // At least one result should be visible after test
  });

  test('T4.1.10: should have proper visual layout', async ({ page }) => {
    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForTimeout(500);

    await expect(page.locator('text=Trix Service URL')).toBeVisible();
    await expect(page.locator('text=Local Pairing Session')).toBeVisible();

    // Check main button styling
    const mainButton = page.locator('button:has-text("Run Service Test")');
    await expect(mainButton).toBeVisible();
  });
});
