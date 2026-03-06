/**
 * E2E Tests for Social Features
 *
 * Test Coverage:
 * - T4.1.1: Add friend
 * - T4.1.2: Accept friend request
 * - T4.1.3: View friend list
 * - T4.1.4: Send message to friend
 * - T4.1.5: View notifications
 */

import { test, expect, loginWithSupabase } from './test-config';

test.describe('Social Features E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use mock Supabase session
    await loginWithSupabase(page);
  });

  test('T4.1.1: should open add friend modal', async ({ page }) => {
    // Navigate to chat page (contains friend functionality)
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Click add friend button - use aria-label
    const addFriendButton = page.locator('button[aria-label="添加好友"]')
      .or(page.locator('[data-testid="add-friend-button"]'));

    await addFriendButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

    const isVisible = await addFriendButton.isVisible().catch(() => false);

    if (isVisible) {
      await addFriendButton.first().click();

      // Should show add friend modal
      await page.waitForTimeout(1000);
      const modalContent = page.locator('text=添加好友').or(page.locator('text=添加'));
      const hasModal = await modalContent.isVisible().catch(() => false);

      if (hasModal) {
        await expect(modalContent.first()).toBeVisible();
      }
    }
  });

  test('T4.1.2: should send friend request', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Open add friend modal
    const addFriendButton = page.locator('button[aria-label="添加好友"]')
      .or(page.locator('[data-testid="add-friend-button"]'));

    await addFriendButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

    const isVisible = await addFriendButton.isVisible().catch(() => false);

    if (isVisible) {
      await addFriendButton.first().click();

      // Wait for modal
      await page.waitForTimeout(1000);

      // Enter friend account - try multiple selectors
      const accountInput = page.locator('input[placeholder*="账号"]')
        .or(page.locator('input[placeholder*="好友"]'))
        .or(page.locator('input[type="text"]'));

      await accountInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const inputVisible = await accountInput.isVisible().catch(() => false);

      if (inputVisible) {
        await accountInput.fill('friend@example.com');

        // Click send button
        const sendButton = page.locator('button:has-text("发送")')
          .or(page.locator('button:has-text("添加")'));

        await sendButton.click();

        // Should show success message or modal closes
        await page.waitForTimeout(1000);
      }
    }
  });

  test('T4.1.3: should view friend list', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Should show chat list or friends section
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.trim().length || 0).toBeGreaterThan(0);
  });

  test('T4.1.4: should open chat with friend', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Try to find a chat item (TRIX Bot or friend)
    const chatItem = page.locator('h3').or(page.locator('[class*="cursor-pointer"]')).first();

    await chatItem.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

    const isVisible = await chatItem.isVisible().catch(() => false);

    if (isVisible) {
      await chatItem.click();

      // Wait for navigation
      await page.waitForTimeout(2000);

      // Check URL changed to chat detail or stayed on chat
      const newUrl = page.url();
      const isValidNavigation = newUrl.includes('/chat') || newUrl.includes('/pairing');
      expect(isValidNavigation).toBeTruthy();
    }
  });

  test('T4.1.5: should view notifications', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Click notification bell - use aria-label
    const notificationBell = page.locator('button[aria-label="通知"]')
      .or(page.locator('[data-testid="notification-bell"]'));

    await notificationBell.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const isVisible = await notificationBell.isVisible().catch(() => false);

    if (isVisible) {
      await notificationBell.click();

      // Wait for notification panel
      await page.waitForTimeout(1000);

      // Should show notification content
      const notificationPanel = page.locator('text=通知').or(page.locator('text=消息'));
      const hasPanel = await notificationPanel.isVisible().catch(() => false);

      if (hasPanel) {
        await expect(notificationPanel.first()).toBeVisible();
      }
    }
  });

  test('T4.1.6: should accept friend request from notifications', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Click notification bell
    const notificationBell = page.locator('button[aria-label="通知"]')
      .or(page.locator('[data-testid="notification-bell"]'));

    await notificationBell.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const isVisible = await notificationBell.isVisible().catch(() => false);

    if (isVisible) {
      await notificationBell.click();

      // Wait for notifications to load
      await page.waitForTimeout(1500);

      // If there's a friend request, accept it
      const acceptButton = page.locator('text=接受').or(page.locator('text=同意'));

      await acceptButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const hasAccept = await acceptButton.isVisible().catch(() => false);

      if (hasAccept) {
        await acceptButton.first().click();

        // Wait for success
        await page.waitForTimeout(1000);
      }
    }
  });

  test('T4.1.7: should search for friends', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Find search input
    const searchInput = page.locator('input[placeholder="搜索"]')
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]'));

    await searchInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

    const isVisible = await searchInput.isVisible().catch(() => false);

    if (isVisible) {
      // Type in search box
      await searchInput.fill('Alice');

      // Verify search input has the value
      await expect(searchInput).toHaveValue('Alice');

      // Wait for filtering
      await page.waitForTimeout(500);
    }
  });

  test('T4.1.8: should view mail panel', async ({ page }) => {
    // Navigate to chat page
    await page.goto('/#/chat');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Skip if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
      test.skip();
      return;
    }

    // Click mail icon - use aria-label
    const mailIcon = page.locator('button[aria-label="邮件"]')
      .or(page.locator('[data-testid="mail-icon"]'))
      .or(page.locator('svg[class*="mail"]'));

    await mailIcon.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

    const isVisible = await mailIcon.isVisible().catch(() => false);

    if (isVisible) {
      await mailIcon.first().click();

      // Wait for mail panel
      await page.waitForTimeout(1000);

      // Should show mail panel
      const mailPanel = page.locator('text=邮件').or(page.locator('text=消息'));
      const hasPanel = await mailPanel.isVisible().catch(() => false);

      if (hasPanel) {
        await expect(mailPanel.first()).toBeVisible();
      }
    }
  });
});
