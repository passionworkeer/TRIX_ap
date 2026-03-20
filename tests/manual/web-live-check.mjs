import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://127.0.0.1:4173';
const serviceUrl = (process.env.TRIX_SERVICE_URL ?? 'https://trix.love').replace(/\/$/, '');
const serviceToken = process.env.TRIX_SERVICE_TOKEN;
const email = process.env.TRIX_TEST_EMAIL ?? 'xiaoming@trix.app';
const password = process.env.TRIX_TEST_PASSWORD ?? 'trix2026';
const username = process.env.TRIX_TEST_USERNAME ?? 'xiaoming';

if (!serviceToken) {
  throw new Error('TRIX_SERVICE_TOKEN is required');
}

const screenshotDir = '/tmp/trix-web-live-check';
mkdirSync(screenshotDir, { recursive: true });

const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pQ2kAAAAASUVORK5CYII=';
const uploadImagePath = path.join(screenshotDir, 'upload.png');
writeFileSync(uploadImagePath, Buffer.from(imageBase64, 'base64'));

async function createPairing() {
  const response = await fetch(`${serviceUrl}/api/pairings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      accountId: 'default',
      label: 'TRIX Bot',
      ttlMs: 120000,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create pairing: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function sendServiceReply(conversationId, message) {
  const response = await fetch(`${serviceUrl}/api/service/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      accountId: 'default',
      conversationId,
      message,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to send service reply: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function login(page) {
  await page.goto(`${webBaseUrl}/#/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[type="email"], input[placeholder*="Email" i], #email-input').first().fill(email);
  await page.locator('input[type="password"], #password-input').first().fill(password);
  await page.locator('button').filter({ hasText: /登录|Login/i }).first().click();
  await page.waitForTimeout(8000);

  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('#/login')) {
    await page.goto(`${webBaseUrl}/#/register`);
    await page.waitForLoadState('domcontentloaded');
    const usernameInput = page.locator('input[placeholder="用户名"]');
    if (await usernameInput.count()) {
      await usernameInput.fill(username);
    }
    await page.fill('#email-input', email);
    await page.fill('#password-input', password);
    await page.locator('button').filter({ hasText: /立即注册|Register/i }).first().click();
    await page.waitForTimeout(8000);
  }

  await page.waitForLoadState('load');
  await page.waitForTimeout(3000);
  await page.waitForURL(/#\/$/, { timeout: 20000 });
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

async function main() {
  const pairing = await createPairing();
  const pairingCode = pairing.code;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page);

    const codeInput = await openPairingPage(page);
    await codeInput.fill(pairingCode);
    await page.getByRole('button', { name: '验证配对' }).click();
    await page.waitForTimeout(2500);

    await page.goto(`${webBaseUrl}/#/chat/clawbot`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const session = await page.evaluate(() => {
      const raw = localStorage.getItem('trix_native_channel_session');
      return raw ? JSON.parse(raw) : null;
    });
    if (!session?.conversationId) {
      throw new Error('Web session was not persisted after pairing');
    }

    const textarea = page.locator('textarea').first();
    const sendButton = page.locator('button[aria-label="发送消息"], button[aria-label="Send Message"]').first();
    await textarea.fill('WEB LIVE TEXT');
    await sendButton.click();
    await page.getByText('WEB LIVE TEXT').waitFor({ timeout: 15000 });

    await sendServiceReply(session.conversationId, {
      idempotencyKey: `web-live-text-${Date.now()}`,
      text: 'WEB LIVE REPLY',
      attachments: [],
    });
    await page.getByText('WEB LIVE REPLY').waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, 'text-flow.png'), fullPage: true });

    await page.setInputFiles('input[type="file"]', uploadImagePath);
    await page.locator('img[alt^="附件预览"]').first().waitFor({ timeout: 15000 });
    await sendButton.click();
    await page.locator('img[alt="Attachment"]').first().waitFor({ timeout: 15000 });

    await sendServiceReply(session.conversationId, {
      idempotencyKey: `web-live-image-${Date.now()}`,
      text: 'WEB IMAGE REPLY',
      attachments: [
        {
          kind: 'image',
          mimeType: 'image/png',
          fileName: 'reply.png',
          contentBase64: imageBase64,
        },
      ],
    });
    await page.getByText('WEB IMAGE REPLY').waitFor({ timeout: 15000 });
    const attachmentImages = page.locator('img[alt="Attachment"]');
    const attachmentCount = await attachmentImages.count();
    if (attachmentCount < 2) {
      throw new Error(`Expected at least 2 attachment images in chat, got ${attachmentCount}`);
    }
    await page.screenshot({ path: path.join(screenshotDir, 'image-flow.png'), fullPage: true });

    const historyResponse = await fetch(`${serviceUrl}/api/conversations/${encodeURIComponent(session.conversationId)}/messages`, {
      headers: {
        'x-trix-client-token': session.clientToken,
      },
    });
    if (!historyResponse.ok) {
      throw new Error(`Failed to fetch conversation history: ${historyResponse.status} ${historyResponse.statusText}`);
    }
    const history = await historyResponse.json();

    console.log(JSON.stringify({
      ok: true,
      pairingCode,
      conversationId: session.conversationId,
      screenshots: {
        text: path.join(screenshotDir, 'text-flow.png'),
        image: path.join(screenshotDir, 'image-flow.png'),
      },
      historyCount: Array.isArray(history.messages) ? history.messages.length : null,
      attachmentImageCount: attachmentCount,
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
