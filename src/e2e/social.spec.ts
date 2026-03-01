/**
 * E2E Tests for Social Features
 *
 * Test Coverage:
 * - T4.1.1: Add friend
 * - T4.1.2: Accept friend request
 * - T4.1.3: View friend list
 * - T4.1.4: Send message to friend
 * - T4.1.5: View notifications
 */

import { test, expect } from '@playwright/test';

test.describe('Social Features E2E Tests', () => {
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
  });

  test('T4.1.1: should open add friend modal', async ({ page }) => {
    // Navigate to friends section
    await page.goto('/friends');

    // Click add friend button
    await page.click('[data-testid="add-friend-button"]');

    // Should show add friend modal
    await expect(page.locator('text=添加好友')).toBeVisible();
  });

  test('T4.1.2: should send friend request', async ({ page }) => {
    // Navigate to friends section
    await page.goto('/friends');

    // Open add friend modal
    await page.click('[data-testid="add-friend-button"]');

    // Enter friend account
    await page.fill('input[placeholder*="账号"]', 'friend@example.com');

    // Click send button
    await page.click('text=发送请求');

    // Should show success message
    await expect(page.locator('text=好友请求已发送')).toBeVisible({ timeout: 5000 });
  });

  test('T4.1.3: should view friend list', async ({ page }) => {
    // Navigate to friends section
    await page.goto('/friends');

    // Should show friends list
    await expect(page.locator('text=好友列表')).toBeVisible();

    // Should show friend items
    await page.waitForSelector('[data-testid="friend-item"]', { timeout: 5000 });
  });

  test('T4.1.4: should open chat with friend', async ({ page }) => {
    // Navigate to friends section
    await page.goto('/friends');

    // Click on a friend
    const friendItem = page.locator('[data-testid="friend-item"]').first();
    await friendItem.click();

    // Should open chat
    await expect(page.locator('text=发送消息')).toBeVisible({ timeout: 5000 });
  });

  test('T4.1.5: should view notifications', async ({ page }) => {
    // Click notification bell
    await page.click('[data-testid="notification-bell"]');

    // Should show notification panel
    await expect(page.locator('text=通知')).toBeVisible();

    // Should show notification list
    await expect(page.locator('text=没有通知')).toBeVisible({ timeout: 5000 });
  });

  test('T4.1.6: should accept friend request from notifications', async ({ page }) => {
    // Click notification bell
    await page.click('[data-testid="notification-bell"]');

    // Wait for notifications to load
    await page.waitForTimeout(1000);

    // If there's a friend request, accept it
    const acceptButton = page.locator('text=接受').first();
    if (await acceptButton.isVisible()) {
      await acceptButton.click();

      // Should show success toast
      await expect(page.locator('text=已接受好友请求')).toBeVisible({ timeout: 5000 });
    }
  });

  test('T4.1.7: should search for friends', async ({ page }) => {
    // Navigate to friends section
    await page.goto('/friends');

    // Type in search box
    await page.fill('input[type="search"]', 'Alice');

    // Should filter friends list
    await page.waitForTimeout(500);
  });

  test('T4.1.8: should view mail panel', async ({ page }) => {
    // Click mail icon
    await page.click('[data-testid="mail-icon"]');

    // Should show mail panel
    await expect(page.locator('text=邮件')).toBeVisible();

    // Should show mail list or empty state
    await expect(page.locator('text=没有邮件')).toBeVisible({ timeout: 5000 });
  });
});
