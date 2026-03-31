/**
 * E2E Test Configuration
 *
 * 配置 Supabase 认证相关的测试辅助函数
 * 支持真实 Supabase 登录和 Mock 两种模式
 */

import { test as base, Page, expect } from '@playwright/test';

// 真实 Supabase 测试用户
const TEST_USER = {
  email: 'xiaoming@trix.app',
  password: 'trix2026',
  username: 'xiaoming'
};

/**
 * Set i18next locale to Chinese before the page loads.
 * Must be called BEFORE page.goto() — the addInitScript runs before any page script,
 * ensuring i18next-browser-languagedetector picks up the locale immediately.
 */
export async function waitForI18n(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'zh');
    localStorage.setItem('i18nextLng', 'zh');
    sessionStorage.setItem('language', 'zh');
    sessionStorage.setItem('i18nextLng', 'zh');
  });
}

/**
 * 使用真实 Supabase 登录
 * 测试前先尝试登录，失败则尝试注册
 * 注意：注册后需要邮箱确认才能登录
 */
export async function loginWithSupabase(page: Page) {
  if (process.env.PLAYWRIGHT_USE_REAL_SUPABASE !== '1') {
    console.log('Using mocked Supabase authentication...');
    await waitForI18n(page);
    await mockSession(page, 'test-user-123', TEST_USER.email);
    await page.waitForTimeout(100);
    return;
  }

  console.log('Using REAL Supabase authentication...');
  console.log('Test user:', TEST_USER.email);

  // Set i18n locale BEFORE navigating so the detector picks it up on page load
  await waitForI18n(page);
  await page.goto('/#/login');
  await page.waitForLoadState('domcontentloaded');

  // 尝试登录
  await page.fill('#email-input', TEST_USER.email);
  await page.fill('#password-input', TEST_USER.password);
  await page.click('button:has-text("登录")');

  // 等待登录响应 - 使用更长的超时时间
  // Supabase 认证通常需要 3-8 秒
  await page.waitForTimeout(8000);

  // 检查 URL 变化 - 登录成功应该导航到主页
  const currentUrl = page.url();
  console.log('After login attempt, URL:', currentUrl);

  // 如果仍在登录页，说明登录失败
  if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
    console.log('Login failed, trying to register...');

    // 尝试注册
    await page.goto('/#/register');
    await page.waitForLoadState('domcontentloaded');

    // 填写注册表单 (注册页面无 #email-input，用 placeholder 定位)
    const usernameInput = page.locator('input[placeholder="用户名"]');
    if (await usernameInput.isVisible()) {
      await usernameInput.fill(TEST_USER.username);
    }
    await page.locator('input[placeholder="邮箱地址"]').fill(TEST_USER.email);
    await page.locator('input[placeholder="密码"]').fill(TEST_USER.password);
    await page.click('button:has-text("立即注册")');

    // 等待注册结果
    await page.waitForTimeout(8000);
  }

  // 验证登录/注册成功 - 等待 Supabase session 存储到 localStorage
  await page.waitForTimeout(3000);

  // 检查 localStorage 中是否有 Supabase session
  const hasSession = await page.evaluate(() => {
    const storageKey = 'sb-__SUPABASE_PROJECT_REF_REDACTED__-auth-token';
    const session = localStorage.getItem(storageKey);
    return session !== null;
  });

  if (hasSession) {
    console.log('Supabase session found in localStorage');
  } else {
    console.log('Warning: No Supabase session found in localStorage');
  }

  // 等待页面加载完成（不使用 networkidle，因为开发环境可能有持续的后台请求）
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);

  console.log('Final URL:', page.url());
}

/**
 * 使用 mock session 并设置正确的 localStorage
 * 配合 API 拦截使用
 */
export async function mockSession(page: Page, userId = 'test-user-123', email = 'test@example.com') {
  // Mock Supabase client in the browser before page loads
  // Note: Playwright's addInitScript passes arguments as an array
  await page.addInitScript(({ userId, email }) => {
    // Create a mock session object
    const mockUser = {
      id: userId,
      email: email,
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      app_metadata: {
        provider: 'email',
        providers: ['email']
      },
      user_metadata: {}
    };

    const mockSession = {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: mockUser
    };

    // Store in both localStorage and sessionStorage because runtime auth now
    // normalizes sessions into sessionStorage for security.
    const storageKey = `sb-__SUPABASE_PROJECT_REF_REDACTED__-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify(mockSession));
    sessionStorage.setItem(storageKey, JSON.stringify(mockSession));

    // Mock the Supabase client's auth methods
    // @ts-ignore - We're intentionally mocking the window object
    if (typeof window !== 'undefined') {
      // Store mock session for later access
      // @ts-ignore
      window.__SUPABASE_MOCK_SESSION__ = mockSession;
      // @ts-ignore
      window.__SUPABASE_MOCK_USER__ = mockUser;
    }

    // Intercept fetch calls to Supabase auth
    const originalFetch = window.fetch;
    // @ts-ignore
    window.fetch = async function(...args) {
      const [url, options] = args;
      const requestUrl = typeof url === 'string'
        ? url
        : (typeof Request !== 'undefined' && url instanceof Request)
          ? url.url
          : String(url);

      // Mock Supabase auth session endpoint
      if (requestUrl.includes('/auth/v1/session')) {
        return new Response(JSON.stringify(mockSession), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mock Supabase auth user endpoint
      if (requestUrl.includes('/auth/v1/user')) {
        return new Response(JSON.stringify(mockUser), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mock Supabase profiles endpoint
      if (requestUrl.includes('/rest/v1/profiles')) {
        return new Response(JSON.stringify({
          id: userId,
          username: 'TestUser',
          email: email,
          points: 100,
          days_active: 7,
          interaction_count: 42,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
        });
      }

      // Mock Supabase user_stats endpoint
      if (requestUrl.includes('/rest/v1/user_stats')) {
        return new Response(JSON.stringify([{
          id: userId,
          total_study_time: 3600,
          total_sessions: 10,
          avg_session_duration: 360,
          streak_days: 7,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mock Supabase points_transactions endpoint
      if (requestUrl.includes('/rest/v1/points_transactions')) {
        return new Response(JSON.stringify([
          {
            id: '1',
            user_id: userId,
            amount: 10,
            type: 'earned',
            description: 'Daily login bonus',
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            user_id: userId,
            amount: -5,
            type: 'spend',
            description: 'Purchased item',
            created_at: new Date().toISOString()
          }
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mock Supabase mall_items endpoint (Points Mall)
      if (requestUrl.includes('/rest/v1/mall_items')) {
        return new Response(JSON.stringify([
          {
            id: 'item-1',
            name: '蓝色T恤',
            description: '舒适的纯棉T恤',
            image_url: 'https://example.com/item1.png',
            price: 50,
            category: 'clothing',
            is_active: true,
            display_order: 1,
            created_at: new Date().toISOString()
          },
          {
            id: 'item-2',
            name: '黑色帽子',
            description: '时尚的棒球帽',
            image_url: 'https://example.com/item2.png',
            price: 30,
            category: 'accessory',
            is_active: true,
            display_order: 2,
            created_at: new Date().toISOString()
          },
          {
            id: 'item-3',
            name: '魔法背包',
            description: '可以装很多道具的背包',
            image_url: 'https://example.com/item3.png',
            price: 80,
            category: 'prop',
            is_active: true,
            display_order: 3,
            created_at: new Date().toISOString()
          }
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
        });
      }

      // Mock Supabase user_points endpoint (Points balance)
      if (requestUrl.includes('/rest/v1/user_points')) {
        return new Response(JSON.stringify({
          user_id: userId,
          balance: 100,
          total_earned: 150,
          total_spent: 50,
          updated_at: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mock Supabase user_purchased_items endpoint (Owned items)
      if (requestUrl.includes('/rest/v1/user_purchased_items')) {
        // Check if this is a select or insert operation
        if (options && options.method === 'POST') {
          // Return the inserted item for purchase tests
          return new Response(JSON.stringify({
            id: 'purchase-new-1',
            user_id: userId,
            item_id: 'item-1',
            quantity: 1,
            points_spent: 50,
            purchased_at: new Date().toISOString()
          }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // Return empty array for owned items (user hasn't purchased anything)
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Mock Supabase outfits endpoint (Wardrobe/Avatar outfits)
      if (requestUrl.includes('/rest/v1/outfits')) {
        return new Response(JSON.stringify([
          {
            id: 'outfit-1',
            name: '蓝色帽子',
            category: 'hat',
            image_url: 'https://example.com/hat1.png',
            preview_image_url: 'https://example.com/hat1-preview.png',
            description: '舒适的蓝色帽子',
            price: 50,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'outfit-2',
            name: '红色披风',
            category: 'cape',
            image_url: 'https://example.com/cape1.png',
            preview_image_url: 'https://example.com/cape1-preview.png',
            description: '帅气的红色披风',
            price: 80,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'outfit-3',
            name: '魔法魔杖',
            category: 'wand',
            image_url: 'https://example.com/wand1.png',
            preview_image_url: 'https://example.com/wand1-preview.png',
            description: '神奇的魔法魔杖',
            price: 100,
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: 'outfit-4',
            name: '森林背景',
            category: 'background',
            image_url: 'https://example.com/bg1.png',
            preview_image_url: 'https://example.com/bg1-preview.png',
            description: '美丽的森林背景',
            price: 30,
            is_active: true,
            created_at: new Date().toISOString()
          }
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
        });
      }

      // Mock Supabase user_outfits endpoint (User's owned outfits)
      if (requestUrl.includes('/rest/v1/user_outfits')) {
        return new Response(JSON.stringify([
          {
            id: 'user-outfit-1',
            user_id: userId,
            outfit_id: 'outfit-1',
            is_equipped: true,
            purchased_at: new Date().toISOString()
          },
          {
            id: 'user-outfit-2',
            user_id: userId,
            outfit_id: 'outfit-2',
            is_equipped: false,
            purchased_at: new Date().toISOString()
          }
        ]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Call original fetch for all other requests
      return originalFetch.apply(this, args);
    };
  }, { userId, email });
}

export { expect };
export const test = base;
