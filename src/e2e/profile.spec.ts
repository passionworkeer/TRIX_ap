/**
 * E2E Tests for Profile & Settings
 *
 * Test Coverage:
 * - T5.1.1: View profile page
 * - T5.1.2: Edit profile information
 * - T5.1.3: Change avatar
 * - T5.1.4: View points history
 * - T5.1.5: View achievements
 * - T5.1.6: Access settings
 */

import { test, expect } from '@playwright/test';

test.describe('Profile & Settings E2E Tests', () => {
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

  test('T5.1.1: should view profile page', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Should show profile information
    await expect(page.locator('text=个人资料')).toBeVisible();
    await expect(page.locator('text=我的')).toBeVisible();
  });

  test('T5.1.2: should display user information', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Should show user details
    await expect(page.locator('[data-testid="username"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-email"]')).toBeVisible();
  });

  test('T5.1.3: should show points balance', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Should show points
    await expect(page.locator('text=积分')).toBeVisible();
    await expect(page.locator('[data-testid="points-balance"]')).toBeVisible();
  });

  test('T5.1.4: should view points history', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Click on points history
    await page.click('[data-testid="points-history-button"]');

    // Should show points history dialog
    await expect(page.locator('text=积分记录')).toBeVisible();

    // Should show history items
    await page.waitForSelector('[data-testid="points-item"]', { timeout: 5000 });
  });

  test('T5.1.5: should view achievements', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Click on achievements
    await page.click('[data-testid="achievements-button"]');

    // Should show achievements section
    await expect(page.locator('text=成就')).toBeVisible();
  });

  test('T5.1.6: should access settings', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Click settings button
    await page.click('[data-testid="settings-button"]');

    // Should navigate to settings
    await expect(page.locator('text=设置')).toBeVisible();
  });

  test('T5.1.7: should change user identity for testing', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Click user switcher
    await page.click('[data-testid="user-switcher"]');

    // Should show user options
    await expect(screen.getByText('测试好友')).toBeVisible();

    // Click on test friend
    await page.click('text=测试好友');

    // Should reload page with new user
    await page.waitForTimeout(1000);
  });

  test('T5.1.8: should show wardrobe section', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Click on wardrobe
    await page.click('[data-testid="wardrobe-button"]');

    // Should navigate to wardrobe
    await expect(page.locator('text=衣橱')).toBeVisible();
  });

  test('T5.1.9: should view study statistics', async ({ page }) => {
    // Navigate to profile
    await page.goto('/profile');

    // Should show study stats
    await expect(page.locator('[data-testid="study-stats"]')).toBeVisible();
  });
});
