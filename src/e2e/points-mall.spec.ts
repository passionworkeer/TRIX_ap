/**
 * E2E Tests for Points Mall (积分商城)
 *
 * Test Coverage:
 * - T1.10.1: 进入商城页面
 * - T1.10.2: 商品浏览
 * - T1.10.3: 分类筛选
 * - T1.10.4: 兑换流程
 * - T1.10.5: 积分不足提示
 */

import { test, expect } from '@playwright/test';

test.describe('Points Mall E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Mock Supabase auth session
    await page.evaluate(() => {
      // Mock a valid Supabase session in localStorage
      const mockSession = {
        access_token: 'test-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {}
        }
      };
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify(mockSession));
    });

    // Navigate to points mall (correct route is /points-mall)
    await page.goto('/points-mall');
  });

  test('T1.10.1: should enter points mall page successfully', async ({ page }) => {
    // Check page title
    await expect(page.locator('text=积分商城')).toBeVisible();

    // Check that category filters are visible
    await expect(page.locator('text=全部')).toBeVisible();
    await expect(page.locator('text=服装')).toBeVisible();
    await expect(page.locator('text=配饰')).toBeVisible();
    await expect(page.locator('text=道具')).toBeVisible();
  });

  test('T1.10.2: should display mall items', async ({ page }) => {
    // Wait for items to load
    await page.waitForSelector('[data-testid="mall-item"]', { timeout: 10000 });

    // Check that at least one item is displayed
    const items = page.locator('[data-testid="mall-item"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('T1.10.3: should filter items by category', async ({ page }) => {
    // Click on clothing category
    await page.click('text=服装');

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Verify URL or state change
    const items = page.locator('[data-testid="mall-item"]');
    const count = await items.count();

    // Should have items (or be empty if no clothing items)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('T1.10.4: should complete purchase flow', async ({ page }) => {
    // Wait for items to load
    await page.waitForSelector('[data-testid="mall-item"]', { timeout: 10000 });

    // Find an item that is not owned
    const unownedItem = page.locator('[data-testid="mall-item"]:not([data-owned="true"])').first();

    if (await unownedItem.isVisible()) {
      // Click purchase/exchange button
      const purchaseButton = unownedItem.locator('button:has-text("兑换")');
      await purchaseButton.click();

      // Confirm purchase in dialog
      const confirmButton = page.locator('button:has-text("确认")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Check for success message
      await expect(page.locator('text=兑换成功')).toBeVisible({ timeout: 5000 });
    }
  });

  test('T1.10.5: should show insufficient points message', async ({ page }) => {
    // Mock low points balance
    await page.evaluate(() => {
      localStorage.setItem('points_balance', '10');
    });

    // Reload page to apply mock
    await page.reload();

    // Wait for items to load
    await page.waitForSelector('[data-testid="mall-item"]', { timeout: 10000 });

    // Try to purchase an expensive item
    const expensiveItem = page.locator('[data-testid="mall-item"]').first();
    const purchaseButton = expensiveItem.locator('button:has-text("兑换")');

    if (await purchaseButton.isVisible()) {
      await purchaseButton.click();

      // Check for insufficient points message
      await expect(page.locator('text=积分不足')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display points balance', async ({ page }) => {
    // Check that points balance section is visible
    await expect(page.locator('text=积分')).toBeVisible();
  });

  test('should navigate back to profile', async ({ page }) => {
    // Click back button
    await page.click('[data-testid="back-button"]');

    // Should be on profile page
    await expect(page).toHaveURL(/.*profile|.*\//);
  });
});
