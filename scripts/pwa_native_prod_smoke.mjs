import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium, devices } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const config = {
  baseUrl: process.env.TRIX_SMOKE_BASE_URL || 'https://trix.love',
  supabaseUrl: process.env.TRIX_SMOKE_SUPABASE_URL || 'https://__SUPABASE_PROJECT_REF_REDACTED__.supabase.co',
  supabaseAnonKey: process.env.TRIX_SMOKE_SUPABASE_ANON_KEY || '',
  email: process.env.TRIX_SMOKE_EMAIL || '',
  password: process.env.TRIX_SMOKE_PASSWORD || '',
  accountId: process.env.TRIX_SMOKE_ACCOUNT_ID || 'david',
  serviceToken: process.env.TRIX_SMOKE_SERVICE_TOKEN || '',
  waitMs: Number(process.env.TRIX_SMOKE_WAIT_MS || 10000),
};

const storageKey = 'sb-__SUPABASE_PROJECT_REF_REDACTED__-auth-token';
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';

function requireConfigValue(key, value) {
  if (!value) {
    throw new Error(`Missing required config: ${key}`);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function signIn() {
  requireConfigValue('TRIX_SMOKE_SUPABASE_ANON_KEY', config.supabaseAnonKey);
  requireConfigValue('TRIX_SMOKE_EMAIL', config.email);
  requireConfigValue('TRIX_SMOKE_PASSWORD', config.password);

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: config.email,
    password: config.password,
  });

  if (error || !data.session) {
    throw error ?? new Error('Missing Supabase session');
  }

  return data.session;
}

async function restoreNativeSession(accessToken, clientId, deviceName) {
  const response = await fetch(`${config.baseUrl}/api/client/session/restore`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      accountId: config.accountId,
      clientId,
      deviceName,
    }),
  });

  if (!response.ok) {
    throw new Error(`restore failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchConversationHistory(clientToken, conversationId) {
  const response = await fetch(
    `${config.baseUrl}/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      headers: {
        'x-trix-client-token': clientToken,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`history failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchServiceConversation(conversationId) {
  requireConfigValue('TRIX_SMOKE_SERVICE_TOKEN', config.serviceToken);

  const response = await fetch(
    `${config.baseUrl}/api/service/conversations/${encodeURIComponent(conversationId)}`,
    {
      headers: {
        authorization: `Bearer ${config.serviceToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`service conversation failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function postServiceMessage(conversationId, message) {
  requireConfigValue('TRIX_SMOKE_SERVICE_TOKEN', config.serviceToken);

  const response = await fetch(`${config.baseUrl}/api/service/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.serviceToken}`,
    },
    body: JSON.stringify({
      accountId: config.accountId,
      conversationId,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`service message failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function sendUserMessage(clientToken, conversationId, text, localId) {
  const response = await fetch(`${config.baseUrl}/api/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      clientToken,
      text,
      localId,
      metadata: {
        source: 'pwa-native-prod-smoke',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`user message failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function pollBotReply(clientToken, conversationId, replyToMessageId, attempts = 15) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await wait(3000);
    const history = await fetchConversationHistory(clientToken, conversationId);
    const reply = (history.messages || []).find((message) =>
      typeof message.senderId === 'string'
      && message.senderId.startsWith('openclaw:')
      && message.replyToMessageId === replyToMessageId,
    );

    if (reply) {
      return reply;
    }
  }

  return null;
}

async function createTempImageFile() {
  const filePath = path.join(os.tmpdir(), `trix-pwa-smoke-${Date.now()}.png`);
  await fs.writeFile(filePath, Buffer.from(TINY_PNG_BASE64, 'base64'));
  return filePath;
}

async function openStandaloneContext(sessionPayload) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    serviceWorkers: 'allow',
  });

  await context.addInitScript(({ storageKey: authStorageKey, serializedSession }) => {
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      get: () => true,
    });

    const originalMatchMedia = window.matchMedia ? window.matchMedia.bind(window) : null;
    window.matchMedia = (query) => query === '(display-mode: standalone)'
      ? {
          matches: true,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() { return true; },
        }
      : (
          originalMatchMedia
            ? originalMatchMedia(query)
            : {
                matches: false,
                media: query,
                onchange: null,
                addListener() {},
                removeListener() {},
                addEventListener() {},
                removeEventListener() {},
                dispatchEvent() { return true; },
              }
        );

    localStorage.setItem('language', 'zh');
    localStorage.setItem('i18nextLng', 'zh');
    sessionStorage.setItem('language', 'zh');
    sessionStorage.setItem('i18nextLng', 'zh');
    localStorage.setItem(authStorageKey, serializedSession);
    sessionStorage.setItem(authStorageKey, serializedSession);
  }, {
    storageKey,
    serializedSession: JSON.stringify(sessionPayload),
  });

  return { browser, context };
}

async function verifyChatListState(page) {
  await page.goto(`${config.baseUrl}/#/chat`, { waitUntil: 'domcontentloaded' });
  await wait(7000);
  const bodyText = await page.locator('body').innerText();
  return {
    url: page.url(),
    hasTrixBot: bodyText.includes('TRIX Bot'),
    showsUnpaired: bodyText.includes('未配对'),
    showsReconnectPrompt: bodyText.includes('重新配对'),
    showsConnectionError: bodyText.includes('连接异常'),
  };
}

async function openChatDetail(page) {
  await page.getByText('TRIX Bot').first().click();
  await wait(4000);
}

async function sendUiImageMessage(page, imagePath, text) {
  await page.locator('input[type="file"]').setInputFiles(imagePath);
  await wait(2000);
  await page.locator('textarea').fill(text);
  await page.locator('textarea').press('Enter');
  await wait(6000);
}

async function waitForBodyText(page, text, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes(text)) {
      return true;
    }
    await wait(2000);
  }
  return false;
}

async function waitForAttachmentRender(page, minimumCount = 1, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const count = await page.locator('img[alt="Attachment"]').count();
    if (count >= minimumCount) {
      return count;
    }
    await wait(2000);
  }
  return 0;
}

async function main() {
  const summary = {
    config: {
      baseUrl: config.baseUrl,
      accountId: config.accountId,
      waitMs: config.waitMs,
    },
  };

  const initialSession = await signIn();
  const restored = await restoreNativeSession(
    initialSession.access_token,
    `smoke-api-${Date.now()}`,
    'PWA Native Smoke API',
  );

  summary.restoredConversationId = restored.conversationId;

  const textChecks = [];
  for (let index = 0; index < 3; index += 1) {
    const prompt = `连续对话验收 ${Date.now()} 第 ${index + 1} 轮：请继续记住这是同一轮 smoke test，并简短回复你还在线。`;
    const sent = await sendUserMessage(
      restored.clientToken,
      restored.conversationId,
      prompt,
      `smoke-text-${Date.now()}-${index}`,
    );
    const reply = await pollBotReply(restored.clientToken, restored.conversationId, sent.message.id);
    textChecks.push({
      prompt,
      sentMessageId: sent.message.id,
      replyFound: Boolean(reply),
      replyText: reply?.text ?? null,
    });
  }
  summary.textRounds = textChecks;

  const imagePath = await createTempImageFile();
  const { browser, context } = await openStandaloneContext(initialSession);
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => {
    browserErrors.push(String(error));
  });

  summary.initialPwaState = await verifyChatListState(page);
  await openChatDetail(page);

  const uiImageText = `UI 图片发送验收 ${Date.now()}`;
  await sendUiImageMessage(page, imagePath, uiImageText);
  const uiImageVisible = await waitForBodyText(page, uiImageText, 8);

  const serviceHistoryAfterUiSend = await fetchServiceConversation(restored.conversationId);
  const latestUiImageMessage = [...(serviceHistoryAfterUiSend.messages || [])]
    .reverse()
    .find((message) => message.text === uiImageText);

  summary.uiMultimodalSend = {
    promptVisibleInUi: uiImageVisible,
    latestMessageId: latestUiImageMessage?.id ?? null,
    attachmentKinds: (latestUiImageMessage?.attachments || []).map((attachment) => attachment.kind),
  };

  const serviceImageText = `服务端图片下发验收 ${Date.now()}`;
  await postServiceMessage(restored.conversationId, {
    text: serviceImageText,
    attachments: [
      {
        kind: 'image',
        mimeType: 'image/png',
        fileName: 'service-smoke.png',
        contentBase64: TINY_PNG_BASE64,
      },
    ],
  });

  const attachmentCount = await waitForAttachmentRender(page, 1, 10);
  const serviceImageVisible = await waitForBodyText(page, serviceImageText, 10);
  summary.uiMultimodalReceive = {
    textVisibleInUi: serviceImageVisible,
    attachmentImageCount: attachmentCount,
  };

  await browser.close();
  await wait(config.waitMs);

  const reloginSession = await signIn();
  const restoredAfterRelogin = await restoreNativeSession(
    reloginSession.access_token,
    `smoke-relogin-${Date.now()}`,
    'PWA Native Smoke Relogin',
  );

  const { browser: browser2, context: context2 } = await openStandaloneContext(reloginSession);
  const page2 = await context2.newPage();
  summary.reloginPwaState = await verifyChatListState(page2);
  await openChatDetail(page2);
  const reloginConversationVisible = await waitForBodyText(page2, serviceImageText, 8);
  summary.reloginRestore = {
    restoredConversationId: restoredAfterRelogin.conversationId,
    sameConversation: restoredAfterRelogin.conversationId === restored.conversationId,
    previousMessageStillVisible: reloginConversationVisible,
  };
  await browser2.close();

  summary.browserErrors = browserErrors;

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  }, null, 2));
  process.exitCode = 1;
});
