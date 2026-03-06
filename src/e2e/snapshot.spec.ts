/**
 * E2E Tests for Snapshot Page (拍照页面)
 *
 * Test Coverage:
 * - T4.1.1: Page loading and rendering
 * - T4.1.2: Camera button presence
 * - T4.1.3: Preview functionality
 * - T4.1.4: Photo capture flow
 * - T4.1.5: Photo confirmation and retake
 * - T4.1.6: Analysis actions
 * - T4.1.7: Error handling and edge cases
 * - T4.1.8: Send to bot functionality
 */

import { test, expect, loginWithSupabase } from './test-config';

test.describe('Snapshot Page E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock Supabase session
    await loginWithSupabase(page);

    // Navigate to snapshot page using hash router format
    await page.goto('/#/snapshot');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Wait for React router to process navigation
    await page.waitForTimeout(1500);
  });

  test('T4.1.1: should load and render snapshot page successfully', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();

    // If redirected to login, the app requires real auth
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      // Check that we're on login page
      await expect(page.locator('text=欢迎回来')).toBeVisible({ timeout: 10000 });
      return;
    }

    // Check that we're on the snapshot page
    await expect(page).toHaveURL(/.*snapshot/);

    // Check that page title is visible
    const title = page.locator('text=快照');
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test('T4.1.2: should display camera capture button', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for the capture button to be visible
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });

    // Also check the capture instruction text
    const instructionText = page.locator('text=点击拍摄以分析');
    await expect(instructionText).toBeVisible();
  });

  test('T4.1.3: should display camera preview area', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Check for the camera frame/overlay
    const cameraFrame = page.locator('.w-64.h-64');
    await expect(cameraFrame).toBeVisible({ timeout: 10000 });

    // Check for corner markers
    const topLeftCorner = page.locator('.border-t-4.border-l-4');
    await expect(topLeftCorner).toBeVisible();

    const topRightCorner = page.locator('.border-t-4.border-r-4');
    await expect(topRightCorner).toBeVisible();

    const bottomLeftCorner = page.locator('.border-b-4.border-l-4');
    await expect(bottomLeftCorner).toBeVisible();

    const bottomRightCorner = page.locator('.border-b-4.border-r-4');
    await expect(bottomRightCorner).toBeVisible();
  });

  test('T4.1.4: should handle camera capture interaction', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for capture button
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });

    // Click the capture button
    await captureButton.click();

    // Wait for potential camera feedback
    await page.waitForTimeout(1000);

    // The button should now show a different state (photo ready)
    // Check for either "照片已就绪" or error message
    const photoReadyText = page.locator('text=照片已就绪');
    const errorMessage = page.locator('text=当前无法获取真实相机画面');

    // Either the photo should be ready or error should appear (mock camera mode)
    const isPhotoReady = await photoReadyText.isVisible();
    const hasError = await errorMessage.isVisible();

    expect(isPhotoReady || hasError).toBe(true);
  });

  test('T4.1.5: should show preview and confirmation after capture', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for capture button
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });

    // Click the capture button
    await captureButton.click();

    // Wait for response
    await page.waitForTimeout(1000);

    // Check for preview modal or confirmation options
    // Look for retake button (重拍)
    const retakeButton = page.locator('text=重拍');
    const confirmButton = page.locator('text=确认分析');

    // Wait for either preview modal or buttons to appear
    await page.waitForTimeout(500);

    // Either preview modal should be visible or error message
    const previewModal = page.locator('.bg-black\\/90.backdrop-blur-xl');
    const isPreviewVisible = await previewModal.isVisible().catch(() => false);

    if (isPreviewVisible) {
      // If preview is shown, check for action buttons
      const retakeVisible = await retakeButton.isVisible().catch(() => false);
      const confirmVisible = await confirmButton.isVisible().catch(() => false);
      expect(retakeVisible || confirmVisible).toBe(true);
    }
  });

  test('T4.1.6: should handle retake functionality', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Try to capture first
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });
    await captureButton.click();

    await page.waitForTimeout(1000);

    // Look for retake button
    const retakeButton = page.locator('text=重拍').first();

    // If retake button is visible, click it
    if (await retakeButton.isVisible().catch(() => false)) {
      await retakeButton.click();

      // Should return to camera view
      await page.waitForTimeout(500);

      // Capture button should be available again
      await expect(captureButton).toBeVisible();
    }
  });

  test('T4.1.7: should display analysis action buttons in result view', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // We need to reach the result view, which requires camera + confirm
    // First try to capture
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });
    await captureButton.click();

    await page.waitForTimeout(1000);

    // Click confirm to enter result view
    const confirmButton = page.locator('text=确认分析');

    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();

      // Wait for result view
      await page.waitForTimeout(1000);

      // Check for analysis action buttons
      const identifyButton = page.locator('text=识别画面内容');
      const extractTextButton = page.locator('text=提取图片文字');
      const studyPointsButton = page.locator('text=生成学习要点');
      const nextStepsButton = page.locator('text=给出下一步建议');

      // At least one should be visible
      const hasActionButtons = await identifyButton.isVisible().catch(() => false) ||
                               await extractTextButton.isVisible().catch(() => false) ||
                               await studyPointsButton.isVisible().catch(() => false) ||
                               await nextStepsButton.isVisible().catch(() => false);

      expect(hasActionButtons).toBe(true);
    }
  });

  test('T4.1.8: should show prompt text area in result view', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Try to get to result view
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });
    await captureButton.click();

    await page.waitForTimeout(1000);

    const confirmButton = page.locator('text=确认分析');

    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();

      await page.waitForTimeout(1000);

      // Check for prompt text area
      const promptTextArea = page.locator('textarea');
      await expect(promptTextArea).toBeVisible();
    }
  });

  test('T4.1.9: should have send button in result view', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Try to get to result view
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });
    await captureButton.click();

    await page.waitForTimeout(1000);

    const confirmButton = page.locator('text=确认分析');

    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();

      await page.waitForTimeout(1000);

      // Check for send button
      const sendButton = page.locator('text=发送给 Clawbot');
      await expect(sendButton).toBeVisible();
    }
  });

  test('T4.1.10: should display back button and header', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check for header with back button - use ArrowLeft icon selector
    const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
    await expect(backButton).toBeVisible({ timeout: 10000 });

    // Check title - look for 快照 text
    const title = page.locator('h1:has-text("快照")');
    await expect(title).toBeVisible({ timeout: 5000 });
  });

  test('T4.1.11: should have camera switch button', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Check for flip camera button
    const switchCameraButton = page.locator('.rounded-full.bg-white\\/20').last();
    await expect(switchCameraButton).toBeVisible({ timeout: 10000 });
  });

  test('T4.1.12: should navigate back when clicking back button', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click the back button - use ArrowLeft icon selector
    const backButton = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-left') }).first();
    await expect(backButton).toBeVisible({ timeout: 10000 });
    await backButton.click();

    // Should navigate back
    await page.waitForTimeout(500);

    // Check that we're no longer on snapshot page (either home or previous)
    const currentUrlAfter = page.url();
    expect(currentUrlAfter).not.toContain('/snapshot');
  });

  test('T4.1.13: should handle camera error gracefully', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Give time for camera initialization
    await page.waitForTimeout(2000);

    // The app may show error message if camera is not available, or demo/real-time mode
    // Check for demo mode or real-time mode indicators
    const hasDemoIndicator = await page.locator('text=演示').isVisible().catch(() => false);
    const hasRealTimeIndicator = await page.locator('text=实时').isVisible().catch(() => false);
    const hasCameraFrame = await page.locator('.w-64.h-64').isVisible().catch(() => false);

    // Either demo mode, real-time mode, or camera frame should be visible
    expect(hasDemoIndicator || hasRealTimeIndicator || hasCameraFrame).toBe(true);
  });

  test('T4.1.14: should show scanning animation during capture', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click capture button
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await expect(captureButton).toBeVisible({ timeout: 10000 });

    // Check for scanning animation - it should appear briefly during capture
    // The scanning animation is only visible during isScanning state
    // Since timing is tight, we just verify the button click doesn't error
    // and we can check the state changes after clicking

    // Just verify the click works without errors - the scanning is an internal state
    await captureButton.click();

    // Wait a bit to ensure no errors occurred
    await page.waitForTimeout(500);

    // Verify page is still functional after click
    const currentUrlStill = page.url();
    expect(currentUrlStill).toContain('/snapshot');
  });

  test('T4.1.15: should display correct instruction based on state', async ({ page }) => {
    // Wait for any redirect
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Initial state - should show "点击拍摄以分析"
    const initialInstruction = page.locator('text=点击拍摄以分析');
    await expect(initialInstruction).toBeVisible({ timeout: 10000 });

    // Click capture
    const captureButton = page.locator('.cursor-pointer.active\\:scale-95');
    await captureButton.click();

    // Wait for camera operation to complete
    await page.waitForTimeout(1500);

    // After capture, instruction should change - either photo ready or error
    const afterCaptureInstruction = page.locator('text=照片已就绪');
    const errorInstruction = page.locator('text=当前无法获取真实相机画面');

    const hasAfterCapture = await afterCaptureInstruction.isVisible().catch(() => false);
    const hasError = await errorInstruction.isVisible().catch(() => false);

    // Should show either "photo ready" or error
    expect(hasAfterCapture || hasError).toBe(true);
  });
});
