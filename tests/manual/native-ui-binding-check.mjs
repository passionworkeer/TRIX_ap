import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const webBaseUrl = (process.env.WEB_BASE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceUrl = (process.env.TRIX_SERVICE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceToken = process.env.TRIX_SERVICE_TOKEN;
const email = process.env.TRIX_TEST_EMAIL ?? 'david@trix.app';
const password = process.env.TRIX_TEST_PASSWORD ?? 'trix2026';

if (!serviceToken) {
  throw new Error('TRIX_SERVICE_TOKEN is required');
}

const artifactDir = '/tmp/trix-native-ui-binding-check';
mkdirSync(artifactDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createPairing(label = 'native-ui-binding-check') {
  const response = await fetch(`${serviceUrl}/api/pairings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      accountId: 'default',
      label,
      ttlMs: 300000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create pairing: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function fetchHistory(conversationId, clientToken) {
  const response = await fetch(`${serviceUrl}/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    headers: {
      'x-trix-client-token': clientToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function waitForBotReply(conversationId, clientToken, baselineMessageIds, matcher, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  let latestMessages = [];

  while (Date.now() < deadline) {
    const history = await fetchHistory(conversationId, clientToken);
    const messages = Array.isArray(history.messages) ? history.messages : [];
    latestMessages = messages;

    const botMessage = messages.find((entry) => {
      if (baselineMessageIds.has(entry.id)) {
        return false;
      }
      if (entry.senderId?.startsWith('openclaw:') !== true) {
        return false;
      }
      return matcher(entry);
    });

    if (botMessage) {
      return { message: botMessage, messages };
    }

    await sleep(1500);
  }

  return { message: null, messages: latestMessages };
}

async function waitForAuthReady(page, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const authKey = Object.keys(localStorage).find((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
      const authToken = authKey ? localStorage.getItem(authKey) : null;
      const text = document.body?.innerText ?? '';
      return {
        hasAuthToken: Boolean(authToken),
        hasLoginWarning: text.includes('请先登录以访问此页面'),
      };
    });
    if (state.hasAuthToken && !state.hasLoginWarning) {
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error('Timed out waiting for auth state to stabilize');
}

async function login(page) {
  await page.goto(`${webBaseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  const alreadyAuthenticated = await waitForAuthReady(page, 10000).then(() => true).catch(() => false);
  if (!alreadyAuthenticated) {
    await page.locator('#email-input:visible').first().fill(email);
    await page.locator('#password-input:visible').first().fill(password);
    await page.locator('button[type="button"]:visible').first().click();
    await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 }).catch(() => {});
    await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
    await waitForAuthReady(page);
    return;
    await page.locator('button:visible').filter({ hasText: /鐧诲綍|login/i }).first().click();
    await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 }).catch(() => {});
  }
  await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
  await waitForAuthReady(page);
  return;

  await page.goto(`${webBaseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"], #email-input').first().fill(email);
  await page.locator('input[type="password"], #password-input').first().fill(password);
  await page.getByRole('button', { name: /登录|login/i }).first().click();
  await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 });
  await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
  await waitForAuthReady(page);
}

async function pair(page, pairingCode) {
  await page.goto(`${webBaseUrl}/#/pairing`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    return !text.includes('页面加载中...');
  }, { timeout: 20000 });

  const manualButton = page.getByRole('button', { name: '手动输入配对码' });
  if (await manualButton.count()) {
    await manualButton.click();
  }

  const codeInput = page.locator('input[placeholder="AB12CD"]');
  await codeInput.waitFor({ timeout: 15000 });
  await codeInput.fill(pairingCode);
  await page.getByRole('button', { name: '验证配对' }).click();
  await page.waitForURL(/#\/chat\/clawbot/, { timeout: 30000 });
  await page.locator('textarea').first().waitFor({ timeout: 30000 });
}

async function readNativeSession(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('trix_native_channel_sessions_v2');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const activeAccountId = parsed.activeAccountId || 'default';
    return parsed.sessions?.[activeAccountId] || null;
  });
}

async function ensurePairedSession(page, pairingCode) {
  await page.goto(`${webBaseUrl}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  let session = await readNativeSession(page);
  if (session?.conversationId && session?.clientToken) {
    return session;
  }
  await pair(page, pairingCode);
  session = await readNativeSession(page);
  if (!session?.conversationId || !session?.clientToken) {
    throw new Error('Native session was not persisted after pairing');
  }
  return session;
}

async function waitForUsableSession(page, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    const session = await readNativeSession(page);
    if (session?.conversationId && session?.clientToken) {
      try {
        await fetchHistory(session.conversationId, session.clientToken);
        return session;
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(1000);
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Timed out waiting for a usable native session');
}

async function waitForNonIdleHomeState(page, timeoutMs = 120000) {
  await page.waitForFunction(() => {
    const homeState = document.querySelector('[data-testid="home-bot-bubble"]')?.getAttribute('data-bot-state');
    const heroState = document.querySelector('[data-hero-background]')?.getAttribute('data-bot-state');
    return [homeState, heroState].some((state) => state === 'THINKING' || state === 'SPEAKING');
  }, { timeout: timeoutMs });
}

const pairing = await createPairing();
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext();
await context.addInitScript(() => {
  window.__trixAudioPlayCalls = [];
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function playWrapped(...args) {
    window.__trixAudioPlayCalls.push({
      tagName: this.tagName,
      src: this.currentSrc || this.src || '',
      at: Date.now(),
    });
    return originalPlay.apply(this, args);
  };
});

const page = await context.newPage();
const ttsRequests = [];

page.on('request', (request) => {
  if (request.url().includes('/api/tts/synthesize')) {
    ttsRequests.push({
      method: request.method(),
      url: request.url(),
      at: new Date().toISOString(),
    });
  }
});

try {
  await login(page);
  await ensurePairedSession(page, pairing.code);
  const session = await waitForUsableSession(page);

  await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="home-bot-bubble"]').waitFor({ timeout: 30000 });
  await page.locator('[data-hero-background]').waitFor({ timeout: 30000 });

  const hasCanvas = await page.evaluate(() => Boolean(document.querySelector('canvas')));
  if (hasCanvas) {
    throw new Error('Home screen still rendered a canvas/3D shell');
  }

  const homeToken = `HOME_UI_${Date.now()}`;
  const baselineHome = new Set((await fetchHistory(session.conversationId, session.clientToken)).messages.map((entry) => entry.id));
  await page.getByTestId('home-bot-collapsed-trigger').click();
  await page.locator('[data-testid="home-bot-bubble"] input[type="text"]').fill(`请只回复 ${homeToken}`);
  await page.locator('[data-testid="home-bot-bubble"] button[aria-label="发送消息"], [data-testid="home-bot-bubble"] button[aria-label="Send Message"]').first().click();

  await waitForNonIdleHomeState(page);
  await page.locator('[data-testid="home-bot-typing-indicator"]').waitFor({ timeout: 30000 });

  const homeReply = await waitForBotReply(
    session.conversationId,
    session.clientToken,
    baselineHome,
    (entry) => typeof entry.text === 'string' && entry.text.includes(homeToken),
    180000,
  );
  if (!homeReply.message) {
    throw new Error('No home-screen bot reply received');
  }

  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    return !text.includes('页面加载中...');
  });

  await page.waitForFunction(() => {
    const bubble = document.querySelector('[data-testid="home-bot-bubble"]');
    return bubble?.getAttribute('data-bot-state') === 'SPEAKING' || bubble?.getAttribute('data-bot-state') === 'IDLE';
  }, { timeout: 30000 });

  await page.waitForFunction(() => window.__trixAudioPlayCalls.length > 0, { timeout: 120000 });

  const homeSnapshot = await page.evaluate(() => ({
    homeState: document.querySelector('[data-testid="home-bot-bubble"]')?.getAttribute('data-bot-state') ?? null,
    heroState: document.querySelector('[data-hero-background]')?.getAttribute('data-bot-state') ?? null,
    audioPlayCalls: window.__trixAudioPlayCalls,
  }));

  await page.screenshot({ path: path.join(artifactDir, 'home-ui-binding.png'), fullPage: true });

  await page.goto(`${webBaseUrl}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  await page.locator('textarea').first().waitFor({ timeout: 30000 });

  const chatToken = `CHAT_UI_${Date.now()}`;
  const baselineChat = new Set((await fetchHistory(session.conversationId, session.clientToken)).messages.map((entry) => entry.id));
  await page.locator('textarea').first().fill(`请只回复 ${chatToken}`);
  await page.locator('button[aria-label="发送消息"], button[aria-label="Send Message"]').first().click();

  await page.getByTestId('chat-bot-loading-bubble').waitFor({ timeout: 30000 });
  const chatReply = await waitForBotReply(
    session.conversationId,
    session.clientToken,
    baselineChat,
    (entry) => typeof entry.text === 'string' && entry.text.includes(chatToken),
    180000,
  );
  if (!chatReply.message) {
    throw new Error('No chat bot reply received');
  }
  await page.waitForFunction(() => !document.querySelector('[data-testid="chat-bot-loading-bubble"]'), { timeout: 30000 });

  await page.screenshot({ path: path.join(artifactDir, 'chat-ui-binding.png'), fullPage: true });

  console.log(JSON.stringify({
    ok: true,
    pairingCode: pairing.code,
    conversationId: session.conversationId,
    ttsRequestCount: ttsRequests.length,
    audioPlayCallCount: Array.isArray(homeSnapshot.audioPlayCalls) ? homeSnapshot.audioPlayCalls.length : 0,
    finalHomeState: homeSnapshot.homeState,
    finalHeroState: homeSnapshot.heroState,
    screenshotsDir: artifactDir,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
