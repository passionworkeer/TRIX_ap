import { chromium } from '@playwright/test';

const webBaseUrl = (process.env.WEB_BASE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceUrl = (process.env.TRIX_SERVICE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceToken = process.env.TRIX_SERVICE_TOKEN;
const email = process.env.TRIX_TEST_EMAIL ?? 'david@trix.app';
const password = process.env.TRIX_TEST_PASSWORD ?? 'trix2026';

if (!serviceToken) {
  throw new Error('TRIX_SERVICE_TOKEN is required');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createPairing(label = 'native-burst-check') {
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

async function waitForUsableSession(page, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = await readNativeSession(page);
    if (session?.conversationId && session?.clientToken) {
      try {
        await fetchHistory(session.conversationId, session.clientToken);
        return session;
      } catch {
        // continue polling
      }
    }
    await page.waitForTimeout(1000);
  }

  throw new Error('Timed out waiting for native session restore');
}

async function ensurePairedSession(page, pairingCode) {
  await page.goto(`${webBaseUrl}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const existing = await readNativeSession(page);
  if (existing?.conversationId && existing?.clientToken) {
    return await waitForUsableSession(page);
  }

  await pair(page, pairingCode);
  return await waitForUsableSession(page);
}

async function sendTextViaUi(page, text) {
  const textarea = page.locator('textarea').first();
  const sendButton = page.locator('button[aria-label="发送消息"], button[aria-label="Send Message"]').first();
  await textarea.fill(text);
  await sendButton.click();
}

async function main() {
  const pairing = await createPairing();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page);
    const session = await ensurePairedSession(page, pairing.code);

    const baselineHistory = await fetchHistory(session.conversationId, session.clientToken);
    const baselineIds = new Set((baselineHistory.messages ?? []).map((entry) => entry.id));
    const burstSeed = Date.now();
    const burstMessages = [
      `突发消息 A ${burstSeed}`,
      `突发消息 B ${burstSeed}`,
      `突发消息 C ${burstSeed}`,
    ];

    for (const text of burstMessages) {
      await sendTextViaUi(page, text);
      await page.waitForTimeout(120);
    }

    const deadline = Date.now() + 180000;
    let finalMessages = [];
    let replyCount = 0;

    while (Date.now() < deadline) {
      const history = await fetchHistory(session.conversationId, session.clientToken);
      finalMessages = Array.isArray(history.messages) ? history.messages : [];
      const newMessages = finalMessages.filter((entry) => !baselineIds.has(entry.id));
      const userMessages = newMessages.filter((entry) => entry.senderId?.startsWith('openclaw:') !== true);
      const botReplies = newMessages.filter((entry) => entry.senderId?.startsWith('openclaw:') === true);

      const burstUserMessages = userMessages.filter((entry) => burstMessages.includes(entry.text));
      replyCount = botReplies.length;

      if (burstUserMessages.length === burstMessages.length && botReplies.length >= 1) {
        await sleep(12000);
        const stabilizedHistory = await fetchHistory(session.conversationId, session.clientToken);
        finalMessages = Array.isArray(stabilizedHistory.messages) ? stabilizedHistory.messages : [];
        const stabilizedNew = finalMessages.filter((entry) => !baselineIds.has(entry.id));
        const stabilizedBotReplies = stabilizedNew.filter((entry) => entry.senderId?.startsWith('openclaw:') === true);
        replyCount = stabilizedBotReplies.length;
        break;
      }

      await sleep(1500);
    }

    if (page.url().includes('/login')) {
      throw new Error(`Unexpected redirect to login after burst send: ${page.url()}`);
    }

    const newMessages = finalMessages.filter((entry) => !baselineIds.has(entry.id));
    const burstUserMessages = newMessages.filter((entry) => burstMessages.includes(entry.text));
    const botReplies = newMessages.filter((entry) => entry.senderId?.startsWith('openclaw:') === true);

    if (burstUserMessages.length !== burstMessages.length) {
      throw new Error(`Expected ${burstMessages.length} burst user messages, got ${burstUserMessages.length}`);
    }
    if (botReplies.length === 0) {
      throw new Error('No bot reply received after burst send');
    }
    if (botReplies.length !== 1) {
      throw new Error(`Expected exactly 1 bot reply after burst debounce, got ${botReplies.length}`);
    }

    console.log(JSON.stringify({
      ok: true,
      pairingCode: pairing.code,
      conversationId: session.conversationId,
      burstUserMessageCount: burstUserMessages.length,
      burstBotReplyCount: botReplies.length,
      replyPreview: String(botReplies[0]?.text ?? '').slice(0, 160),
      finalUrl: page.url(),
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
