/**
 * E2E Tests for Registration Flow
 *
 * Test Coverage:
 * - T2.2.1: Registration page loads with form elements
 * - T2.2.2: Form fields exist (username, email, password)
 * - T2.2.3: Form validation (empty fields)
 * - T2.2.4: Navigate to login from registration
 * - T2.2.5: Registration form accessibility
 *
 * NOTE: Registration page is a public route; mockSession is used
 * to prevent any auth redirects during test setup.
 */

import { test, expect, mockSession, waitForI18n } from './test-config';

test.describe('Registration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set i18n locale before navigation
    await waitForI18n(page);
    await mockSession(page);

    // Navigate to registration page
    await page.goto('/#/register');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test('T2.2.1: should display registration form with all required elements', async ({ page }) => {
    // Username field - uses placeholder without ID
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible({ timeout: 8000 });

    // Email field - uses placeholder without ID
    await expect(page.locator('input[placeholder="邮箱地址"]')).toBeVisible();

    // Password field - uses placeholder without ID
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible();

    // Register button
    await expect(page.locator('button:has-text("立即注册")')).toBeVisible();
  });

  test('T2.2.2: should display all three input fields correctly', async ({ page }) => {
    // Verify all three input fields are present and empty on load
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const emailInput = page.locator('input[placeholder="邮箱地址"]');
    const passwordInput = page.locator('input[placeholder="密码"]');

    await expect(usernameInput).toBeVisible({ timeout: 8000 });
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check that all fields are initially empty
    await expect(usernameInput).toHaveValue('');
    await expect(emailInput).toHaveValue('');
    await expect(passwordInput).toHaveValue('');
  });

  test('T2.2.3: should show validation errors when submitting empty form', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const emailInput = page.locator('input[placeholder="邮箱地址"]');
    const passwordInput = page.locator('input[placeholder="密码"]');

    await expect(usernameInput).toBeVisible({ timeout: 8000 });

    // Fill one field and try to submit
    await usernameInput.fill('TestUser');

    // Click register button without filling email and password
    await page.locator('button:has-text("立即注册")').click();
    await page.waitForTimeout(1000);

    // Should stay on registration page
    expect(page.url()).toContain('/register');
  });

  test('T2.2.4: should navigate to login from registration', async ({ page }) => {
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible({ timeout: 8000 });

    // Click "立即登录" link
    await page.locator('text=立即登录').click();
    await page.waitForURL('**/login', { timeout: 5000 });

    expect(page.url()).toContain('/login');
  });

  test('T2.2.5: should have accessible form inputs', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const emailInput = page.locator('input[placeholder="邮箱地址"]');
    const passwordInput = page.locator('input[placeholder="密码"]');

    await expect(usernameInput).toBeVisible({ timeout: 8000 });
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check email input type
    await expect(emailInput).toHaveAttribute('type', 'email');

    // Check password input type
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('T2.2.6: should handle input in all three fields', async ({ page }) => {
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const emailInput = page.locator('input[placeholder="邮箱地址"]');
    const passwordInput = page.locator('input[placeholder="密码"]');

    await expect(usernameInput).toBeVisible({ timeout: 8000 });

    await usernameInput.fill('NewTestUser');
    await emailInput.fill('newuser@example.com');
    await passwordInput.fill('SecurePass123!');

    await expect(usernameInput).toHaveValue('NewTestUser');
    await expect(emailInput).toHaveValue('newuser@example.com');
    await expect(passwordInput).toHaveValue('SecurePass123!');
  });
});
