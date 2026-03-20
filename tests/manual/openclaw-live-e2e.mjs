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

async function waitForBotReply(conversationId, clientToken, baselineMessageIds, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const deadline = Date.now() + timeoutMs;
  let latestMessages = [];

  while (Date.now() < deadline) {
    const history = await fetchHistory(conversationId, clientToken);
    const messages = Array.isArray(history.messages) ? history.messages : [];
    latestMessages = messages;

    const newBotMessage = messages.find((entry) => {
      if (baselineMessageIds.has(entry.id)) {
        return false;
      }
      if (entry.senderId?.startsWith('openclaw:') !== true) {
        return false;
      }
      if (typeof options.matcher === 'function') {
        return options.matcher(entry);
      }
      return true;
    });

    if (newBotMessage) {
      return { message: newBotMessage, messages };
    }

    await sleep(1500);
  }

  return { message: null, messages: latestMessages };
}

async function login(page) {
  await page.goto(`${webBaseUrl}/#/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[type="email"], input[placeholder*="Email" i], #email-input').first().fill(email);
  await page.locator('input[type="password"], #password-input').first().fill(password);
  await page.locator('button').filter({ hasText: /登录|login/i }).first().click();
  await page.waitForURL(/#\/$/, { timeout: 20000 });
  await page.waitForTimeout(3000);
}

async function openPairingPage(page) {
  await page.goto(`${webBaseUrl}/#/pairing`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const text = document.body?.innerText ?? '';
    return !text.includes('页面加载中...');
  }, { timeout: 20000 });

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
  await codeInput.fill(pairingCode);
  await page.getByRole('button', { name: '验证配对' }).click();
  await page.waitForTimeout(3000);
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
    await pair(page, pairing.code);
    const session = await readNativeSession(page);

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
        timeoutMs: 180000,
      });
      if (!textReply.message) {
        throw new Error(`No plain-text reply containing ${token}`);
      }
      pushEvent('text_reply', { messageId: textReply.message.id, preview: textReply.message.text.slice(0, 160) });
    }

    {
      const token = `IMAGE_ACK_${Date.now()}`;
      const baselineHistory = await fetchHistory(session.conversationId, session.clientToken);
      const baselineIds = new Set(baselineHistory.messages.map((entry) => entry.id));
      await sendImageViaUi(page, `请看图片，并回复 ${token}`);
      const imageReply = await waitForBotReply(session.conversationId, session.clientToken, baselineIds, {
        matcher: (entry) => typeof entry.text === 'string' && entry.text.includes(token),
        timeoutMs: 180000,
      });
      if (!imageReply.message) {
        throw new Error(`No multimodal reply containing ${token}`);
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
          timeoutMs: 180000,
        });
        if (!reply.message) {
          throw new Error(`No plain reply on soak iteration ${index + 1}`);
        }
        pushEvent('soak_text', {
          iteration: index + 1,
          latencyMs: Date.now() - startedAt,
          messageId: reply.message.id,
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
