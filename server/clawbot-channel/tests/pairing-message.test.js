const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbot-channel-test-'));
const dbPath = path.join(tempDir, 'pairing-test.db');

process.env.DATABASE_PATH = dbPath;
process.env.PAIRING_TOKEN_EXPIRY = '600000';

const { initDatabase, db, dbGet } = require('../config/database');
const pairingService = require('../services/pairingService');
const messageService = require('../services/messageService');

initDatabase();

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSchema() {
  for (let i = 0; i < 20; i += 1) {
    const row = await dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='pairings'");
    if (row) {
      return;
    }
    await delay(50);
  }

  throw new Error('Database schema init timed out');
}

test.before(async () => {
  await waitForSchema();
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

test('pairing lifecycle should clear one-time code/token after complete', async () => {
  const userId = 'user-123456789012345678901234567890';

  const created = await pairingService.createBotPairing('device-test-a');
  assert.equal(typeof created.pairingCode, 'string');
  assert.equal(typeof created.pairingToken, 'string');

  const verified = await pairingService.verifyPairingToken(created.pairingToken);
  assert.equal(verified.success, true);

  await pairingService.bindUserToPairing(verified.pairing.id, userId);
  await pairingService.completeBotPairing(verified.pairing.id, 'device-test-a', 'socket-a');

  const paired = await pairingService.getPairingById(verified.pairing.id);
  assert.equal(paired.status, 'paired');
  assert.equal(paired.user_id, userId);
  assert.equal(paired.pairing_code, null);
  assert.equal(paired.pairing_token, null);
});

test('message delivery flow should mark undelivered message as delivered', async () => {
  const created = await pairingService.createBotPairing('device-test-b');
  const verified = await pairingService.verifyPairingToken(created.pairingToken);

  const messageId = await messageService.saveMessage(
    verified.pairing.id,
    'app_to_bot',
    'hello from test',
    'text',
    null
  );

  const pending = await messageService.getUndeliveredMessages(verified.pairing.id, 'app_to_bot');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, messageId);

  await messageService.markDelivered(messageId);

  const afterDelivered = await messageService.getUndeliveredMessages(verified.pairing.id, 'app_to_bot');
  assert.equal(afterDelivered.length, 0);
});
