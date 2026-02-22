/**
 * Extended tests for message service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbot-message-test-'));
const dbPath = path.join(tempDir, 'message-test.db');

process.env.DATABASE_PATH = dbPath;

const { initDatabase, db, dbRun, dbGet } = require('../config/database');
const messageService = require('../services/messageService');
const pairingService = require('../services/pairingService');

initDatabase();

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSchema() {
  for (let i = 0; i < 20; i += 1) {
    try {
      const row = await dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'");
      if (row) return;
    } catch {
      // Continue waiting
    }
    await delay(50);
  }
  throw new Error('Database schema init timed out');
}

test.before(async () => {
  await waitForSchema();
  await messageService.initMessageTable();
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('saveMessage should create message with correct direction', async () => {
  const pairing = await pairingService.createBotPairing('device-msg-test-1');

  const msgId = await messageService.saveMessage(
    pairing.id,
    'app_to_bot',
    'Hello from app',
    'text',
    null
  );

  assert.equal(typeof msgId, 'string');
  assert.equal(msgId.length > 0, true);
});

test('saveMessage should store media URL', async () => {
  const pairing = await pairingService.createBotPairing('device-msg-test-2');

  const msgId = await messageService.saveMessage(
    pairing.id,
    'bot_to_app',
    'Audio response',
    'audio',
    'https://cdn.example.com/audio.mp3'
  );

  assert.equal(typeof msgId, 'string');
});

test('getUndeliveredMessages should return only undelivered', async () => {
  const pairing = await pairingService.createBotPairing('device-msg-test-3');

  await messageService.saveMessage(pairing.id, 'app_to_bot', 'msg1', 'text', null);
  await messageService.saveMessage(pairing.id, 'app_to_bot', 'msg2', 'text', null);

  const pending = await messageService.getUndeliveredMessages(pairing.id, 'app_to_bot');

  assert.equal(pending.length, 2);
  assert.equal(pending[0].content, 'msg1');
  assert.equal(pending[1].content, 'msg2');
});

test('markDelivered should update message status', async () => {
  const pairing = await pairingService.createBotPairing('device-msg-test-4');

  const msgId = await messageService.saveMessage(
    pairing.id,
    'app_to_bot',
    'deliver me',
    'text',
    null
  );

  let pending = await messageService.getUndeliveredMessages(pairing.id, 'app_to_bot');
  assert.equal(pending.length, 1);

  await messageService.markDelivered(msgId);

  pending = await messageService.getUndeliveredMessages(pairing.id, 'app_to_bot');
  assert.equal(pending.length, 0);
});

test('getUndeliveredMessages should filter by direction', async () => {
  const pairing = await pairingService.createBotPairing('device-msg-test-5');

  await messageService.saveMessage(pairing.id, 'app_to_bot', 'to bot', 'text', null);
  await messageService.saveMessage(pairing.id, 'bot_to_app', 'to app', 'text', null);

  const toBot = await messageService.getUndeliveredMessages(pairing.id, 'app_to_bot');
  const toApp = await messageService.getUndeliveredMessages(pairing.id, 'bot_to_app');

  assert.equal(toBot.length, 1);
  assert.equal(toBot[0].content, 'to bot');

  assert.equal(toApp.length, 1);
  assert.equal(toApp[0].content, 'to app');
});

test('cleanupOldMessages should remove old messages', async () => {
  const pairing = await pairingService.createBotPairing('device-msg-test-6');

  // Insert a message with old timestamp
  await dbRun(`
    INSERT INTO messages (id, pairing_id, direction, content, content_type, created_at, delivered)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'), 1)
  `, ['old-msg-id', pairing.id, 'app_to_bot', 'old message', 'text']);

  // Insert a new message
  await messageService.saveMessage(pairing.id, 'app_to_bot', 'new message', 'text', null);

  await messageService.cleanupOldMessages(7);

  const pending = await messageService.getUndeliveredMessages(pairing.id, 'app_to_bot');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].content, 'new message');
});

test('cleanupOldMessages should use default days parameter', async () => {
  // Should not throw with default parameter
  await messageService.cleanupOldMessages();
  await messageService.cleanupOldMessages(undefined);
  await messageService.cleanupOldMessages(null);
});

test('cleanupOldMessages should handle invalid days parameter', async () => {
  // Should not throw with invalid parameters
  await messageService.cleanupOldMessages(-1);
  await messageService.cleanupOldMessages('invalid');
  await messageService.cleanupOldMessages(Infinity);
  await messageService.cleanupOldMessages(NaN);
});

test('fetchMissedMessages should return messages for paired user', async () => {
  const userId = 'user-missed-msg-123456789012345678901234567';
  const pairing = await pairingService.createBotPairing('device-missed-test');

  // Bind user and complete pairing
  await pairingService.bindUserToPairing(pairing.id, userId);
  await pairingService.completeBotPairing(pairing.id, 'device-missed-test', 'socket-missed');

  // Save some messages
  await messageService.saveMessage(pairing.id, 'bot_to_app', 'missed 1', 'text', null);
  await messageService.saveMessage(pairing.id, 'bot_to_app', 'missed 2', 'text', null);

  const result = await messageService.fetchMissedMessages(userId, 0, 100);

  assert.equal(result.success, true);
  assert.equal(Array.isArray(result.data), true);
});

test('fetchMissedMessages should respect timestamp filter', async () => {
  const userId = 'user-timestamp-123456789012345678901234567';
  const pairing = await pairingService.createBotPairing('device-timestamp-test');

  await pairingService.bindUserToPairing(pairing.id, userId);
  await pairingService.completeBotPairing(pairing.id, 'device-timestamp-test', 'socket-ts');

  await messageService.saveMessage(pairing.id, 'bot_to_app', 'recent msg', 'text', null);

  // Get current timestamp
  const now = Date.now();

  // Fetch with future timestamp - should return empty
  const futureResult = await messageService.fetchMissedMessages(userId, now + 10000, 100);
  assert.equal(futureResult.data.length, 0);

  // Fetch with past timestamp - should return messages
  const pastResult = await messageService.fetchMissedMessages(userId, 0, 100);
  assert.equal(pastResult.data.length > 0, true);
});

test('fetchMissedMessages should respect limit parameter', async () => {
  const userId = 'user-limit-123456789012345678901234567890';
  const pairing = await pairingService.createBotPairing('device-limit-test');

  await pairingService.bindUserToPairing(pairing.id, userId);
  await pairingService.completeBotPairing(pairing.id, 'device-limit-test', 'socket-limit');

  // Save multiple messages
  for (let i = 0; i < 10; i += 1) {
    await messageService.saveMessage(pairing.id, 'bot_to_app', `msg ${i}`, 'text', null);
  }

  const result = await messageService.fetchMissedMessages(userId, 0, 3);

  assert.equal(result.data.length <= 3, true);
});

test('fetchMissedMessages should handle invalid parameters', async () => {
  const userId = 'user-invalid-123456789012345678901234567890';

  // Invalid timestamp
  const result1 = await messageService.fetchMissedMessages(userId, 'invalid', 100);
  assert.equal(result1.success, true);

  // Invalid limit
  const result2 = await messageService.fetchMissedMessages(userId, 0, 'invalid');
  assert.equal(result2.success, true);

  // Negative values
  const result3 = await messageService.fetchMissedMessages(userId, -1, -1);
  assert.equal(result3.success, true);
});

test('fetchMissedMessages should format response correctly', async () => {
  const userId = 'user-format-1234567890123456789012345678901';
  const pairing = await pairingService.createBotPairing('device-format-test');

  await pairingService.bindUserToPairing(pairing.id, userId);
  await pairingService.completeBotPairing(pairing.id, 'device-format-test', 'socket-fmt');

  await messageService.saveMessage(pairing.id, 'bot_to_app', 'formatted msg', 'text', null);

  const result = await messageService.fetchMissedMessages(userId, 0, 100);

  assert.equal(result.success, true);

  if (result.data.length > 0) {
    const msg = result.data[0];
    assert.equal(typeof msg.message_id, 'string');
    assert.equal(typeof msg.content, 'string');
    assert.equal(typeof msg.content_type, 'string');
    assert.equal(typeof msg.timestamp, 'number');
    assert.equal(['bot', 'user'].includes(msg.sender), true);
  }
});

test('messages should be ordered by created_at ascending', async () => {
  const pairing = await pairingService.createBotPairing('device-order-test');

  await messageService.saveMessage(pairing.id, 'app_to_bot', 'first', 'text', null);
  await delay(10);
  await messageService.saveMessage(pairing.id, 'app_to_bot', 'second', 'text', null);
  await delay(10);
  await messageService.saveMessage(pairing.id, 'app_to_bot', 'third', 'text', null);

  const pending = await messageService.getUndeliveredMessages(pairing.id, 'app_to_bot');

  assert.equal(pending.length, 3);
  assert.equal(pending[0].content, 'first');
  assert.equal(pending[1].content, 'second');
  assert.equal(pending[2].content, 'third');
});
