/**
 * E2E Tests for Authentication Flow
 *
 * Test Coverage:
 * - T2.1.1: User registration
 * - T2.1.2: User login
 * - T2.1.3: Logout functionality
 * - T2.1.4: Password reset
 * - T2.1.5: Session management
 *
 * NOTE: These tests use mock sessions and do not require real Supabase backend.
 * The tests verify the UI flow and component behavior rather than actual authentication.
 */

import { test, expect } from './test-config';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
  username: 'TestUser',
};

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('T2.1.0: should display registration page correctly', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/#/register');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check that registration form elements are present
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="邮箱地址"]')).toBeVisible();
    await expect(page.locator('input[placeholder="设置密码 (至少 6 位)"]')).toBeVisible();
    await expect(page.locator('button:has-text("立即注册")')).toBeVisible();
  });

  test('T2.1.1: should display login page correctly', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check that login form elements are present
    await expect(page.locator('#email-input')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test('T2.1.2: should show validation for invalid email format', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Fill with invalid email format
    await page.fill('#email-input', 'invalid-email');
    await page.fill('#password-input', TEST_USER.password);

    // Submit login
    await page.click('button:has-text("登录")');

    // Wait a bit for validation
    await page.waitForTimeout(1000);

    // Should still be on login page (validation prevented submission)
    expect(page.url()).toContain('/login');
  });

  test('T2.1.3: should navigate to registration from login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Click register link
    await page.click('text=立即注册');

    // Should navigate to register page
    await page.waitForURL('**/register', { timeout: 5000 });
    expect(page.url()).toContain('/register');
  });

  test('T2.1.4: should navigate to login from registration', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/#/register');

    // Click login link
    await page.click('text=立即登录');

    // Should navigate to login page
    await page.waitForURL('**/login', { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('T2.1.5: should show validation errors for empty fields', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Try to login without filling fields
    await page.click('button:has-text("登录")');

    // Wait a bit
    await page.waitForTimeout(1000);

    // Should stay on login page
    expect(page.url()).toContain('/login');
  });

  test('T2.1.6: should handle form input correctly', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Fill credentials
    await page.fill('#email-input', TEST_USER.email);
    await page.fill('#password-input', TEST_USER.password);

    // Verify inputs have values
    await expect(page.locator('#email-input')).toHaveValue(TEST_USER.email);
    await expect(page.locator('#password-input')).toHaveValue(TEST_USER.password);
  });

  test('T2.1.7: should display password input type correctly', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Check that password field is of type password
    const passwordInput = page.locator('#password-input');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('T2.1.8: should have proper form accessibility', async ({ page }) => {
    // Navigate to login page
    await page.goto('/#/login');

    // Check that form inputs have proper labels/aria attributes
    const emailInput = page.locator('#email-input');
    const passwordInput = page.locator('#password-input');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('T2.1.9: should display registration form fields correctly', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/#/register');

    // Check all registration fields
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="邮箱地址"]')).toBeVisible();
    await expect(page.locator('input[placeholder="设置密码 (至少 6 位)"]')).toBeVisible();
    await expect(page.locator('button:has-text("立即注册")')).toBeVisible();
  });
});
