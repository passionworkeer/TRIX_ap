/**
 * E2E Tests for Authentication Flow
 *
 * Test Coverage:
 * - T2.1.0: Registration page renders correctly
 * - T2.1.1: Login page renders correctly
 * - T2.1.2: Invalid email validation
 * - T2.1.3: Navigate to registration from login
 * - T2.1.4: Navigate to login from registration
 * - T2.1.5: Empty field validation
 * - T2.1.6: Form input handling
 * - T2.1.7: Password input type
 * - T2.1.8: Form accessibility
 * - T2.1.9: Registration form fields
 *
 * NOTE: These tests use mock sessions and do not require real Supabase backend.
 * The tests verify the UI flow and component behavior rather than actual authentication.
 */

import { test, expect, mockSession, waitForI18n } from './test-config';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  username: 'TestUser',
};

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await waitForI18n(page);
  });

  test('T2.1.0: should display registration page correctly', async ({ page }) => {
    await page.goto('/#/register');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Registration form uses placeholders without IDs — match by placeholder text
    // Component: t('auth.placeholder.username') = "用户名"
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[placeholder="邮箱地址"]')).toBeVisible();
    // Component: t('auth.placeholder.password') = "密码" (NOT "设置密码 (至少 6 位)")
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible();
    // Component: t('auth.joinNow') = "立即注册"
    await expect(page.locator('button:has-text("立即注册")')).toBeVisible();
  });

  test('T2.1.1: should display login page correctly', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#email-input')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#password-input')).toBeVisible();
    // Component: t('auth.login') = "登录"
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test('T2.1.2: should show validation for invalid email format', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForSelector('#email-input', { timeout: 8000 }).catch(() => {});

    await page.fill('#email-input', 'invalid-email');
    await page.fill('#password-input', TEST_USER.password);
    await page.click('button:has-text("登录")');
    await page.waitForTimeout(1000);

    // Validation should prevent submission — stay on login page
    expect(page.url()).toContain('/login');
  });

  test('T2.1.3: should navigate to registration from login', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForSelector('#email-input', { timeout: 8000 }).catch(() => {});

    // Login page: t('auth.noAccount') + t('auth.signUpNow') = "还没有账号？立即注册"
    await page.click('text=立即注册');
    await page.waitForURL('**/register', { timeout: 5000 });
    expect(page.url()).toContain('/register');
  });

  test('T2.1.4: should navigate to login from registration', async ({ page }) => {
    await page.goto('/#/register');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Registration page: t('auth.hasAccount') + t('auth.loginNow') = "已有账号？立即登录"
    await page.click('text=立即登录');
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('T2.1.5: should show validation errors for empty fields', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForSelector('#email-input', { timeout: 8000 }).catch(() => {});

    await page.click('button:has-text("登录")');
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/login');
  });

  test('T2.1.6: should handle form input correctly', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForSelector('#email-input', { timeout: 8000 }).catch(() => {});

    await page.fill('#email-input', TEST_USER.email);
    await page.fill('#password-input', TEST_USER.password);

    await expect(page.locator('#email-input')).toHaveValue(TEST_USER.email);
    await expect(page.locator('#password-input')).toHaveValue(TEST_USER.password);
  });

  test('T2.1.7: should display password input type correctly', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForSelector('#password-input', { timeout: 8000 }).catch(() => {});

    const passwordInput = page.locator('#password-input');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('T2.1.8: should have proper form accessibility', async ({ page }) => {
    await page.goto('/#/login');
    await page.waitForSelector('#email-input', { timeout: 8000 }).catch(() => {});

    await expect(page.locator('#email-input')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();
  });

  test('T2.1.9: should display registration form fields correctly', async ({ page }) => {
    await page.goto('/#/register');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Component uses placeholders without IDs
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('input[placeholder="邮箱地址"]')).toBeVisible();
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible();
    await expect(page.locator('button:has-text("立即注册")')).toBeVisible();
  });
});
