import { chromium, devices } from '@playwright/test';

const webBaseUrl = (process.env.WEB_BASE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceUrl = (process.env.TRIX_SERVICE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceToken = process.env.TRIX_SERVICE_TOKEN;
const email = process.env.TRIX_TEST_EMAIL ?? 'david@trix.app';
const password = process.env.TRIX_TEST_PASSWORD ?? 'trix2026';

if (!serviceToken) {
  throw new Error('TRIX_SERVICE_TOKEN is required');
}

async function createPairing() {
  const response = await fetch(`${serviceUrl}/api/pairings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      accountId: 'default',
      label: 'cross-device-restore',
      ttlMs: 300000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create pairing: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function login(page) {
  await page.goto(`${webBaseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"], #email-input').first().fill(email);
  await page.locator('input[type="password"], #password-input').first().fill(password);
  await page.getByRole('button', { name: /登录|login/i }).first().click();
  await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function pairViaCode(page, pairingCode) {
  await page.goto(`${webBaseUrl}/#/pairing`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    return !text.includes('页面加载中...');
  }, { timeout: 20000 });

  if (/#\/chat\/clawbot/.test(page.url())) {
    await page.locator('textarea').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(4000);
    return;
  }

  const manualButton = page.getByRole('button', { name: '手动输入配对码' });
  if (await manualButton.count()) {
    await manualButton.click();
  }

  const codeInput = page.locator('input[placeholder="AB12CD"], input[maxlength="6"]').first();
  await codeInput.waitFor({ timeout: 15000 });
  await codeInput.fill(pairingCode);
  await page.getByRole('button', { name: '验证配对' }).click();
  await page.waitForURL(/#\/chat\/clawbot/, { timeout: 30000 });
  await page.locator('textarea').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(4000);
}

async function ensureDesktopSession(page, pairingCode) {
  await page.goto(`${webBaseUrl}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  let session = await waitForRestoredSession(page, null, 8000);
  if (session?.conversationId && session?.appUserId) {
    await page.locator('textarea').first().waitFor({ timeout: 30000 });
    return session;
  }

  await pairViaCode(page, pairingCode);
  session = await readNativeSession(page);
  if (!session?.conversationId) {
    throw new Error('Desktop pairing session was not persisted');
  }
  return session;
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

async function waitForRestoredSession(page, expectedConversationId = null, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const session = await readNativeSession(page);
    const conversationMatches = expectedConversationId
      ? session?.conversationId === expectedConversationId
      : Boolean(session?.conversationId);
    if (conversationMatches && session?.appUserId) {
      return session;
    }
    await page.waitForTimeout(1000);
  }

  return null;
}

async function waitForBotReply(page, matcher, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const bodyText = await page.locator('body').innerText();
    if (matcher(bodyText)) {
      return bodyText;
    }
    await page.waitForTimeout(1500);
  }

  return null;
}

const browser = await chromium.launch({ headless: true });
const desktopContext = await browser.newContext();
const mobileContext = await browser.newContext({ ...devices['iPhone 13'] });
const desktopPage = await desktopContext.newPage();
const mobilePage = await mobileContext.newPage();

try {
  const pairing = await createPairing();

  await login(desktopPage);
  const desktopCanvasBeforePairing = await desktopPage.evaluate(() => Boolean(document.querySelector('canvas')));
  const desktopSession = await ensureDesktopSession(desktopPage, pairing.code);

  await login(mobilePage);
  await mobilePage.goto(`${webBaseUrl}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  const mobileCanvas = await mobilePage.evaluate(() => Boolean(document.querySelector('canvas')));
  const restoredSession = await waitForRestoredSession(mobilePage, desktopSession.conversationId);
  if (!restoredSession) {
    throw new Error('Mobile browser did not restore the paired conversation');
  }

  await mobilePage.locator('textarea').first().waitFor({ timeout: 30000 });
  await mobilePage.locator('textarea').first().fill('/status');
  await mobilePage.locator('button[aria-label="发送消息"], button[aria-label="Send Message"]').first().click();

  const replyText = await waitForBotReply(mobilePage, (text) => text.includes('OpenClaw'));
  if (!replyText) {
    throw new Error('Restored mobile session did not receive /status reply');
  }

  console.log(JSON.stringify({
    ok: true,
    pairingCode: pairing.code,
    desktopConversationId: desktopSession.conversationId,
    desktopAppUserId: desktopSession.appUserId ?? null,
    mobileConversationId: restoredSession.conversationId,
    mobileAppUserId: restoredSession.appUserId,
    desktopCanvasBeforePairing,
    mobileCanvas,
    mobileUrl: mobilePage.url(),
  }, null, 2));
} finally {
  await mobileContext.close();
  await desktopContext.close();
  await browser.close();
}
