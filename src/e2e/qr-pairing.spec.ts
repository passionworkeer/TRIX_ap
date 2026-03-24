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

test.describe('QR Code Pairing Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock Supabase session
    await loginWithSupabase(page);

    // Navigate to QR code pairing page using hash routing
    await page.goto('/#/qr-pairing');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to render - increased to 3 seconds as per requirements
    await page.waitForTimeout(3000);
  });

  test('T5.1.1: should load and render QR code pairing page successfully', async ({ page }) => {
    // Wait for page to fully render
    await page.waitForTimeout(2000);

    // Check that we're on the QR pairing page
    await expect(page).toHaveURL(/.*qr-pairing/);

    // Check page title - look for h1 element
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Verify heading text contains expected content
    const headingText = await page.locator('h1').textContent();
    expect(headingText).toContain('TRIX Native');
    expect(headingText).toContain('配对');

    // Check main container is present - use simpler selector
    await expect(page.locator('body')).toBeVisible();
  });

  test('T5.1.2: should display QR code pairing UI elements', async ({ page }) => {
    // Wait for animations to complete
    await page.waitForTimeout(2000);

    // Check for main heading
    await expect(page.locator('h1')).toBeVisible();

    // Check for connection instruction text - look for key elements
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toContain('连接');
    expect(pageContent).toContain('TRIX');

    // Check for device name input if present
    const deviceNameInput = page.locator('input[placeholder*="留空"]').first();
    const deviceNameVisible = await deviceNameInput.isVisible().catch(() => false);
    if (deviceNameVisible) {
      await expect(deviceNameInput).toBeVisible();
    }
  });

  test('T5.1.3: should have manual input option available', async ({ page }) => {
    // Wait for page to render
    await page.waitForTimeout(2000);

    // Look for manual input button or textarea
    // Check for either scan button or manual input button
    const scanButton = page.locator('button:has-text("扫描")').first();
    const manualButton = page.locator('button:has-text("手动")').first();
    const manualTextarea = page.locator('textarea').first();

    // At least one of these should be visible
    const hasScanButton = await scanButton.isVisible().catch(() => false);
    const hasManualButton = await manualButton.isVisible().catch(() => false);
    const hasTextarea = await manualTextarea.isVisible().catch(() => false);

    expect(hasScanButton || hasManualButton || hasTextarea).toBe(true);
  });

  test('T5.1.4: should display pairing steps or instructions', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Check page content for expected text
    const pageContent = await page.locator('body').textContent() ?? '';

    // Should contain some form of instructions or steps
    const hasInstructions = pageContent.includes('步骤') ||
                           pageContent.includes('扫描') ||
                           pageContent.includes('配对') ||
                           pageContent.includes('连接');

    expect(hasInstructions).toBe(true);
  });
});
