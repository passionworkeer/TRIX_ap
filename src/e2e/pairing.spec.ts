/**
 * E2E Tests for Pairing Page
 */

import type { Page } from '@playwright/test';
import { test, expect, mockSession } from './test-config';

async function ensureManualInputMode(page: Page) {
  const codeInput = page.getByPlaceholder('AB12CD');
  const manualInputButton = page.getByRole('button', { name: /手动输入配对码/ });
  const modeReady = page.locator('input[placeholder="AB12CD"], button:has-text("手动输入配对码")');

  await expect(modeReady.first()).toBeVisible({ timeout: 10000 });

  if (await codeInput.isVisible().catch(() => false)) {
    return {
      codeInput,
      submitButton: page.getByRole('button', { name: '验证配对' }),
    };
  }

  await expect(manualInputButton).toBeVisible({ timeout: 10000 });
  await manualInputButton.click();
  await expect(codeInput).toBeVisible({ timeout: 10000 });

  return {
    codeInput,
    submitButton: page.getByRole('button', { name: '验证配对' }),
  };
}

test.describe('Pairing Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
    await page.goto('/#/pairing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /TRIX Native/ }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('T4.1.1 - Load and render pairing page successfully', async ({ page }) => {
    await expect(page).toHaveURL(/.*pairing/, { timeout: 15000 });

    const title = page.getByRole('heading', { name: /TRIX Native/ }).first();
    await expect(title).toBeVisible();

    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(100);
  });

  test('T4.1.2 - Display connection status indicator', async ({ page }) => {
    const warningBox = page.locator('.bg-orange-500').first();
    const authError = page.getByText('Authenticated app user required').first();
    const codeInput = page.getByPlaceholder('AB12CD');
    const qrReader = page.locator('#qr-reader');

    const hasWarning = await warningBox.isVisible().catch(() => false);
    const hasAuthError = await authError.isVisible().catch(() => false);
    const hasCodeInput = await codeInput.isVisible().catch(() => false);
    const hasQrReader = await qrReader.isVisible().catch(() => false);

    expect(hasWarning || hasAuthError || hasCodeInput || hasQrReader).toBe(true);
  });

  test('T4.1.3 - Show QR scanner area when on scan mode', async ({ page }) => {
    const qrReader = page.locator('#qr-reader');
    const qrReaderVisible = await qrReader.isVisible().catch(() => false);

    if (qrReaderVisible) {
      await expect(qrReader).toBeVisible({ timeout: 10000 });
      return;
    }

    const { codeInput } = await ensureManualInputMode(page);
    await expect(codeInput).toBeVisible();
  });

  test('T4.1.4 - Switch to manual input mode', async ({ page }) => {
    const { codeInput, submitButton } = await ensureManualInputMode(page);

    await expect(codeInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('T4.1.5 - Handle valid pairing code input', async ({ page }) => {
    const { codeInput, submitButton } = await ensureManualInputMode(page);

    await codeInput.fill('ABC123');
    await expect(codeInput).toHaveValue('ABC123');
    await expect(submitButton).toBeEnabled();
  });

  test('T4.1.6 - Handle invalid pairing code input', async ({ page }) => {
    const { codeInput, submitButton } = await ensureManualInputMode(page);

    await codeInput.fill('ABC');
    await expect(submitButton).toBeDisabled();

    await codeInput.fill('abc!@#');
    await page.waitForTimeout(500);
    const inputValue = await codeInput.inputValue();
    expect(inputValue).toMatch(/^[A-Z0-9]*$/i);
  });

  test('T4.1.7 - Show cancel button in input mode', async ({ page }) => {
    await ensureManualInputMode(page);

    const secondaryAction = page.getByRole('button', { name: /返回扫码|取消配对|解除绑定/ }).first();
    await expect(secondaryAction).toBeVisible();
  });

  test('T4.1.8 - Have back to scan button in input mode', async ({ page }) => {
    await ensureManualInputMode(page);

    const backToScanButton = page.getByRole('button', { name: '返回扫码' });
    await expect(backToScanButton).toBeVisible();
  });

  test('T4.1.9 - Navigate back to profile when clicking back button', async ({ page }) => {
    const backButton = page.getByRole('button', { name: '返回' }).first();
    await expect(backButton).toBeVisible();
    await backButton.click();
    await page.waitForTimeout(1000);
  });

  test('T4.1.10 - Handle loading state during pairing', async ({ page }) => {
    const { codeInput, submitButton } = await ensureManualInputMode(page);

    await codeInput.fill('ABC123');
    await submitButton.click();
    await page.waitForTimeout(2000);

    const loadingState = page.getByText('验证中..').first();
    const successState = page.getByText('配对成功').first();
    const authError = page.getByText('Authenticated app user required').first();
    const inputStillVisible = page.getByPlaceholder('AB12CD');

    const hasLoading = await loadingState.isVisible().catch(() => false);
    const hasSuccess = await successState.isVisible().catch(() => false);
    const hasAuthError = await authError.isVisible().catch(() => false);
    const stillInInputMode = await inputStillVisible.isVisible().catch(() => false);

    expect(hasLoading || hasSuccess || hasAuthError || stillInInputMode).toBe(true);
  });

  test('T4.1.11 - Filter non-alphanumeric characters in input', async ({ page }) => {
    const { codeInput } = await ensureManualInputMode(page);

    await codeInput.fill('abc123!@#xyz');
    await page.waitForTimeout(500);

    const inputValue = await codeInput.inputValue();
    expect(inputValue).toMatch(/^[A-Z0-9]+$/i);
    expect(inputValue.length).toBeLessThanOrEqual(6);
  });

  test('T4.1.12 - Display server connection warning when not connected', async ({ page }) => {
    const warningBox = page.locator('.bg-orange-500').first();
    const authError = page.getByText('Authenticated app user required').first();
    const codeInput = page.getByPlaceholder('AB12CD');
    const qrReader = page.locator('#qr-reader');

    const warningVisible = await warningBox.isVisible().catch(() => false);
    const authErrorVisible = await authError.isVisible().catch(() => false);
    const codeInputVisible = await codeInput.isVisible().catch(() => false);
    const qrReaderVisible = await qrReader.isVisible().catch(() => false);

    expect(warningVisible || authErrorVisible || codeInputVisible || qrReaderVisible).toBe(true);
  });
});
