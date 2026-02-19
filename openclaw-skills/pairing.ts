/**
 * OpenClaw Pairing Skill
 * 生成配对码和二维码，用于手机App配对
 *
 * 使用方法：
 * 1. 在OpenClaw中输入: "生成配对码" 或 "pairing code"
 * 2. OpenClaw会生成6位配对码
 * 3. 手机App输入配对码完成配对
 */

import { randomBytes } from 'crypto';

// 配对码存储（实际应用中应该使用Redis或数据库）
const pairingCodes = new Map<string, {
  code: string;
  userId?: string;
  deviceId?: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'active' | 'expired';
}>();

// 二维码Token存储
const qrTokens = new Map<string, {
  token: string;
  userId?: string;
  deviceId?: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'active' | 'expired';
}>();

// 清理过期配对码
setInterval(() => {
  const now = new Date();
  for (const [key, value] of pairingCodes.entries()) {
    if (value.expiresAt < now) {
      value.status = 'expired';
      pairingCodes.delete(key);
    }
  }
  for (const [key, value] of qrTokens.entries()) {
    if (value.expiresAt < now) {
      value.status = 'expired';
      qrTokens.delete(key);
    }
  }
}, 60000); // 每分钟清理一次

/**
 * 生成6位配对码
 */
function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * 生成二维码Token
 */
function generateQRToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * 生成配对码
 */
export async function generatePairingCode() {
  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期

  pairingCodes.set(code, {
    code,
    createdAt: new Date(),
    expiresAt,
    status: 'pending'
  });

  return {
    success: true,
    code,
    expiresAt: expiresAt.toISOString(),
    message: `配对码: ${code}\n有效期: 5分钟\n请在手机App中输入此配对码`
  };
}

/**
 * 生成二维码Token
 */
export async function generateQRCode() {
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期

  qrTokens.set(token, {
    token,
    createdAt: new Date(),
    expiresAt,
    status: 'pending'
  });

  // 生成二维码URL（手机App扫描此URL）
  const qrUrl = `trix://pair/${token}`;

  return {
    success: true,
    token,
    qrUrl,
    expiresAt: expiresAt.toISOString(),
    message: `二维码已生成\nToken: ${token}\n有效期: 5分钟\n请在手机App中扫描二维码`
  };
}

/**
 * 验证配对码
 */
export async function validatePairingCode(code: string, userId: string) {
  const pairing = pairingCodes.get(code.toUpperCase());

  if (!pairing) {
    return {
      success: false,
      error: '配对码无效或已过期'
    };
  }

  if (pairing.status === 'expired' || pairing.expiresAt < new Date()) {
    pairingCodes.delete(code);
    return {
      success: false,
      error: '配对码已过期'
    };
  }

  if (pairing.status === 'active') {
    return {
      success: false,
      error: '配对码已被使用'
    };
  }

  // 激活配对
  pairing.userId = userId;
  pairing.status = 'active';

  return {
    success: true,
    pairingId: code,
    message: '配对成功！'
  };
}

/**
 * 验证二维码Token
 */
export async function validateQRToken(token: string, userId: string) {
  const pairing = qrTokens.get(token);

  if (!pairing) {
    return {
      success: false,
      error: 'Token无效或已过期'
    };
  }

  if (pairing.status === 'expired' || pairing.expiresAt < new Date()) {
    qrTokens.delete(token);
    return {
      success: false,
      error: 'Token已过期'
    };
  }

  if (pairing.status === 'active') {
    return {
      success: false,
      error: 'Token已被使用'
    };
  }

  // 激活配对
  pairing.userId = userId;
  pairing.status = 'active';

  return {
    success: true,
    pairingId: token,
    message: '配对成功！'
  };
}

/**
 * 查看当前有效的配对码
 */
export async function listActivePairings() {
  const now = new Date();
  const activeCodes = Array.from(pairingCodes.values())
    .filter(p => p.status === 'pending' && p.expiresAt > now)
    .map(p => ({
      code: p.code,
      expiresAt: p.expiresAt.toISOString(),
      remainingSeconds: Math.floor((p.expiresAt.getTime() - now.getTime()) / 1000)
    }));

  const activeTokens = Array.from(qrTokens.values())
    .filter(p => p.status === 'pending' && p.expiresAt > now)
    .map(p => ({
      token: p.token,
      expiresAt: p.expiresAt.toISOString(),
      remainingSeconds: Math.floor((p.expiresAt.getTime() - now.getTime()) / 1000)
    }));

  return {
    success: true,
    pairingCodes: activeCodes,
    qrTokens: activeTokens,
    message: activeCodes.length > 0 || activeTokens.length > 0
      ? `当前有 ${activeCodes.length} 个配对码和 ${activeTokens.length} 个二维码有效`
      : '当前没有有效的配对码'
  };
}

// 技能元数据
export const metadata = {
  name: 'pairing',
  description: '生成配对码和二维码，用于手机App配对',
  version: '1.0.0',
  author: 'TRIX Team'
};
