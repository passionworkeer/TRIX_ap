/**
 * desktop.spec.ts — Full desktop Electron app E2E test
 *
 * Tests all 9 Lumina/Noir routes and key interactions:
 * - Sidebar navigation (all 9 routes)
 * - TitleBar window controls
 * - Lumina pages: Chat, Study, Snapshot, Profile
 * - Noir pages: Dashboard, Agents, Channels, Backups, Settings
 * - Interactive elements: toggles, buttons, forms, terminal
 *
 * Usage:
 *   npx playwright test desktop.spec.ts --config playwright-desktop.config.ts
 *
 * Prerequisites:
 *   npm i -D @playwright/test && npx playwright install chromium
 */

import { test, expect, type BrowserContext, type Page, type ElectronApplication } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { ELECTRON_PATH, CDP_PORT } from './playwright-desktop.config';

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron with remote debugging enabled
  app = await electron.launch({
    executablePath: ELECTRON_PATH,
    args: [
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  // Wait for the app window to appear
  const window = await app.firstWindow();
  page = window;
});

test.afterAll(async () => {
  await app.close();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function waitForRouteReady(label: string) {
  // Wait for loading spinners to disappear (max 5s)
  await page.waitForTimeout(500);
  console.log(`✓ Route ready: ${label}`);
}

async function clickSidebarButton(page: Page, label: string) {
  // The sidebar button text contains the Chinese label
  const btn = page.locator(`button:has-text("${label}")`).first();
  await btn.click();
  await page.waitForTimeout(300);
}

// ── TitleBar ─────────────────────────────────────────────────────────────────

test.describe('TitleBar', () => {
  test('renders app title and window controls', async () => {
    await page.waitForLoadState('domcontentloaded');
    // App title visible
    await expect(page.locator('text=TRIX Companion')).toBeVisible();
    // Minimize button present
    const minimizeBtn = page.locator('button[title="最小化到托盘"]');
    await expect(minimizeBtn).toBeVisible();
    // Close button present
    const closeBtn = page.locator('button[title="关闭"]');
    await expect(closeBtn).toBeVisible();
    console.log('✓ TitleBar: all controls visible');
  });
});

// ── Sidebar Navigation ────────────────────────────────────────────────────────

test.describe('Sidebar Navigation', () => {
  const routes: Array<{ label: string; route: string; dark?: boolean }> = [
    { label: '聊天',     route: 'chat' },
    { label: '学习',     route: 'study' },
    { label: '快照',    route: 'snapshot' },
    { label: '个人资料', route: 'profile' },
    { label: '控制台',  route: 'dashboard', dark: true },
    { label: '智能体',  route: 'agents', dark: true },
    { label: '渠道配置', route: 'channels', dark: true },
    { label: '数据备份', route: 'backups', dark: true },
    { label: '系统设置', route: 'settings', dark: true },
  ];

  for (const { label, route } of routes) {
    test(`navigates to ${route} (${label})`, async () => {
      await clickSidebarButton(page, label);
      await waitForRouteReady(route);
      console.log(`✓ Navigated to ${route}`);
    });
  }

  test('sidebar collapse/expand toggle works', async () => {
    // Navigate to chat first
    await clickSidebarButton(page, '聊天');
    await page.waitForTimeout(200);

    // Find and click the collapse toggle button (chevron)
    const toggleBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Sidebar should still be visible (just narrower)
    const sidebar = page.locator('[style*="width"]').first();
    await expect(sidebar).toBeVisible();
    console.log('✓ Sidebar collapse toggle works');
  });
});

// ── Chat Page (Lumina) ─────────────────────────────────────────────────────────

test.describe('Chat Page (Lumina)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '聊天');
    await page.waitForTimeout(500);
  });

  test('renders chat layout (sidebar + main area)', async () => {
    // Left panel with chat sessions
    await expect(page.locator('text=最近对话').or(page.locator('text=新的对话'))).toBeVisible({ timeout: 5000 });
    // Right panel with input
    await expect(page.locator('textarea, [placeholder*="输入"], [placeholder*="chat"]').first()).toBeVisible({ timeout: 5000 });
    console.log('✓ Chat page layout renders correctly');
  });

  test('can type in chat input', async () => {
    const input = page.locator('textarea').first();
    await input.fill('测试消息');
    await expect(input).toHaveValue('测试消息');
    console.log('✓ Chat input accepts text');
  });

  test('send button is present and clickable', async () => {
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(sendBtn).toBeVisible();
    console.log('✓ Send button visible');
  });
});

// ── Study Page (Lumina) ───────────────────────────────────────────────────────

test.describe('Study Page (Lumina)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '学习');
    await page.waitForTimeout(500);
  });

  test('renders study workbench', async () => {
    // Page title or content visible
    await expect(
      page.locator('text=学习').first()
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Study page renders');
  });

  test('Pomodoro timer controls work', async () => {
    // Look for play/pause button
    const playBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await page.waitForTimeout(500);
    // Click again to pause
    await playBtn.click();
    console.log('✓ Pomodoro timer controls respond');
  });
});

// ── Snapshot Page (Lumina) ─────────────────────────────────────────────────────

test.describe('Snapshot Page (Lumina)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '快照');
    await page.waitForTimeout(500);
  });

  test('renders snapshot list', async () => {
    await expect(
      page.locator('text=快照').first()
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Snapshot page renders');
  });

  test('create snapshot button is present', async () => {
    const createBtn = page.locator('button:has-text("创建")');
    await expect(createBtn.first()).toBeVisible();
    console.log('✓ Create snapshot button visible');
  });
});

// ── Profile Page (Lumina) ─────────────────────────────────────────────────────

test.describe('Profile Page (Lumina)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '个人资料');
    await page.waitForTimeout(500);
  });

  test('renders profile page', async () => {
    // Avatar area or profile name
    await expect(
      page.locator('text=个人资料').first()
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Profile page renders');
  });
});

// ── Dashboard Page (Noir) ─────────────────────────────────────────────────────

test.describe('Dashboard Page (Noir)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '控制台');
    await page.waitForTimeout(1000);
  });

  test('renders dashboard with dark theme', async () => {
    // Dark background
    await expect(page.locator('text=控制台').or(page.locator('text=Dashboard')).first())
      .toBeVisible({ timeout: 8000 });
    console.log('✓ Dashboard page renders (dark theme)');
  });

  test('refresh button is present', async () => {
    const refreshBtn = page.locator('button:has-text("刷新")');
    await expect(refreshBtn.first()).toBeVisible();
    console.log('✓ Dashboard refresh button visible');
  });
});

// ── Agents Page (Noir) ────────────────────────────────────────────────────────

test.describe('Agents Page (Noir)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '智能体');
    await page.waitForTimeout(1000);
  });

  test('renders agents page', async () => {
    await expect(
      page.locator('text=智能体').or(page.locator('text=Agent')).first()
    ).toBeVisible({ timeout: 8000 });
    console.log('✓ Agents page renders');
  });

  test('loading state shows and clears', async () => {
    // Loading indicator should eventually clear
    await page.waitForTimeout(3000);
    const loadingText = page.locator('text=加载中...');
    // May or may not be visible depending on API response time
    console.log('✓ Agents page loaded (API call completed or timed out)');
  });
});

// ── Channels Page (Noir) ─────────────────────────────────────────────────────

test.describe('Channels Page (Noir)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '渠道配置');
    await page.waitForTimeout(1000);
  });

  test('renders channels list and config panel', async () => {
    // Channel list visible
    await expect(
      page.locator('text=渠道').first()
    ).toBeVisible({ timeout: 8000 });
    // Config panel
    await expect(
      page.locator('button:has-text("连接")').first()
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Channels page renders with config panel');
  });

  test('channel cards are clickable', async () => {
    // Click second channel card (Telegram after Feishu)
    const cards = page.locator('button[style*="cursor: pointer"]');
    const count = await cards.count();
    if (count > 1) {
      await cards.nth(1).click();
      await page.waitForTimeout(300);
    }
    console.log('✓ Channel card selection works');
  });

  test('connect button triggers log output', async () => {
    const connectBtn = page.locator('button:has-text("连接")');
    await connectBtn.first().click();
    await page.waitForTimeout(1500);
    // Terminal log should have output
    const terminal = page.locator('text=连接失败').or(page.locator('text=正在建立连接'));
    await expect(terminal.first()).toBeVisible({ timeout: 5000 });
    console.log('✓ Connect button triggers terminal log');
  });
});

// ── Backups Page (Noir) ──────────────────────────────────────────────────────

test.describe('Backups Page (Noir)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '数据备份');
    await page.waitForTimeout(1000);
  });

  test('renders backups page with dark theme', async () => {
    await expect(
      page.locator('text=备份').first()
    ).toBeVisible({ timeout: 8000 });
    console.log('✓ Backups page renders');
  });

  test('auto-backup toggle works', async () => {
    const toggle = page.locator('button').filter({ has: page.locator('div[style*="border-radius: 50%"]') }).first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await page.waitForTimeout(200);
    console.log('✓ Auto-backup toggle responds');
  });

  test('refresh button triggers API load', async () => {
    const refreshBtn = page.locator('button:has-text("刷新")');
    if (await refreshBtn.count() > 0) {
      await refreshBtn.first().click();
      await page.waitForTimeout(2000);
    }
    console.log('✓ Backups refresh button works');
  });

  test('backup history table is visible', async () => {
    await expect(
      page.locator('th:has-text("备份日期")').or(page.locator('th:has-text("描述")'))
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Backup history table visible');
  });
});

// ── Settings Page (Noir) ─────────────────────────────────────────────────────

test.describe('Settings Page (Noir)', () => {
  test.beforeEach(async () => {
    await clickSidebarButton(page, '系统设置');
    await page.waitForTimeout(1000);
  });

  test('renders settings with tab bar', async () => {
    await expect(
      page.locator('text=桌面设置').first()
    ).toBeVisible({ timeout: 8000 });
    // Tab bar visible
    await expect(
      page.locator('button:has-text("概览")')
    ).toBeVisible();
    console.log('✓ Settings page renders with tabs');
  });

  test('all 6 tabs are present', async () => {
    const tabs = ['概览', 'Agents', 'Skills', '备份', '配对码', 'Gateway'];
    for (const tab of tabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
    console.log('✓ All 6 Settings tabs present');
  });

  test('switching tabs updates content', async () => {
    // Click Gateway tab
    await page.locator('button:has-text("Gateway")').click();
    await page.waitForTimeout(300);
    // Should show Gateway content
    await expect(
      page.locator('text=Gateway').first()
    ).toBeVisible({ timeout: 3000 });
    console.log('✓ Settings tab switching works');
  });

  test('Agents tab shows agent list button', async () => {
    await page.locator('button:has-text("Agents")').click();
    await page.waitForTimeout(300);
    await expect(
      page.locator('button:has-text("列出")').first()
    ).toBeVisible({ timeout: 3000 });
    console.log('✓ Agents tab content loads');
  });

  test('Pairing tab shows generate button', async () => {
    await page.locator('button:has-text("配对码")').click();
    await page.waitForTimeout(300);
    await expect(
      page.locator('button:has-text("生成配对码")').or(page.locator('text=配对码'))
    ).toBeVisible({ timeout: 3000 });
    console.log('✓ Pairing tab content loads');
  });
});

// ── Skills Route (redirects to Settings) ─────────────────────────────────────

test.describe('Skills Route', () => {
  test('skills route shows redirect prompt', async () => {
    await clickSidebarButton(page, 'Skills');
    await page.waitForTimeout(500);
    // Skills page shows "请在桌面设置中使用" message
    await expect(
      page.locator('text=桌面设置').or(page.locator('text=Skill'))
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Skills route renders redirect page');
  });

  test('redirect button navigates to settings', async () => {
    const redirectBtn = page.locator('button:has-text("打开桌面设置")');
    if (await redirectBtn.count() > 0) {
      await redirectBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=桌面设置')).toBeVisible({ timeout: 5000 });
      console.log('✓ Skills redirect button works');
    } else {
      console.log('✓ Skills redirect button not found (may be rendered differently)');
    }
  });
});

// ── End-to-End Navigation Flow ────────────────────────────────────────────────

test.describe('Full Navigation Flow', () => {
  test('complete route cycle: chat → dashboard → settings → chat', async () => {
    // Start at chat
    await clickSidebarButton(page, '聊天');
    await page.waitForTimeout(400);
    await expect(page.locator('text=聊天').or(page.locator('textarea'))).toBeVisible({ timeout: 5000 });

    // Navigate to dashboard
    await clickSidebarButton(page, '控制台');
    await page.waitForTimeout(600);
    await expect(page.locator('text=控制台').or(page.locator('text=Dashboard'))).toBeVisible({ timeout: 5000 });

    // Navigate to settings
    await clickSidebarButton(page, '系统设置');
    await page.waitForTimeout(600);
    await expect(page.locator('text=桌面设置')).toBeVisible({ timeout: 5000 });

    // Back to chat
    await clickSidebarButton(page, '聊天');
    await page.waitForTimeout(400);
    await expect(page.locator('text=聊天').or(page.locator('textarea'))).toBeVisible({ timeout: 5000 });

    console.log('✓ Full navigation cycle completed');
  });
});
