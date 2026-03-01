/**
 * E2E Tests for Authentication Flow
 *
 * Test Coverage:
 * - T2.1.1: User registration
 * - T2.1.2: User login
 * - T2.1.3: Logout functionality
 * - T2.1.4: Password reset
 * - T2.1.5: Session management
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('T2.1.1: should register a new user', async ({ page }) => {
    // Navigate to registration page
    await page.click('text=注册');

    // Fill registration form
    await page.fill('input[type="email"]', 'newuser@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.fill('input[type="text"]', 'NewUser');

    // Submit registration
    await page.click('button[type="submit"]');

    // Should redirect to home or show success
    await page.waitForURL('**/');
  });

  test('T2.1.2: should login with valid credentials', async ({ page }) => {
    // Fill login form
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');

    // Submit login
    await page.click('button[type="submit"]');

    // Should redirect to home
    await page.waitForURL('**/');

    // Should show user profile or avatar
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible({ timeout: 10000 });
  });

  test('T2.1.3: should logout successfully', async ({ page }) => {
    // First login
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/');

    // Click logout button
    await page.click('[data-testid="logout-button"]');

    // Should redirect to login page
    await expect(page.locator('text=登录')).toBeVisible();
  });

  test('T2.1.4: should show error with invalid credentials', async ({ page }) => {
    // Fill with invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit login
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=登录失败')).toBeVisible();
  });

  test('T2.1.5: should remember session', async ({ page }) => {
    // Login with remember me checked
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.check('input[type="checkbox"]');

    await page.click('button[type="submit"]');

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });
});
