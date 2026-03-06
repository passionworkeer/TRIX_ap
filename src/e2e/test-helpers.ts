/**
 * Test Helper Functions
 *
 * Common helper functions for E2E tests
 */

import { Page } from '@playwright/test';

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!',
};

/**
 * Performs login with test credentials
 * @param page - Playwright page object
 * @returns Promise that resolves when login is complete
 */
export async function loginTestUser(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto('/#/login');

  // Fill in credentials
  await page.fill('#email-input', TEST_USER.email);
  await page.fill('#password-input', TEST_USER.password);

  // Submit login
  await page.click('button:has-text("登录")');

  // Wait for navigation to home after successful login
  await page.waitForURL('**/', { timeout: 15000 });

  // Additional wait for auth state to settle
  await page.waitForTimeout(1000);
}

/**
 * Checks if user is already logged in
 * @param page - Playwright page object
 * @returns Promise<boolean> - true if logged in, false otherwise
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check if we're on login page
    const url = page.url();
    if (url.includes('/login') || url.includes('/#/login')) {
      return false;
    }

    // Check if we can access a protected route
    await page.goto('/');
    await page.waitForTimeout(1000);

    // If we're redirected to login, we're not logged in
    const currentUrl = page.url();
    return !currentUrl.includes('/login') && !currentUrl.includes('/#/login');
  } catch {
    return false;
  }
}

/**
 * Ensures user is logged in, only logging in if necessary
 * @param page - Playwright page object
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  const loggedIn = await isLoggedIn(page);
  if (!loggedIn) {
    await loginTestUser(page);
  }
}
