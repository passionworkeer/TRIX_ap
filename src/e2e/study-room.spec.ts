/**
 * E2E Tests for Study Room Flow
 *
 * Test Coverage:
 * - T3.1.1: Enter study room
 * - T3.1.2: Create new study room
 * - T3.1.3: Join existing room
 * - T3.1.4: Start study session
 * - T3.1.5: Leave study room
 */

import { test, expect } from '@playwright/test';

test.describe('Study Room E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Mock Supabase auth session
    await page.evaluate(() => {
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

    await page.goto('/study');
  });

  test('T3.1.1: should enter study room page', async ({ page }) => {
    // Check page title
    await expect(page.locator('text=学习室')).toBeVisible();

    // Check entry modes are visible
    await expect(page.locator('text=自己自习')).toBeVisible();
    await expect(page.locator('text=加入好友')).toBeVisible();
    await expect(page.locator('text=房间号加入')).toBeVisible();
  });

  test('T3.1.2: should create new study room', async ({ page }) => {
    // Click on "房间号加入" to see create option
    await page.click('text=房间号加入');

    // Click create button
    await page.click('text=创建');

    // Should show room code
    await expect(page.locator('[data-testid="room-code"]')).toBeVisible({ timeout: 5000 });

    // Should show room controls
    await expect(page.locator('text=开始')).toBeVisible();
  });

  test('T3.1.3: should join existing room with code', async ({ page }) => {
    // Click on "房间号加入"
    await page.click('text=房间号加入');

    // Enter room code
    await page.fill('input[type="text"]', 'ABC123');

    // Click join button
    await page.click('text=加入');

    // Should join the room (may show room view)
    await page.waitForTimeout(1000);
  });

  test('T3.1.4: should start study session', async ({ page }) => {
    // Create or join a room first
    await page.click('text=房间号加入');
    await page.click('text=创建');

    // Wait for room to be created
    await expect(page.locator('text=开始')).toBeVisible({ timeout: 5000 });

    // Click start button
    await page.click('text=开始');

    // Should show timer or session active
    await expect(page.locator('text=进行中')).toBeVisible({ timeout: 5000 });
  });

  test('T3.1.5: should leave study room', async ({ page }) => {
    // Create a room first
    await page.click('text=房间号加入');
    await page.click('text=创建');

    await expect(page.locator('text=开始')).toBeVisible({ timeout: 5000 });

    // Click leave button
    await page.click('text=离开');

    // Should return to study room entry
    await expect(page.locator('text=自己自习')).toBeVisible();
  });

  test('T3.1.6: should show member list in room', async ({ page }) => {
    // Create a room
    await page.click('text=房间号加入');
    await page.click('text=创建');

    await expect(page.locator('text=开始')).toBeVisible({ timeout: 5000 });

    // Should show members
    await expect(page.locator('[data-testid="member-list"]')).toBeVisible();
  });

  test('T3.1.7: should pause and resume study session', async ({ page }) => {
    // Create a room and start session
    await page.click('text=房间号加入');
    await page.click('text=创建');

    await expect(page.locator('text=开始')).toBeVisible({ timeout: 5000 });

    // Start session
    await page.click('text=开始');
    await expect(page.locator('text=进行中')).toBeVisible({ timeout: 5000 });

    // Pause session
    await page.click('text=暂停');

    // Should show paused state
    await expect(page.locator('text=已暂停')).toBeVisible({ timeout: 5000 });

    // Resume session
    await page.click('text=开始');

    // Should show active again
    await expect(page.locator('text=进行中')).toBeVisible({ timeout: 5000 });
  });
});
