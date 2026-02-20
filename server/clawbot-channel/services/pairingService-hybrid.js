// ============================================
// Clawbot Channel - 配对服务（混合版本）
// ============================================
// 使用 Supabase 存储配对数据（云端可靠）
// ============================================
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { supabase } = require('../config/database-hybrid');

if (!supabase) {
  console.error('[PairingService] ❌ Supabase 未初始化，配对功能不可用！');
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
const CODE_LENGTH = 6;

class PairingService {
  // 生成安全的配对码
  generatePairingCode() {
    let code = '';
    const randomBytes = crypto.randomBytes(CODE_LENGTH);
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomBytes[i] % CODE_CHARS.length];
    }
    return code;
  }

  // Clawbot 请求配对（生成配对码）
  async createBotPairing(deviceId) {
    try {
      const id = uuidv4();
      const pairingCode = this.generatePairingCode();
      const pairingToken = uuidv4();
      const expiryMs = parseInt(process.env.PAIRING_TOKEN_EXPIRY) || 600000;
      const expiresAt = new Date(Date.now() + expiryMs).toISOString();

      // 使用 Supabase 插入记录
      const { data, error } = await supabase
        .from('pairings')
        .insert({
          id,
          pairing_code: pairingCode,
          pairing_token: pairingToken,
          device_id: deviceId,
          device_name: 'Clawbot',
          status: 'pending',
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[PairingService] ✅ 创建配对: id=${id}, code=${pairingCode}, deviceId=${deviceId}`);

      return {
        id,
        pairingCode,
        pairingToken,
        expiresAt
      };
    } catch (err) {
      console.error(`[PairingService] ❌ createBotPairing 错误:`, err);
      throw new Error(`创建配对失败: ${err.message}`);
    }
  }

  // 绑定 userId 到配对记录
  async bindUserToPairing(pairingId, userId) {
    const { error } = await supabase
      .from('pairings')
      .update({ user_id: userId })
      .eq('id', pairingId);

    if (error) {
      console.error('[PairingService] ❌ bindUserToPairing 错误:', error);
      throw new Error(`绑定用户失败: ${error.message}`);
    }
  }

  // 通过 ID 获取配对信息
  async getPairingById(pairingId) {
    const { data, error } = await supabase
      .from('pairings')
      .select('*')
      .eq('id', pairingId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PairingService] ❌ getPairingById 错误:', error);
      throw error;
    }

    return data || null;
  }

  // Clawbot 确认配对
  async completeBotPairing(pairingId, deviceId, socketId) {
    try {
      console.log(`[PairingService] 🔐 完成配对: pairingId=${pairingId}, deviceId=${deviceId}`);

      const { error } = await supabase
        .from('pairings')
        .update({
          status: 'paired',
          socket_id: socketId,
          paired_at: new Date().toISOString(),
          pairing_code: null,
          pairing_token: null
        })
        .eq('id', pairingId)
        .eq('device_id', deviceId);

      if (error) throw error;

      const pairing = await this.getPairingById(pairingId);

      console.log(`[PairingService] ✅ 配对完成，配对码已失效: pairingId=${pairingId}`);

      return pairing;
    } catch (err) {
      console.error(`[PairingService] ❌ completeBotPairing 错误:`, err);
      throw new Error(`完成配对失败: ${err.message}`);
    }
  }

  // 验证配对码
  async verifyPairingCode(code) {
    try {
      const now = new Date().toISOString();

      const { data: pairing, error } = await supabase
        .from('pairings')
        .select('*')
        .eq('pairing_code', code)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .single();

      if (error || !pairing) {
        return { success: false, error: 'Invalid or expired pairing code' };
      }

      return { success: true, pairing };
    } catch (err) {
      console.error('[PairingService] ❌ verifyPairingCode 错误:', err);
      return { success: false, error: err.message };
    }
  }

  // 验证配对Token（二维码）
  async verifyPairingToken(token) {
    try {
      const now = new Date().toISOString();

      const { data: pairing, error } = await supabase
        .from('pairings')
        .select('*')
        .eq('pairing_token', token)
        .eq('status', 'pending')
        .gt('expires_at', now)
        .single();

      if (error || !pairing) {
        return { success: false, error: 'Invalid or expired pairing token' };
      }

      return { success: true, pairing };
    } catch (err) {
      console.error('[PairingService] ❌ verifyPairingToken 错误:', err);
      return { success: false, error: err.message };
    }
  }

  // 通过 deviceId 获取配对信息
  async getPairingByDeviceId(deviceId) {
    const { data, error } = await supabase
      .from('pairings')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'paired')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PairingService] ❌ getPairingByDeviceId 错误:', error);
      throw error;
    }

    return data || null;
  }

  // 通过 userId 获取配对信息
  async getPairingByUserId(userId) {
    const { data, error } = await supabase
      .from('pairings')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'paired')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[PairingService] ❌ getPairingByUserId 错误:', error);
      throw error;
    }

    return data || null;
  }

  // 解绑
  async unpair(pairingId) {
    const { error } = await supabase
      .from('pairings')
      .update({ status: 'unpaired', socket_id: null })
      .eq('id', pairingId);

    if (error) {
      console.error('[PairingService] ❌ unpair 错误:', error);
      throw new Error(`解绑失败: ${error.message}`);
    }
  }

  // 清理过期配对
  async cleanupExpired() {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('pairings')
        .delete()
        .eq('status', 'pending')
        .lt('expires_at', now)
        .select();

      if (data && data.length > 0) {
        console.log(`[PairingService] 🧹 清理过期配对: ${data.length} 条`);
      }
    } catch (err) {
      console.error('[PairingService] ❌ cleanupExpired 错误:', err);
    }
  }

  // ========== 兼容旧方法 ==========

  async createPairing(userId, deviceName = 'Mobile App') {
    const id = uuidv4();
    const pairingCode = this.generatePairingCode();
    const pairingToken = uuidv4();
    const expiryMs = parseInt(process.env.PAIRING_TOKEN_EXPIRY) || 600000;
    const expiresAt = new Date(Date.now() + expiryMs).toISOString();

    const { data, error } = await supabase
      .from('pairings')
      .insert({
        id,
        pairing_code: pairingCode,
        pairing_token: pairingToken,
        user_id: userId,
        device_name: deviceName,
        status: 'pending',
        expires_at: expiresAt
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id,
      pairingCode,
      pairingToken,
      expiresAt
    };
  }

  async generateQRCodeData(pairingToken) {
    const qrData = JSON.stringify({
      type: 'clawbot_pairing',
      version: '1.0',
      server: 'm.jmtrick.com',
      token: pairingToken,
      timestamp: Date.now()
    });

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

  async completePairing(pairingId, deviceId, socketId) {
    const { error } = await supabase
      .from('pairings')
      .update({
        status: 'paired',
        device_id: deviceId,
        socket_id: socketId,
        paired_at: new Date().toISOString()
      })
      .eq('id', pairingId);

    if (error) throw error;

    await supabase
      .from('pairings')
      .update({ pairing_token: null })
      .eq('id', pairingId);

    return await this.getPairingById(pairingId);
  }
}

module.exports = new PairingService();
