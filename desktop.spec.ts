import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { DESKTOP_TARGET, ELECTRON_ARGS, ELECTRON_PATH } from './playwright-desktop.config';

type RouteExpectation = {
  label: string;
  expectedText: string | string[];
  timeout?: number;
};

let app: ElectronApplication | undefined;
let page: Page | undefined;

const luminaRoutes: RouteExpectation[] = [
  { label: '学习', expectedText: '学习工作台' },
  { label: '快照', expectedText: '系统快照存档' },
  { label: '地图', expectedText: '代理分布图' },
  { label: '个人资料', expectedText: 'TRIX 用户' },
];

const managementRoutes: RouteExpectation[] = [
  { label: '控制台', expectedText: ['管理 Gateway、Agent 与消息渠道', '加载系统状态...'] },
  { label: '智能体', expectedText: 'Agent 管理' },
  { label: '渠道配置', expectedText: '管理 TRIX Companion 的第三方消息渠道' },
  { label: '数据备份', expectedText: '数据备份与恢复' },
];

async function waitForMainWindow(electronApp: ElectronApplication): Promise<Page> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = electronApp.windows().find((windowPage) => {
      const url = windowPage.url();
      return Boolean(url)
        && !url.startsWith('devtools://')
        && !url.includes('float.html')
        && url.includes('main.html');
    });

    if (candidate) {
      await candidate.waitForLoadState('domcontentloaded').catch(() => {});
      return candidate;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Timed out waiting for the desktop main window.');
}

async function waitForDesktopShell(targetPage: Page): Promise<void> {
  await expect(targetPage.locator('text=TRIX Companion')).toBeVisible({ timeout: 15_000 });
  await expect(targetPage.locator('button', { hasText: '聊天' }).first()).toBeVisible({ timeout: 15_000 });
  await expect(targetPage.locator('button', { hasText: '系统设置' }).first()).toBeVisible({ timeout: 15_000 });
}

async function launchDesktopApp(): Promise<{ electronApp: ElectronApplication; mainPage: Page }> {
  const electronApp = await electron.launch({
    executablePath: ELECTRON_PATH,
    args: [...ELECTRON_ARGS],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TRIX_PLAYWRIGHT_E2E: '1',
    },
  });

  const mainPage = await waitForMainWindow(electronApp);
  await waitForDesktopShell(mainPage);
  return { electronApp, mainPage };
}

async function forceQuitApp(electronApp?: ElectronApplication): Promise<void> {
  if (!electronApp) {
    return;
  }

  const child = electronApp.process();
  const exitPromise = child.exitCode !== null
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        child.once('exit', () => resolve());
      });

  try {
    await electronApp.evaluate(({ app: electronMainApp }) => {
      electronMainApp.exit(0);
    });
  } catch {
    // Ignore failures here and fall back to process termination below.
  }

  await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);

  if (child.exitCode === null && !child.killed) {
    child.kill('SIGTERM');
    await Promise.race([
      exitPromise,
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
}

function currentPage(): Page {
  if (!page) {
    throw new Error('Desktop page is not available.');
  }

  return page;
}

async function navigateToRoute(route: RouteExpectation): Promise<void> {
  const targetPage = currentPage();
  await targetPage.locator('button', { hasText: route.label }).first().click();
  const expectedTexts = Array.isArray(route.expectedText) ? route.expectedText : [route.expectedText];

  await expect
    .poll(
      async () => {
        const bodyText = await targetPage.locator('body').innerText();
        return expectedTexts.some((text) => bodyText.includes(text));
      },
      { timeout: route.timeout ?? 15_000 },
    )
    .toBe(true);
}

test.skip(
  DESKTOP_TARGET === 'packaged',
  'Packaged desktop smoke tests are source-driven. Use the default repo target or rebuild the package first.',
);

test.beforeEach(async () => {
  const launched = await launchDesktopApp();
  app = launched.electronApp;
  page = launched.mainPage;
});

test.afterEach(async () => {
  await forceQuitApp(app);
  app = undefined;
  page = undefined;
});

test('renders title bar and core navigation', async () => {
  const targetPage = currentPage();

  await expect(targetPage.locator('button[title="最小化到托盘"]')).toBeVisible();
  await expect(targetPage.locator('button[title="关闭"]')).toBeVisible();
  await expect(targetPage.locator('button[title="收起侧边栏"]')).toBeVisible();
  await expect(targetPage.locator('body')).toContainText('功能');
  await expect(targetPage.locator('body')).toContainText('管理');
});

test('chat route renders composer and conversation list', async () => {
  const targetPage = currentPage();

  await expect(targetPage.locator('body')).toContainText('最近对话');
  await expect(targetPage.locator('body')).toContainText('TRIX Native');

  const composer = targetPage.locator('textarea[placeholder*="TRIX"]').first();
  await composer.fill('桌面端 smoke test');
  await expect(composer).toHaveValue('桌面端 smoke test');
  await expect(targetPage.locator('button[title="发送"]').first()).toBeEnabled();
});

test('desktop native IPC uses real conversations and real multimodal message sends', async () => {
  const targetPage = currentPage();
  const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pQ2kAAAAASUVORK5CYII=';
  const wavBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';
  const textFileBase64 = 'ZGVza3RvcCBuYXRpdmUgZmlsZSBjaGVjawo=';
  const marker = `desktop-native-${Date.now()}`;

  const initial = await targetPage.evaluate(async () => {
    const api = (window as unknown as { electronAPI?: any }).electronAPI;
    if (!api) {
      return { ok: false, reason: 'missing-electron-api' };
    }

    const conversations = await api.listConversations();
    if (!conversations?.success || !Array.isArray(conversations.data)) {
      return { ok: false, reason: 'list-conversations-failed', conversations };
    }

    const realConversation = conversations.data.find((entry: { id?: string }) =>
      typeof entry?.id === 'string' && entry.id.startsWith('conv_'),
    );

    if (!realConversation) {
      return { ok: false, reason: 'no-real-conversation', conversations };
    }

    const messages = await api.fetchMessages(realConversation.id);
    return {
      ok: true,
      conversations,
      realConversation,
      messages,
    };
  });

  expect(initial.ok).toBe(true);
  expect(initial.conversations.data.length).toBeGreaterThan(0);
  expect(initial.conversations.data.every((entry: { id: string }) => !entry.id.startsWith('demo-') && !entry.id.startsWith('local-'))).toBe(true);
  expect(initial.realConversation.id.startsWith('conv_')).toBe(true);
  expect(initial.messages.success).toBe(true);
  expect(Array.isArray(initial.messages.data)).toBe(true);

  const textSend = await targetPage.evaluate(async ({ conversationId, markerText }) => {
    const api = (window as unknown as { electronAPI?: any }).electronAPI;
    return await api.sendMessage(conversationId, markerText);
  }, {
    conversationId: initial.realConversation.id,
    markerText: marker,
  });

  expect(textSend.success).toBe(true);
  expect(textSend.data.content).toContain(marker);
  expect(textSend.data.direction).toBe('outgoing');

  await expect
    .poll(async () => {
      const result = await targetPage.evaluate(async (conversationId) => {
        const api = (window as unknown as { electronAPI?: any }).electronAPI;
        return await api.fetchMessages(conversationId);
      }, initial.realConversation.id);
      if (!result?.success || !Array.isArray(result.data)) {
        return false;
      }
      return result.data.some((entry: { content?: string }) => entry.content?.includes(marker));
    }, { timeout: 20_000 })
    .toBe(true);

  const imageMarker = `${marker}-image`;
  const imageSend = await targetPage.evaluate(async ({ conversationId, nextImageMarker, contentBase64 }) => {
    const api = (window as unknown as { electronAPI?: any }).electronAPI;
    return await api.sendImageMessage(conversationId, {
      fileName: 'desktop-native-check.png',
      mimeType: 'image/png',
      contentBase64,
      text: nextImageMarker,
    });
  }, {
    conversationId: initial.realConversation.id,
    nextImageMarker: imageMarker,
    contentBase64: tinyPngBase64,
  });

  expect(imageSend.success).toBe(true);
  expect(imageSend.data.direction).toBe('outgoing');
  expect(Array.isArray(imageSend.data.attachments)).toBe(true);
  expect(imageSend.data.attachments[0]?.type).toBe('image');

  await expect
    .poll(async () => {
      const result = await targetPage.evaluate(async (conversationId) => {
        const api = (window as unknown as { electronAPI?: any }).electronAPI;
        return await api.fetchMessages(conversationId);
      }, initial.realConversation.id);

      if (!result?.success || !Array.isArray(result.data)) {
        return false;
      }

      return result.data.some((entry: {
        content?: string;
        attachments?: Array<{ type?: string; url?: string }>;
      }) => entry.content?.includes(imageMarker)
        && Array.isArray(entry.attachments)
        && entry.attachments.some((attachment) =>
          attachment.type === 'image'
          && typeof attachment.url === 'string'
          && (
            attachment.url.includes('/api/attachments/')
            || attachment.url.includes('/api/service/attachments/')
          ),
        ));
    }, { timeout: 20_000 })
    .toBe(true);

  const fileMarker = `${marker}-file`;
  const fileSend = await targetPage.evaluate(async ({ conversationId, nextFileMarker, contentBase64 }) => {
    const api = (window as unknown as { electronAPI?: any }).electronAPI;
    return await api.sendAttachmentMessage(conversationId, {
      fileName: 'desktop-native-check.txt',
      mimeType: 'text/plain',
      contentBase64,
      kind: 'file',
      text: nextFileMarker,
    });
  }, {
    conversationId: initial.realConversation.id,
    nextFileMarker: fileMarker,
    contentBase64: textFileBase64,
  });

  expect(fileSend.success).toBe(true);
  expect(fileSend.data.direction).toBe('outgoing');
  expect(Array.isArray(fileSend.data.attachments)).toBe(true);
  expect(fileSend.data.attachments[0]?.type).toBe('file');

  await expect
    .poll(async () => {
      const result = await targetPage.evaluate(async (conversationId) => {
        const api = (window as unknown as { electronAPI?: any }).electronAPI;
        return await api.fetchMessages(conversationId);
      }, initial.realConversation.id);

      if (!result?.success || !Array.isArray(result.data)) {
        return false;
      }

      return result.data.some((entry: {
        content?: string;
        attachments?: Array<{ type?: string; url?: string; name?: string }>;
      }) => entry.content?.includes(fileMarker)
        && Array.isArray(entry.attachments)
        && entry.attachments.some((attachment) =>
          attachment.type === 'file'
          && attachment.name === 'desktop-native-check.txt'
          && typeof attachment.url === 'string'
          && attachment.url.length > 0,
        ));
    }, { timeout: 20_000 })
    .toBe(true);

  const audioMarker = `${marker}-audio`;
  const audioSend = await targetPage.evaluate(async ({ conversationId, nextAudioMarker, contentBase64 }) => {
    const api = (window as unknown as { electronAPI?: any }).electronAPI;
    return await api.sendAttachmentMessage(conversationId, {
      fileName: 'desktop-native-check.wav',
      mimeType: 'audio/wav',
      contentBase64,
      kind: 'audio',
      text: nextAudioMarker,
    });
  }, {
    conversationId: initial.realConversation.id,
    nextAudioMarker: audioMarker,
    contentBase64: wavBase64,
  });

  expect(audioSend.success).toBe(true);
  expect(audioSend.data.direction).toBe('outgoing');
  expect(Array.isArray(audioSend.data.attachments)).toBe(true);
  expect(audioSend.data.attachments[0]?.type).toBe('audio');

  await expect
    .poll(async () => {
      const result = await targetPage.evaluate(async (conversationId) => {
        const api = (window as unknown as { electronAPI?: any }).electronAPI;
        return await api.fetchMessages(conversationId);
      }, initial.realConversation.id);

      if (!result?.success || !Array.isArray(result.data)) {
        return false;
      }

      return result.data.some((entry: {
        content?: string;
        attachments?: Array<{ type?: string; url?: string; name?: string }>;
      }) => entry.content?.includes(audioMarker)
        && Array.isArray(entry.attachments)
        && entry.attachments.some((attachment) =>
          attachment.type === 'audio'
          && attachment.name === 'desktop-native-check.wav'
          && typeof attachment.url === 'string'
          && attachment.url.length > 0,
        ));
    }, { timeout: 20_000 })
    .toBe(true);
});

for (const route of luminaRoutes) {
  test(`renders Lumina route: ${route.label}`, async () => {
    await navigateToRoute(route);
  });
}

for (const route of managementRoutes) {
  test(`renders management route: ${route.label}`, async () => {
    await navigateToRoute(route);
  });
}

test('settings overview loads app info without missing IPC errors', async () => {
  const targetPage = currentPage();

  await navigateToRoute({ label: '系统设置', expectedText: '桌面设置' });
  await expect(targetPage.locator('body')).toContainText('概览');
  await expect(targetPage.locator('body')).toContainText('配对码');
  await expect(targetPage.locator('body')).toContainText('Gateway');
  await expect(targetPage.locator('body')).toContainText('Electron');
  await expect(targetPage.locator('body')).not.toContainText("No handler registered for 'app:info'");
});
