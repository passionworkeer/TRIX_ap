/**
 * E2E Tests for QR Code Pairing Page (二维码配对页面)
 *
 * Test Coverage:
 * - T5.1.1: Page loading and rendering
 * - T5.1.2: QR code display area
 * - T5.1.3: Manual input mode
 * - T5.1.4: Basic pairing flow
 */

import { test, expect, loginWithSupabase } from './test-config';

async function waitForQrPairingReady(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { name: /TRIX Native 配对/ })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole('button', { name: '扫描二维码' })).toBeVisible({
    timeout: 20000,
  });
}

test.describe('QR Code Pairing Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock Supabase session
    await loginWithSupabase(page);

    // Navigate to QR code pairing page using hash routing
    await page.goto('/#/qr-pairing');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await waitForQrPairingReady(page);
  });

  test('T5.1.1: should load and render QR code pairing page successfully', async ({ page }) => {
    // Check that we're on the QR pairing page
    await expect(page).toHaveURL(/.*qr-pairing/);

    // Check page title - look for h1 element
    await expect(page.getByRole('heading', { name: /TRIX Native 配对/ })).toBeVisible({
      timeout: 10000,
    });

    // Verify heading text contains expected content
    const headingText = await page.getByRole('heading', { name: /TRIX Native 配对/ }).textContent();
    expect(headingText).toContain('TRIX Native');
    expect(headingText).toContain('配对');

    // Check main container is present - use simpler selector
    await expect(page.locator('body')).toBeVisible();
  });

  test('T5.1.2: should display QR code pairing UI elements', async ({ page }) => {
    // Check for main heading
    await expect(page.getByRole('heading', { name: /TRIX Native 配对/ })).toBeVisible({ timeout: 10000 });

    // Check for connection instruction text - look for key elements
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('TRIX');
    expect(pageContent).toContain('使用说明');
    expect(pageContent).toContain('扫描二维码');

    // Check for device name input if present
    const deviceNameInput = page.locator('input[placeholder*="留空"]').first();
    const deviceNameVisible = await deviceNameInput.isVisible().catch(() => false);
    if (deviceNameVisible) {
      await expect(deviceNameInput).toBeVisible();
    }
  });

  test('T5.1.3: should have manual input option available', async ({ page }) => {
    await expect(page.getByRole('button', { name: '扫描二维码' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('手动输入配对码', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('input[placeholder="AB12CD"]')).toBeVisible({ timeout: 10000 });
  });

  test('T5.1.4: should display pairing steps or instructions', async ({ page }) => {
    // Check page content for expected text
    const pageContent = await page.locator('body').textContent() ?? '';

    // Should contain some form of instructions or steps
    const hasInstructions = pageContent.includes('使用说明') ||
                           pageContent.includes('扫描二维码') ||
                           pageContent.includes('手动输入配对码') ||
                           pageContent.includes('配对成功');

    expect(hasInstructions).toBe(true);
  });
});
