const crypto = require('crypto');
const axios = require('axios');
const { sanitizeTtsText } = require('./ttsTextSanitizer');

const TTS_ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';
const CACHEABLE_SCENES = new Set(['welcome', 'status']);
const sceneCache = new Map();

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getConfig() {
  return {
    appId: process.env.DOUBAO_TTS_APP_ID || '',
    token: process.env.DOUBAO_TTS_TOKEN || '',
    cluster: process.env.DOUBAO_TTS_CLUSTER || 'volcano_tts',
    voiceType: process.env.DOUBAO_TTS_VOICE_TYPE || 'BV002_streaming',
    rate: parseNumber(process.env.DOUBAO_TTS_RATE, 24000),
    speedRatio: parseNumber(process.env.DOUBAO_TTS_SPEED_RATIO, 1.0),
    volumeRatio: parseNumber(process.env.DOUBAO_TTS_VOLUME_RATIO, 1.0),
    timeoutMs: parseNumber(process.env.DOUBAO_TTS_TIMEOUT_MS, 12000),
    maxTextLength: parseNumber(process.env.DOUBAO_TTS_MAX_TEXT_LENGTH, 500),
    cacheTtlMs: parseNumber(process.env.DOUBAO_TTS_CACHE_TTL_MS, 300000),
    cacheMaxItems: parseNumber(process.env.DOUBAO_TTS_CACHE_MAX_ITEMS, 100),
  };
}

function shouldCacheScene(scene) {
  return CACHEABLE_SCENES.has(scene);
}

function makeCacheKey(scene, sanitizedText, config) {
  return [
    scene,
    sanitizedText,
    config.voiceType,
    config.rate,
    config.speedRatio,
    config.volumeRatio,
  ].join('::');
}

function cleanupCache(config) {
  const now = Date.now();
  for (const [key, entry] of sceneCache.entries()) {
    if (entry.expiresAt <= now) {
      sceneCache.delete(key);
    }
  }

  if (sceneCache.size <= config.cacheMaxItems) {
    return;
  }

  const sortedEntries = [...sceneCache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  const overflow = sortedEntries.length - config.cacheMaxItems;
  for (let i = 0; i < overflow; i += 1) {
    sceneCache.delete(sortedEntries[i][0]);
  }
}

function getCachedAudio(cacheKey, config) {
  cleanupCache(config);
  const entry = sceneCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    sceneCache.delete(cacheKey);
    return null;
  }
  return entry.buffer;
}

function setCachedAudio(cacheKey, buffer, config) {
  cleanupCache(config);
  sceneCache.set(cacheKey, {
    buffer,
    createdAt: Date.now(),
    expiresAt: Date.now() + config.cacheTtlMs,
  });
}

function buildRequestPayload(sanitizedText, config) {
  return {
    app: {
      appid: config.appId,
      token: config.token,
      cluster: config.cluster,
    },
    user: {
      uid: 'trix_web_user',
    },
    audio: {
      voice_type: config.voiceType,
      encoding: 'mp3',
      rate: config.rate,
      speed_ratio: config.speedRatio,
      volume_ratio: config.volumeRatio,
    },
    request: {
      reqid: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      text: sanitizedText,
      text_type: 'plain',
      operation: 'query',
    },
  };
}

async function synthesizeSpeech({
  text,
  scene = 'bot_reply',
  messageId = '',
  httpClient = axios,
}) {
  const config = getConfig();
  if (!config.appId || !config.token) {
    throw new Error('TTS credentials are not configured');
  }

  const sanitizedText = sanitizeTtsText(text, config.maxTextLength);
  if (!sanitizedText) {
    throw new Error('TTS text is empty after sanitization');
  }

  const cacheable = shouldCacheScene(scene);
  const cacheKey = makeCacheKey(scene, sanitizedText, config);
  if (cacheable) {
    const cachedBuffer = getCachedAudio(cacheKey, config);
    if (cachedBuffer) {
      return {
        audioBuffer: cachedBuffer,
        sanitizedText,
        fromCache: true,
      };
    }
  }

  const response = await httpClient.post(
    TTS_ENDPOINT,
    buildRequestPayload(sanitizedText, config),
    {
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer;${config.token}`,
      },
    }
  );

  const result = response?.data || {};
  if (result.code !== 3000 || typeof result.data !== 'string') {
    const detail = result.message || 'Unknown TTS provider error';
    throw new Error(`TTS provider failed: ${detail}`);
  }

  const audioBuffer = Buffer.from(result.data, 'base64');
  if (!audioBuffer.length) {
    throw new Error('TTS provider returned empty audio payload');
  }

  if (cacheable) {
    setCachedAudio(cacheKey, audioBuffer, config);
  }

  console.log(`[TTS] scene=${scene} cache=${cacheable ? 'eligible' : 'disabled'} messageId=${messageId}`);

  return {
    audioBuffer,
    sanitizedText,
    fromCache: false,
  };
}

function resetCache() {
  sceneCache.clear();
}

function getCacheSize() {
  return sceneCache.size;
}

module.exports = {
  synthesizeSpeech,
  shouldCacheScene,
  makeCacheKey,
  resetCache,
  getCacheSize,
};
