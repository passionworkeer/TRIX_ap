import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const webBaseUrl = (process.env.WEB_BASE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceUrl = (process.env.TRIX_SERVICE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceToken = process.env.TRIX_SERVICE_TOKEN;
const email = process.env.TRIX_TEST_EMAIL ?? 'david@trix.app';
const password = process.env.TRIX_TEST_PASSWORD ?? 'trix2026';
const soakIterations = Number(process.env.TRIX_SOAK_ITERATIONS ?? 6);
const soakDelayMs = Number(process.env.TRIX_SOAK_DELAY_MS ?? 30000);

if (!serviceToken) {
  throw new Error('TRIX_SERVICE_TOKEN is required');
}

const artifactDir = '/tmp/trix-openclaw-live-e2e';
mkdirSync(artifactDir, { recursive: true });

const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pQ2kAAAAASUVORK5CYII=';
const uploadImagePath = path.join(artifactDir, 'upload.png');
writeFileSync(uploadImagePath, Buffer.from(imageBase64, 'base64'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createPairing(label = 'openclaw-live-e2e') {
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

function findNewestBotReply(messages, baselineMessageIds, options = {}) {
  const botReplies = messages.filter((entry) => (
    baselineMessageIds.has(entry.id) === false
    && entry.senderId?.startsWith('openclaw:') === true
  ));

  if (typeof options.matcher === 'function') {
    const matchedReply = botReplies.find((entry) => options.matcher(entry));
    if (matchedReply) {
      return matchedReply;
    }
  }

  if (options.allowAnyBotReply) {
    return botReplies[0] ?? null;
  }

  return null;
}

async function waitForBotReply(conversationId, clientToken, baselineMessageIds, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const deadline = Date.now() + timeoutMs;
  let latestMessages = [];

  while (Date.now() < deadline) {
    const history = await fetchHistory(conversationId, clientToken);
    const messages = Array.isArray(history.messages) ? history.messages : [];
    latestMessages = messages;

    const newBotMessage = findNewestBotReply(messages, baselineMessageIds, options);

    if (newBotMessage) {
      return { message: newBotMessage, messages };
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
  const isAuthReady = await waitForAuthReady(page, 10000).then(() => true).catch(() => false);
  if (!isAuthReady) {
    await page.locator('#email-input:visible').first().fill(email);
    await page.locator('#password-input:visible').first().fill(password);
    await page.locator('button[type="button"]:visible').first().click();
    await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 }).catch(() => {});
    await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
    await waitForAuthReady(page);
    return;
  }
  await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
  await waitForAuthReady(page);
  return;

  await page.goto(`${webBaseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  const alreadyAuthenticated = await page.evaluate(() => {
    const authKey = Object.keys(localStorage).find((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
    const authToken = authKey ? localStorage.getItem(authKey) : null;
    const text = document.body?.innerText ?? '';
    return Boolean(authToken) && !text.includes('璇峰厛鐧诲綍浠ヨ闂椤甸潰');
  });
  if (!alreadyAuthenticated) {
    await page.locator('input[type="email"]:visible, input[placeholder*="Email" i]:visible, #email-input:visible').first().fill(email);
    await page.locator('input[type="password"]:visible, #password-input:visible').first().fill(password);
    await page.locator('button:visible').filter({ hasText: /鐧诲綍|login/i }).first().click();
    await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 }).catch(() => {});
  }
  await page.goto(`${webBaseUrl}/#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return;

  await page.goto(`${webBaseUrl}/#/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[type="email"], input[placeholder*="Email" i], #email-input').first().fill(email);
  await page.locator('input[type="password"], #password-input').first().fill(password);
  await page.locator('button').filter({ hasText: /登录|login/i }).first().click();
  await page.waitForFunction(() => window.location.hash !== '#/login', { timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function openPairingPage(page) {
  await page.goto(`${webBaseUrl}/#/pairing`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    return !text.includes('页面加载中...');
  }, { timeout: 20000 });

  if (/#\/chat\/clawbot/.test(page.url())) {
    return null;
  }

  const chatTextarea = page.locator('textarea').first();
  if (await chatTextarea.isVisible().catch(() => false)) {
    return null;
  }

  const manualButton = page.getByRole('button', { name: '手动输入配对码' });
  const codeInput = page.locator('input[placeholder="AB12CD"]');

  if (await manualButton.count()) {
    await manualButton.click();
  }

  await codeInput.waitFor({ timeout: 15000 });
  return codeInput;
}

async function pair(page, pairingCode) {
  const codeInput = await openPairingPage(page);
  if (codeInput) {
    await codeInput.fill(pairingCode);
    await page.getByRole('button', { name: '验证配对' }).click();
    await page.waitForTimeout(3000);
  }
  await page.goto(`${webBaseUrl}/#/chat/clawbot`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('textarea').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2000);
}

async function readNativeSession(page) {
  const result = await page.evaluate(() => {
    const raw = localStorage.getItem('trix_native_channel_sessions_v2');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const activeAccountId = parsed.activeAccountId || 'default';
    return parsed.sessions?.[activeAccountId] || null;
  });

  if (!result?.conversationId || !result?.clientToken) {
    throw new Error('Native session not persisted after pairing');
  }

  return result;
}

async function waitForUsableSession(page, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const session = await page.evaluate(() => {
      const raw = localStorage.getItem('trix_native_channel_sessions_v2');
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      const activeAccountId = parsed.activeAccountId || 'default';
      return parsed.sessions?.[activeAccountId] || null;
    });

    if (session?.conversationId && session?.clientToken) {
      try {
        await fetchHistory(session.conversationId, session.clientToken);
        return session;
      } catch {
        // Continue polling until restore finishes.
      }
    }

    await page.waitForTimeout(1000);
  }

  throw new Error('Timed out waiting for a usable native session');
}

async function ensurePairedSession(page, pairingCode) {
  await page.goto(`${webBaseUrl}/#/chat/clawbot`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const restoredSession = await page.evaluate(() => {
    const raw = localStorage.getItem('trix_native_channel_sessions_v2');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const activeAccountId = parsed.activeAccountId || 'default';
    return parsed.sessions?.[activeAccountId] || null;
  });

  if (restoredSession?.conversationId && restoredSession?.clientToken) {
    return await waitForUsableSession(page);
  }

  await pair(page, pairingCode);
  return await waitForUsableSession(page);
}

async function assertStillInChat(page) {
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(`Unexpected redirect to login: ${url}`);
  }

  await page.locator('textarea').first().waitFor({ timeout: 10000 });
}

async function sendTextViaUi(page, text) {
  const textarea = page.locator('textarea').first();
  const sendButton = page.locator('button[aria-label="发送消息"], button[aria-label="Send Message"]').first();
  await textarea.fill(text);
  await sendButton.click();
}

async function sendImageViaUi(page, caption) {
  await page.setInputFiles('input[type="file"]', uploadImagePath);
  await page.locator('img[alt^="附件预览"]').first().waitFor({ timeout: 15000 });
  if (caption) {
    await page.locator('textarea').first().fill(caption);
  }
  await page.locator('button[aria-label="发送消息"], button[aria-label="Send Message"]').first().click();
  await page.locator('img[alt="Attachment"]').first().waitFor({ timeout: 15000 });
}

async function main() {
  const pairing = await createPairing();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const runStartedAt = Date.now();
  const events = [];

  try {
    await login(page);
    const session = await ensurePairedSession(page, pairing.code);

    await page.screenshot({ path: path.join(artifactDir, 'chat-initial.png'), fullPage: true });

    const pushEvent = (kind, payload) => {
      events.push({
        kind,
        at: new Date().toISOString(),
        ...payload,
      });
    };

    {
      const baseline = new Set((await fetchHistory(session.conversationId, session.clientToken)).messages.map((entry) => entry.id));
      await sendTextViaUi(page, '/help');
      const helpReply = await waitForBotReply(session.conversationId, session.clientToken, baseline, {
        matcher: (entry) => typeof entry.text === 'string' && entry.text.includes('ℹ️ Help'),
        timeoutMs: 120000,
      });
      if (!helpReply.message) {
        throw new Error('No /help reply received');
      }
      pushEvent('slash_help', { messageId: helpReply.message.id, preview: helpReply.message.text.slice(0, 160) });
    }

    {
      const baseline = new Set((await fetchHistory(session.conversationId, session.clientToken)).messages.map((entry) => entry.id));
      await sendTextViaUi(page, '/status');
      const statusReply = await waitForBotReply(session.conversationId, session.clientToken, baseline, {
        matcher: (entry) => typeof entry.text === 'string' && entry.text.includes('OpenClaw'),
        timeoutMs: 120000,
      });
      if (!statusReply.message) {
        throw new Error('No /status reply received');
      }
      pushEvent('slash_status', { messageId: statusReply.message.id, preview: statusReply.message.text.slice(0, 160) });
    }

    {
      const token = `TEXT_ACK_${Date.now()}`;
      const baseline = new Set((await fetchHistory(session.conversationId, session.clientToken)).messages.map((entry) => entry.id));
      await sendTextViaUi(page, `请只回复这个标记：${token}`);
      const textReply = await waitForBotReply(session.conversationId, session.clientToken, baseline, {
        matcher: (entry) => typeof entry.text === 'string' && entry.text.includes(token),
        allowAnyBotReply: true,
        timeoutMs: 180000,
      });
      if (!textReply.message) {
        throw new Error(`No plain-text bot reply received after ${token}`);
      }
      pushEvent('text_reply', {
        messageId: textReply.message.id,
        matchedToken: textReply.message.text.includes(token),
        preview: textReply.message.text.slice(0, 160),
      });
    }

    {
      const token = `IMAGE_ACK_${Date.now()}`;
      const baselineHistory = await fetchHistory(session.conversationId, session.clientToken);
      const baselineIds = new Set(baselineHistory.messages.map((entry) => entry.id));
      await sendImageViaUi(page, `请看图片，并回复 ${token}`);
      const imageReply = await waitForBotReply(session.conversationId, session.clientToken, baselineIds, {
        matcher: (entry) => typeof entry.text === 'string' && entry.text.includes(token),
        allowAnyBotReply: true,
        timeoutMs: 180000,
      });
      if (!imageReply.message) {
        throw new Error(`No multimodal bot reply received after ${token}`);
      }

      const latestHistory = await fetchHistory(session.conversationId, session.clientToken);
      const attachmentInbound = [...latestHistory.messages].reverse().find((entry) => (
        entry.senderId?.startsWith('openclaw:') !== true && Array.isArray(entry.attachments) && entry.attachments.length > 0
      ));
      if (!attachmentInbound) {
        throw new Error('No inbound attachment message persisted for multimodal test');
      }

      pushEvent('multimodal_reply', {
        inboundMessageId: attachmentInbound.id,
        replyMessageId: imageReply.message.id,
        preview: imageReply.message.text.slice(0, 160),
      });
    }

    for (let index = 0; index < soakIterations; index += 1) {
      await assertStillInChat(page);
      const useSlash = index % 2 === 0;
      const baseline = new Set((await fetchHistory(session.conversationId, session.clientToken)).messages.map((entry) => entry.id));
      const startedAt = Date.now();

      if (useSlash) {
        await sendTextViaUi(page, '/status');
        const reply = await waitForBotReply(session.conversationId, session.clientToken, baseline, {
          matcher: (entry) => typeof entry.text === 'string' && entry.text.includes('OpenClaw'),
          timeoutMs: 120000,
        });
        if (!reply.message) {
          throw new Error(`No /status reply on soak iteration ${index + 1}`);
        }
        pushEvent('soak_status', {
          iteration: index + 1,
          latencyMs: Date.now() - startedAt,
          messageId: reply.message.id,
        });
      } else {
        const token = `SOAK_${index + 1}_${Date.now()}`;
        await sendTextViaUi(page, `请只回复 ${token}`);
        const reply = await waitForBotReply(session.conversationId, session.clientToken, baseline, {
          matcher: (entry) => typeof entry.text === 'string' && entry.text.includes(token),
          allowAnyBotReply: true,
          timeoutMs: 180000,
        });
        if (!reply.message) {
          throw new Error(`No plain bot reply on soak iteration ${index + 1}`);
        }
        pushEvent('soak_text', {
          iteration: index + 1,
          latencyMs: Date.now() - startedAt,
          messageId: reply.message.id,
          matchedToken: reply.message.text.includes(token),
        });
      }

      await page.screenshot({ path: path.join(artifactDir, `soak-${index + 1}.png`), fullPage: true });
      await sleep(soakDelayMs);
    }

    await assertStillInChat(page);
    const finalSession = await readNativeSession(page);
    const finalHistory = await fetchHistory(finalSession.conversationId, finalSession.clientToken);

    console.log(JSON.stringify({
      ok: true,
      runStartedAt: new Date(runStartedAt).toISOString(),
      durationMs: Date.now() - runStartedAt,
      pairingCode: pairing.code,
      conversationId: finalSession.conversationId,
      totalMessages: Array.isArray(finalHistory.messages) ? finalHistory.messages.length : null,
      events,
      screenshotsDir: artifactDir,
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
