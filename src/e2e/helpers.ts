/**
 * E2E Test Helpers
 *
 * Utility functions for E2E testing with Supabase authentication
 */

import { Page } from '@playwright/test';

// 测试用户凭据（请确保在 Supabase 中存在此用户）
const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!'
};

/**
 * 通过 UI 登录到 Supabase
 */
export async function login(page: Page) {
  // 导航到登录页面
  await page.goto('/#/login');
  await page.waitForLoadState('domcontentloaded');

  // 填写登录表单
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);

  // 提交登录
  await page.click('button[type="submit"]');

  // 等待登录成功并跳转到首页
  await page.waitForURL('**/', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Mock 认证状态（用于不需要真实后端的测试）
 */
export async function mockAuth(page: Page) {
  await page.addInitScript(() => {
    const mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {}
      }
    };
    localStorage.setItem('sb-localhost-auth-token', JSON.stringify(mockSession));
  });
}

/**
 * 等待页面加载完成并稳定
 */
export async function waitForPageStable(page: Page, timeout = 3000) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(timeout);
}

/**
 * 截图并保存（用于调试）
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}
