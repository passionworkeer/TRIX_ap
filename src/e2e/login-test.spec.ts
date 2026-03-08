/**
 * Quick login script to get valid session
 *
 * Run this with: npx playwright test --project=chromium --grep "login"
 */

import { test } from './test-config';

test('E2E Login Test', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:5173/#/login');
  await page.waitForLoadState('domcontentloaded');

  // Wait for page to be ready
  await page.waitForTimeout(1000);

  // Take screenshot of login page
  await page.screenshot({ path: 'test-results/login-page.png' });

  console.log('Login page loaded. Check test-results/login-page.png');
});
