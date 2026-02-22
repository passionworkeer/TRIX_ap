const test = require('node:test');
const assert = require('node:assert/strict');

const {
  synthesizeSpeech,
  getCacheSize,
  resetCache,
} = require('../services/ttsService');

test.beforeEach(() => {
  resetCache();
  process.env.DOUBAO_TTS_APP_ID = 'test-app-id';
  process.env.DOUBAO_TTS_TOKEN = 'test-token';
  process.env.DOUBAO_TTS_CLUSTER = 'volcano_tts';
  process.env.DOUBAO_TTS_VOICE_TYPE = 'BV002_streaming';
  process.env.DOUBAO_TTS_RATE = '24000';
  process.env.DOUBAO_TTS_MAX_TEXT_LENGTH = '500';
  process.env.DOUBAO_TTS_CACHE_TTL_MS = '300000';
  process.env.DOUBAO_TTS_CACHE_MAX_ITEMS = '10';
});

test('bot_reply scene should never cache audio buffer', async () => {
  let requestCount = 0;
  const httpClient = {
    post: async () => {
      requestCount += 1;
      return {
        data: {
          code: 3000,
          data: Buffer.from(`bot-reply-${requestCount}`).toString('base64'),
        },
      };
    },
  };

  const first = await synthesizeSpeech({ text: '你好', scene: 'bot_reply', httpClient });
  const second = await synthesizeSpeech({ text: '你好', scene: 'bot_reply', httpClient });

  assert.equal(first.fromCache, false);
  assert.equal(second.fromCache, false);
  assert.equal(requestCount, 2);
  assert.equal(getCacheSize(), 0);
});

test('welcome/status scenes should cache repeated short phrase audio', async () => {
  let requestCount = 0;
  const httpClient = {
    post: async () => {
      requestCount += 1;
      return {
        data: {
          code: 3000,
          data: Buffer.from('welcome-audio').toString('base64'),
        },
      };
    },
  };

  const firstWelcome = await synthesizeSpeech({ text: '欢迎回来', scene: 'welcome', httpClient });
  const secondWelcome = await synthesizeSpeech({ text: '欢迎回来', scene: 'welcome', httpClient });
  const firstStatus = await synthesizeSpeech({ text: 'TRIX Bot 已连接', scene: 'status', httpClient });
  const secondStatus = await synthesizeSpeech({ text: 'TRIX Bot 已连接', scene: 'status', httpClient });

  assert.equal(firstWelcome.fromCache, false);
  assert.equal(secondWelcome.fromCache, true);
  assert.equal(firstStatus.fromCache, false);
  assert.equal(secondStatus.fromCache, true);
  assert.equal(requestCount, 2);
  assert.equal(getCacheSize(), 2);
});
