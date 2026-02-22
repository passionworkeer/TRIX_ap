/**
 * Extended tests for pairing service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('os');
const path = require('path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawbot-pairing-extended-'));
const dbPath = path.join(tempDir, 'pairing-extended-test.db');

process.env.DATABASE_PATH = dbPath;
process.env.PAIRING_TOKEN_EXPIRY = '600000';

const { initDatabase, db, dbGet, dbRun } = require('../config/database');
const pairingService = require('../services/pairingService');

initDatabase();

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSchema() {
  for (let i = 0; i < 20; i += 1) {
    const row = await dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='pairings'");
    if (row) return;
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

test('generatePairingCode should generate valid 6-character code', () => {
  const code = pairingService.generatePairingCode();

  assert.equal(typeof code, 'string');
  assert.equal(code.length, 6);

  // Should only contain allowed characters
  const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (const char of code) {
    assert.equal(allowedChars.includes(char), true, `Invalid char: ${char}`);
  }
});

test('generatePairingCode should not contain confusing characters', () => {
  // Generate multiple codes and check none contain confusing chars
  for (let i = 0; i < 100; i += 1) {
    const code = pairingService.generatePairingCode();
    assert.equal(code.includes('O'), false, 'Should not contain O (looks like 0)');
    assert.equal(code.includes('0'), false, 'Should not contain 0 (looks like O)');
    assert.equal(code.includes('I'), false, 'Should not contain I (looks like 1)');
    assert.equal(code.includes('1'), false, 'Should not contain 1 (looks like I)');
  }
});

test('generatePairingCode should generate unique codes', () => {
  const codes = new Set();
  for (let i = 0; i < 1000; i += 1) {
    codes.add(pairingService.generatePairingCode());
  }
  // With 1000 codes, we expect near-100% uniqueness
  assert.equal(codes.size > 990, true, 'Codes should be mostly unique');
});

test('createBotPairing should create pairing with all required fields', async () => {
  const result = await pairingService.createBotPairing('device-fields-test');

  assert.equal(typeof result.id, 'string');
  assert.equal(typeof result.pairingCode, 'string');
  assert.equal(typeof result.pairingToken, 'string');
  assert.equal(typeof result.expiresAt, 'string');

  // Verify UUID format for id and token
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  assert.equal(uuidRegex.test(result.id), true, 'id should be UUID');
  assert.equal(uuidRegex.test(result.pairingToken), true, 'pairingToken should be UUID');
});

test('verifyPairingCode should return error for invalid code', async () => {
  const result = await pairingService.verifyPairingCode('INVALID');

  assert.equal(result.success, false);
  assert.equal(typeof result.error, 'string');
});

test('verifyPairingCode should return error for expired code', async () => {
  // Create pairing with immediate expiry
  const result = await pairingService.createBotPairing('device-expired-test');

  // Manually expire the pairing
  await dbRun(
    "UPDATE pairings SET expires_at = datetime('now', '-1 day') WHERE id = ?",
    [result.id]
  );

  const verifyResult = await pairingService.verifyPairingCode(result.pairingCode);

  assert.equal(verifyResult.success, false);
  assert.equal(verifyResult.error.includes('expired'), true);
});

test('verifyPairingToken should validate correct token', async () => {
  const result = await pairingService.createBotPairing('device-token-test');
  const verifyResult = await pairingService.verifyPairingToken(result.pairingToken);

  assert.equal(verifyResult.success, true);
  assert.equal(verifyResult.pairing.id, result.id);
});

test('verifyPairingToken should reject invalid token', async () => {
  const result = await pairingService.verifyPairingToken('invalid-token-uuid');

  assert.equal(result.success, false);
});

test('completeBotPairing should clear pairing code and token', async () => {
  const userId = 'user-complete-12345678901234567890123456';
  const result = await pairingService.createBotPairing('device-complete-test');

  await pairingService.bindUserToPairing(result.id, userId);
  await pairingService.completeBotPairing(result.id, 'device-complete-test', 'socket-complete');

  const pairing = await pairingService.getPairingById(result.id);

  assert.equal(pairing.status, 'paired');
  assert.equal(pairing.pairing_code, null, 'pairing_code should be cleared');
  assert.equal(pairing.pairing_token, null, 'pairing_token should be cleared');
  assert.equal(pairing.user_id, userId);
  assert.equal(pairing.socket_id, 'socket-complete');
});

test('getPairingByDeviceId should return null for unknown device', async () => {
  const result = await pairingService.getPairingByDeviceId('unknown-device-id');

  assert.equal(result, undefined);
});

test('getPairingByUserId should return null for unknown user', async () => {
  const result = await pairingService.getPairingByUserId('unknown-user-id');

  assert.equal(result, undefined);
});

test('unpair should update status to unpaired', async () => {
  const userId = 'user-unpair-1234567890123456789012345678';
  const result = await pairingService.createBotPairing('device-unpair-test');

  await pairingService.bindUserToPairing(result.id, userId);
  await pairingService.completeBotPairing(result.id, 'device-unpair-test', 'socket-unpair');

  await pairingService.unpair(result.id);

  const pairing = await pairingService.getPairingById(result.id);
  assert.equal(pairing.status, 'unpaired');
  assert.equal(pairing.socket_id, null);
});

test('cleanupExpired should remove expired pairings', async () => {
  // Create multiple pairings, some expired
  const p1 = await pairingService.createBotPairing('device-cleanup-1');
  const p2 = await pairingService.createBotPairing('device-cleanup-2');

  // Expire one
  await dbRun(
    "UPDATE pairings SET expires_at = datetime('now', '-1 day') WHERE id = ?",
    [p1.id]
  );

  await pairingService.cleanupExpired();

  // Expired pairing should be gone
  const expiredResult = await pairingService.verifyPairingCode(p1.pairingCode);
  assert.equal(expiredResult.success, false);

  // Valid pairing should still work
  const validResult = await pairingService.verifyPairingCode(p2.pairingCode);
  assert.equal(validResult.success, true);
});

test('generateQRCodeData should return valid QR data', async () => {
  const { pairingToken } = await pairingService.createBotPairing('device-qr-test');
  const qrResult = await pairingService.generateQRCodeData(pairingToken);

  assert.equal(typeof qrResult.qrData, 'string');
  assert.equal(typeof qrResult.qrImage, 'string');

  // QR data should be valid JSON
  const parsed = JSON.parse(qrResult.qrData);
  assert.equal(parsed.type, 'clawbot_pairing');
  assert.equal(parsed.token, pairingToken);

  // QR image should be data URL
  assert.equal(qrResult.qrImage.startsWith('data:image/png;base64,'), true);
});

test('bindUserToPairing should associate user with pairing', async () => {
  const userId = 'user-bind-123456789012345678901234567890';
  const result = await pairingService.createBotPairing('device-bind-test');

  await pairingService.bindUserToPairing(result.id, userId);

  const pairing = await pairingService.getPairingById(result.id);
  assert.equal(pairing.user_id, userId);
});

test('pairing lifecycle should work end-to-end', async () => {
  const userId = 'user-e2e-12345678901234567890123456789012';
  const deviceId = 'device-e2e-test';

  // 1. Bot requests pairing
  const created = await pairingService.createBotPairing(deviceId);
  assert.equal(typeof created.pairingCode, 'string');

  // 2. User verifies code
  const verified = await pairingService.verifyPairingCode(created.pairingCode);
  assert.equal(verified.success, true);

  // 3. Bind user
  await pairingService.bindUserToPairing(verified.pairing.id, userId);

  // 4. Complete pairing
  await pairingService.completeBotPairing(
    verified.pairing.id,
    deviceId,
    'socket-e2e'
  );

  // 5. Verify final state
  const final = await pairingService.getPairingById(verified.pairing.id);
  assert.equal(final.status, 'paired');
  assert.equal(final.user_id, userId);
  assert.equal(final.pairing_code, null);
  assert.equal(final.pairing_token, null);

  // 6. Can lookup by userId
  const byUser = await pairingService.getPairingByUserId(userId);
  assert.equal(byUser.id, final.id);
});

test('pairing code should be single-use after completion', async () => {
  const userId = 'user-single-123456789012345678901234567890';
  const created = await pairingService.createBotPairing('device-single-test');

  // First verification should work
  const first = await pairingService.verifyPairingCode(created.pairingCode);
  assert.equal(first.success, true);

  // Complete the pairing
  await pairingService.bindUserToPairing(first.pairing.id, userId);
  await pairingService.completeBotPairing(first.pairing.id, 'device-single-test', 'socket-single');

  // Code should no longer work
  const second = await pairingService.verifyPairingCode(created.pairingCode);
  assert.equal(second.success, false);
});
