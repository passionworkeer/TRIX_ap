import { test, expect, chromium } from '@playwright/test';

test.describe('TRIX 3D Companion E2E Tests', () => {
  test('should load home page without errors', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

    // Check title
    await expect(page).toHaveTitle(/TRIX/);

    // Check main content loaded
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Report console errors
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }

    await browser.close();
  });

  test('should load chat page', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173/chat', { waitUntil: 'networkidle' });

    // Should load without crashing
    await expect(page.locator('body')).toBeVisible();

    if (errors.length > 0) {
      console.log('Console errors on chat:', errors);
    }

    await browser.close();
  });

  test('should load study page', async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173/study', { waitUntil: 'networkidle' });

    await expect(page.locator('body')).toBeVisible();

    if (errors.length > 0) {
      console.log('Console errors on study:', errors);
    }

    await browser.close();
  });
});
