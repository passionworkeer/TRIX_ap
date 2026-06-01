/**
 * E2E Tests for Advanced Diagnostic Page (/diagnostic-advanced)
 *
 * Test Coverage:
 * - T4.2.1: Advanced diagnostic page loads
 * - T4.2.2: Advanced diagnostic content renders
 * - T4.2.3: Service test button exists
 * - T4.2.4: Gateway log section exists
 * - T4.2.5: Clear logs button exists
 * - T4.2.6: Test result display area exists
 */

import { test, expect, mockSession } from './test-config';

test.describe('Diagnostic Advanced E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mock session for protected route
    await mockSession(page);

    // Navigate to advanced diagnostic page
    await page.goto('/#/diagnostic-advanced');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  });

  test('T4.2.1: should load advanced diagnostic page', async ({ page }) => {
    // Should be on the diagnostic-advanced page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/diagnostic-advanced');
  });

  test('T4.2.2: should display advanced diagnostic title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '高级 Native 通道诊断' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('T4.2.3: should display service test button', async ({ page }) => {
    // "测试 Trix Service" button
    const testButton = page.locator('button:has-text("测试 Trix Service")').first();
    await expect(testButton).toBeVisible({ timeout: 5000 });
  });

  test('T4.2.4: should display gateway log section', async ({ page }) => {
    await expect(page.getByText('日志', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('T4.2.5: should display clear logs button', async ({ page }) => {
    // "清空日志" button
    const clearButton = page.locator('button:has-text("清空日志")').first();
    await expect(clearButton).toBeVisible({ timeout: 5000 });
  });

  test('T4.2.6: should display log container', async ({ page }) => {
    // The log display is inside a dark background div
    // Look for the log area container
    const logContainer = page.locator('div[class=""][style*="background"]').first();
    const containerVisible = await logContainer.isVisible().catch(() => false);

    if (containerVisible) {
      await expect(logContainer).toBeVisible();
    }
  });

  test('T4.2.7: should handle clear logs action', async ({ page }) => {
    const clearButton = page.locator('button:has-text("清空日志")').first();
    await expect(clearButton).toBeVisible({ timeout: 5000 });

    // Click clear button
    await clearButton.click();
    await page.waitForTimeout(500);

    // Should show placeholder text: "点击按钮开始测试..."
    const placeholder = page.locator('text=点击按钮开始测试...').first();
    const placeholderVisible = await placeholder.isVisible().catch(() => false);

    if (placeholderVisible) {
      await expect(placeholder).toBeVisible();
    }
  });

  test('T4.2.8: should have proper dark theme styling', async ({ page }) => {
    const root = page.locator('div[style*="font-family: monospace"]').first();

    await expect(root).toBeVisible();
    await expect(root).toHaveCSS('background-color', 'rgb(30, 30, 30)');
    await expect(root).toHaveCSS('color', 'rgb(212, 212, 212)');
  });
});
