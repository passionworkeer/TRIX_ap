const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { dbRun, dbGet } = require('../config/database');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
const CODE_LENGTH = 6;

class PairingService {
  // 生成配对码
  generatePairingCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  // ========== 新方法：Clawbot 发起配对 ==========

  // Clawbot 请求配对（生成配对码/二维码）
  async createBotPairing(deviceId) {
    const id = uuidv4();
    const pairingCode = this.generatePairingCode();
    const pairingToken = uuidv4();
    const expiryMs = parseInt(process.env.PAIRING_TOKEN_EXPIRY) || 600000;
    const expiresAt = new Date(Date.now() + expiryMs).toISOString();

    // 创建配对记录（user_id 暂时为 NULL，等待 App 连接）
    await dbRun(`
      INSERT INTO pairings (id, pairing_code, pairing_token, device_id, device_name, status, expires_at)
      VALUES (?, ?, ?, ?, 'Clawbot', 'pending', ?)
    `, [id, pairingCode, pairingToken, deviceId, expiresAt]);

    return {
      id,
      pairingCode,
      pairingToken,
      expiresAt
    };
  }

  // 绑定 userId 到配对记录（App 验证配对码后）
  async bindUserToPairing(pairingId, userId) {
    await dbRun(`
      UPDATE pairings
      SET user_id = ?
      WHERE id = ?
    `, [userId, pairingId]);
  }

  // 通过 ID 获取配对信息
  async getPairingById(pairingId) {
    return await dbGet(`
      SELECT * FROM pairings
      WHERE id = ?
    `, [pairingId]);
  }

  // Clawbot 确认配对（当 App 验证配对码后）
  async completeBotPairing(pairingId, deviceId, socketId) {
    await dbRun(`
      UPDATE pairings
      SET status = 'paired', socket_id = ?, paired_at = datetime('now')
      WHERE id = ? AND device_id = ?
    `, [socketId, pairingId, deviceId]);

    // 使 Token 失效（一次性）
    await dbRun(`
      UPDATE pairings SET pairing_token = NULL WHERE id = ?
    `, [pairingId]);

    return await dbGet('SELECT * FROM pairings WHERE id = ?', [pairingId]);
  }

  // ========== 原有方法 ==========

  // 创建新的配对请求（App 发起，已废弃）
  async createPairing(userId, deviceName = 'Mobile App') {
    const id = uuidv4();
    const pairingCode = this.generatePairingCode();
    const pairingToken = uuidv4();
    const expiryMs = parseInt(process.env.PAIRING_TOKEN_EXPIRY) || 600000;
    const expiresAt = new Date(Date.now() + expiryMs).toISOString();

    await dbRun(`
      INSERT INTO pairings (id, pairing_code, pairing_token, user_id, device_name, status, expires_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [id, pairingCode, pairingToken, userId, deviceName, expiresAt]);

    return {
      id,
      pairingCode,
      pairingToken,
      expiresAt
    };
  }

  // 生成二维码数据
  async generateQRCodeData(pairingToken) {
    const qrData = JSON.stringify({
      type: 'clawbot_pairing',
      version: '1.0',
      server: 'm.jmtrick.com',
      token: pairingToken,
      timestamp: Date.now()
    });

    // 生成二维码图片（Data URL）
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return { qrData, qrImage };
  }

  // 验证配对码
  async verifyPairingCode(code) {
    const pairing = await dbGet(`
      SELECT * FROM pairings
      WHERE pairing_code = ? AND status = 'pending' AND expires_at > datetime('now')
    `, [code]);

    if (!pairing) {
      return { success: false, error: 'Invalid or expired pairing code' };
    }

    return { success: true, pairing };
  }

  // 验证配对Token（二维码）
  async verifyPairingToken(token) {
    const pairing = await dbGet(`
      SELECT * FROM pairings
      WHERE pairing_token = ? AND status = 'pending' AND expires_at > datetime('now')
    `, [token]);

    if (!pairing) {
      return { success: false, error: 'Invalid or expired pairing token' };
    }

    return { success: true, pairing };
  }

  // 完成配对（Clawbot连接后调用）
  async completePairing(pairingId, deviceId, socketId) {
    await dbRun(`
      UPDATE pairings
      SET status = 'paired', device_id = ?, socket_id = ?, paired_at = datetime('now')
      WHERE id = ?
    `, [deviceId, socketId, pairingId]);

    // 使 Token 失效（一次性）
    await dbRun(`
      UPDATE pairings SET pairing_token = NULL WHERE id = ?
    `, [pairingId]);

    return await dbGet('SELECT * FROM pairings WHERE id = ?', [pairingId]);
  }

  // 通过 deviceId 获取配对信息
  async getPairingByDeviceId(deviceId) {
    return await dbGet(`
      SELECT * FROM pairings
      WHERE device_id = ? AND status = 'paired'
    `, [deviceId]);
  }

  // 通过 userId 获取配对信息
  async getPairingByUserId(userId) {
    return await dbGet(`
      SELECT * FROM pairings
      WHERE user_id = ? AND status = 'paired'
    `, [userId]);
  }

  // 解绑
  async unpair(pairingId) {
    await dbRun(`
      UPDATE pairings SET status = 'unpaired', socket_id = NULL WHERE id = ?
    `, [pairingId]);
  }

  // 清理过期配对
  async cleanupExpired() {
    await dbRun(`
      DELETE FROM pairings
      WHERE status = 'pending' AND expires_at < datetime('now')
    `);
  }
}

module.exports = new PairingService();
