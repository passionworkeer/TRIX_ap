const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('playwright');

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true, quiet: true });

const EMAIL = process.env.TRIX_TEST_EMAIL || 'david@trix.app';
const PASSWORD = process.env.TRIX_TEST_PASSWORD || 'trix2026';
const BASE_URL = process.env.TRIX_WEB_BASE_URL || 'http://localhost:5173';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const PAIRING_CODE = process.env.TRIX_PAIRING_CODE || '';
const DIRECT_CLAIM = process.env.TRIX_DIRECT_CLAIM === '1';
const SEND_TEXT = process.env.TRIX_SEND_TEXT || '';
const SEND_MODE = process.env.TRIX_SEND_MODE || 'home';
const SEND_FILE = process.env.TRIX_SEND_FILE ? path.resolve(process.env.TRIX_SEND_FILE) : '';
const BURST_TEXTS = (() => {
  const raw = process.env.TRIX_BURST_TEXTS || '';
  if (!raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry)).filter(Boolean);
    }
  } catch (error) {
    return raw
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
})();
const BURST_REOPEN_DELAY_MS = Number(process.env.TRIX_BURST_REOPEN_DELAY_MS || '180');
const WAIT_REPLY_MS = Number(process.env.TRIX_WAIT_REPLY_MS || (SEND_FILE ? '240000' : '45000'));

function getSupabaseStorageKey(url) {
  if (!url) {
    return 'sb-auth-token';
  }

  try {
    const hostname = new URL(url).hostname;
    const projectRef = hostname.split('.')[0];
    return `sb-${projectRef}-auth-token`;
  } catch (error) {
    return 'sb-auth-token';
  }
}

const SUPABASE_STORAGE_KEY = getSupabaseStorageKey(SUPABASE_URL);

function clip(value, limit = 400) {
  return String(value || '').slice(0, limit);
}

async function retryPageRead(page, reader, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await reader();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Execution context was destroyed|Target closed|Cannot find context|Frame was detached/i.test(message) || attempt === retries - 1) {
        throw error;
      }
      await page.waitForTimeout(600 * (attempt + 1));
    }
  }

  return '';
}

async function readBodyText(page) {
  return retryPageRead(page, async () =>
    page.evaluate(() => document.body?.innerText || ''),
  );
}

async function createSupabaseSession() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`supabase password grant failed: ${response.status} ${clip(body, 300)}`);
  }

  const session = await response.json();
  if (!session?.access_token || !session?.user?.id) {
    throw new Error('supabase password grant returned incomplete session payload');
  }

  return session;
}

async function injectSupabaseSession(page, session) {
  const payload = {
    storageKey: SUPABASE_STORAGE_KEY,
    session,
  };

  await page.addInitScript(({ storageKey, session: nextSession }) => {
    localStorage.setItem('language', 'zh');
    localStorage.setItem('i18nextLng', 'zh');
    localStorage.setItem(storageKey, JSON.stringify(nextSession));
  }, payload);

  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    ({ storageKey }) => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return false;
      }

      try {
        return Boolean(JSON.parse(raw)?.access_token);
      } catch (error) {
        return false;
      }
    },
    { storageKey: SUPABASE_STORAGE_KEY },
    { timeout: 10000 },
  ).catch(() => undefined);

  await page.waitForFunction(
    () => !window.location.hash.includes('/login'),
    null,
    { timeout: 15000 },
  ).catch(() => undefined);

  await page.waitForTimeout(2000);
  return !page.url().includes('/login') && !page.url().includes('#/login');
}

async function ensureLoggedIn(page) {
  try {
    const session = await createSupabaseSession();
    if (session) {
      const injected = await injectSupabaseSession(page, session);
      if (injected) {
        await readAuthState(page);
        return;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[local-native-flow] direct auth bootstrap failed: ${message}`);
  }

  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email-input, input[type="email"], input[placeholder="邮箱"], input[placeholder="邮箱地址"]', { timeout: 15000 });

  const emailInput = page.locator('#email-input, input[type="email"], input[placeholder="邮箱"], input[placeholder="邮箱地址"]').first();
  const passwordInput = page.locator('#password-input, input[type="password"], input[placeholder="密码"]').first();

  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  await page.getByRole('button', { name: /登录(?:\s*→)?|login/i }).first().click();

  await page.waitForFunction(
    () => window.location.hash === '#/' || window.location.hash === '#/pairing',
    null,
    { timeout: 30000 },
  );
  await page.waitForFunction(
    () => {
      const text = document.body ? document.body.innerText : '';
      return !text.includes('页面加载中...');
    },
    null,
    { timeout: 30000 },
  ).catch(() => undefined);
  await page.waitForTimeout(2000);
}

async function openPairingInput(page) {
  await page.goto(`${BASE_URL}/#/pairing`, { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const pageBody = await page.locator('body').innerText().catch(() => '');
  if (pageBody.includes('当前设备已绑定到 TRIX Native')) {
    return 'already-paired';
  }
  await page.waitForFunction(
    () => (document.body && document.body.innerText.includes('手动输入配对码')),
    null,
    { timeout: 20000 },
  );

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((node) =>
      (node.textContent || '').includes('手动输入配对码'));
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('manual pairing button missing');
    }
    button.click();
  });

  await page.waitForSelector('input[placeholder="AB12CD"]', { timeout: 10000 });
  return 'needs-input';
}

async function readAuthState(page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const storage = await page.context().storageState();
      for (const origin of storage.origins || []) {
        for (const entry of origin.localStorage || []) {
          if (!entry.name.startsWith('sb-') || !entry.name.endsWith('-auth-token')) {
            continue;
          }

          const auth = JSON.parse(entry.value);
          if (auth?.access_token && auth?.user?.id) {
            const clientIdEntry = origin.localStorage.find((item) =>
              item.name === 'trix_native_channel_client_id' || item.name === 'trix_native_pair_device_id');
            return {
              accessToken: auth.access_token,
              userId: auth.user.id,
              clientId: clientIdEntry?.value || `web_${Math.random().toString(16).slice(2, 20)}`,
            };
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Execution context was destroyed|Target closed|navigation/i.test(message) || attempt === 5) {
        throw error;
      }
    }

    await page.waitForTimeout(1000 * (attempt + 1));
  }

  throw new Error('auth token missing');
}

async function submitPairingCode(page, code) {
  await page.evaluate((nextCode) => {
    const input = document.querySelector('input[placeholder="AB12CD"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('pairing input missing');
    }
    input.value = nextCode;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, code);

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((node) =>
      (node.textContent || '').includes('验证配对'));
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('pairing submit button missing');
    }
    button.click();
  });
}

async function claimPairingDirectly(page, code) {
  const authState = await readAuthState(page);

  const response = await fetch(`http://127.0.0.1:8788/api/pairings/${encodeURIComponent(code)}/claim`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${authState.accessToken}`,
    },
    body: JSON.stringify({
      accountId: 'default',
      clientId: authState.clientId,
      deviceName: 'Playwright Browser',
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    return { ok: false, status: response.status, payload };
  }

  const sessionPayload = {
    claim: payload,
    userId: authState.userId,
    clientId: authState.clientId,
  };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => undefined);
      await page.evaluate(({ claim, userId, clientId }) => {
        const accountId = claim.accountId || 'default';
        const serverUrl = claim.serverUrl || 'http://127.0.0.1:8788';
        const websocketUrl = claim.websocketUrl || claim.wsUrl || 'ws://127.0.0.1:8788/ws';
        const session = {
          accountId,
          appUserId: userId,
          serverUrl,
          websocketUrl,
          conversationId: claim.conversationId,
          clientToken: claim.clientToken,
          clientId,
          deviceName: 'Playwright Browser',
          pairingCode: claim.pairing?.code,
        };

        localStorage.setItem('trix_native_channel_sessions_v2', JSON.stringify({
          version: 2,
          activeAccountId: accountId,
          sessions: { [accountId]: session },
        }));
        localStorage.setItem('trix_native_channel_active_account', accountId);
        localStorage.setItem('trix_native_channel_session', JSON.stringify(session));
      }, sessionPayload);
      return {
        ok: true,
        payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Execution context was destroyed|Target closed|Cannot find context/i.test(message) || attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }

  return {
    ok: true,
    payload,
  };
}

async function openHomeBotBubble(page) {
  await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.waitForSelector('[data-testid="home-bot-collapsed-trigger"]', { timeout: 15000 });
  await page.getByTestId('home-bot-collapsed-trigger').click();
  await page.waitForTimeout(1000);
}

async function sendHomeBotMessage(page, text) {
  const input = page.locator('input[placeholder], input[type="text"]').first();
  await input.waitFor({ state: 'visible', timeout: 15000 });
  await input.fill(text);
  await page.getByRole('button', { name: /发送消息|send message/i }).click();
}

async function openChatDetail(page) {
  await page.goto(`${BASE_URL}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.waitForSelector('textarea', { timeout: 15000 });
}

async function sendChatDetailMessage(page, text) {
  const input = page.locator('textarea').first();
  await input.fill(text);
  await page.getByRole('button', { name: /发送消息|send message/i }).click();
}

async function sendChatDetailAttachment(page, filePath, text = '') {
  const fileInput = page.locator('input[type="file"]').last();
  await fileInput.setInputFiles(filePath);
  await page.waitForSelector('img[alt^="附件预览"]', { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(500);

  if (text) {
    const input = page.locator('textarea').first();
    await input.fill(text);
  }

  await page.getByRole('button', { name: /发送消息|send message/i }).click();
}

async function sendBurstMessages(page, texts) {
  const sentTexts = [];

  for (const text of texts) {
    if (SEND_MODE === 'chat') {
      await openChatDetail(page);
      await sendChatDetailMessage(page, text);
    } else {
      await openHomeBotBubble(page);
      await sendHomeBotMessage(page, text);
    }

    sentTexts.push(text);
    await page.waitForTimeout(BURST_REOPEN_DELAY_MS);
  }

  return sentTexts;
}

async function collectBotState(page) {
  const locator = page.locator('[data-testid="home-bot-bubble"]');
  const isVisible = await locator.isVisible().catch(() => false);
  if (!isVisible) {
    return null;
  }

  return locator.getAttribute('data-bot-state');
}

async function collectAttachmentSummary(page) {
  return retryPageRead(page, async () =>
    page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const videos = Array.from(document.querySelectorAll('video'));
      return {
        imageCount: images.length,
        videoCount: videos.length,
        imageSources: images
          .map((image) => image.getAttribute('src') || '')
          .filter(Boolean)
          .slice(0, 10),
        videoSources: videos
          .map((video) => video.getAttribute('src') || '')
          .filter(Boolean)
          .slice(0, 10),
      };
    }),
  );
}

async function main() {
  if (!PAIRING_CODE) {
    throw new Error('TRIX_PAIRING_CODE is required');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures = [];
  const consoleLogs = [];
  const requestLogs = [];

  page.on('console', (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: clip(msg.text(), 600),
    });
  });

  page.on('response', async (res) => {
    if (res.status() < 400) {
      return;
    }

    let body = '';
    try {
      body = await res.text();
    } catch (error) {
      body = error instanceof Error ? error.message : String(error);
    }

    failures.push({
      status: res.status(),
      url: res.url(),
      body: clip(body, 600),
    });
  });

  page.on('request', (req) => {
    const url = req.url();
    if (!/\/api\/(?:messages|uploads)\b/.test(url)) {
      return;
    }

    requestLogs.push({
      method: req.method(),
      url,
      postData: clip(req.postData() || '', 1200),
      headers: {
        'content-type': req.headers()['content-type'],
        'x-attachment-kind': req.headers()['x-attachment-kind'],
        'x-trix-conversation-id': req.headers()['x-trix-conversation-id'],
      },
    });
  });

  try {
    await ensureLoggedIn(page);
    if (DIRECT_CLAIM) {
      await claimPairingDirectly(page, PAIRING_CODE);
    } else {
      const pairingState = await openPairingInput(page);
      if (pairingState === 'needs-input') {
        await submitPairingCode(page, PAIRING_CODE);
      }
    }
    await page.waitForTimeout(12000);

    let afterSendBody = '';
    let finalBody = '';
    let botStateAfterSend = null;
    let botStateFinal = null;
    let sentTexts = [];
    if (BURST_TEXTS.length > 0) {
      sentTexts = await sendBurstMessages(page, BURST_TEXTS);
      await page.waitForTimeout(3000);
      botStateAfterSend = await collectBotState(page);
      afterSendBody = await readBodyText(page);
      await page.waitForTimeout(WAIT_REPLY_MS);
      botStateFinal = await collectBotState(page);
      finalBody = await readBodyText(page);
    } else if (SEND_TEXT || SEND_FILE) {
      if (SEND_MODE === 'chat') {
        await openChatDetail(page);
        if (SEND_FILE) {
          await sendChatDetailAttachment(page, SEND_FILE, SEND_TEXT);
        } else {
          await sendChatDetailMessage(page, SEND_TEXT);
        }
      } else {
        await openHomeBotBubble(page);
        await sendHomeBotMessage(page, SEND_TEXT);
      }
      sentTexts = SEND_TEXT ? [SEND_TEXT] : [];
      await page.waitForTimeout(3000);
      botStateAfterSend = await collectBotState(page);
      afterSendBody = await readBodyText(page);
      await page.waitForTimeout(WAIT_REPLY_MS);
      botStateFinal = await collectBotState(page);
      finalBody = await readBodyText(page);
    }

    const body = await readBodyText(page);
    const attachmentSummary = await collectAttachmentSummary(page);
    const result = {
      url: page.url(),
      sentText: SEND_TEXT || undefined,
      sentFile: SEND_FILE || undefined,
      sentTexts: sentTexts.length > 0 ? sentTexts : undefined,
      botStateAfterSend,
      botStateFinal,
      attachmentSummary,
      body: clip(body, 3000),
      afterSendBody: clip(afterSendBody, 3000) || undefined,
      finalBody: clip(finalBody, 3000) || undefined,
      failures,
      requestLogs,
      consoleLogs: consoleLogs.slice(-30),
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
