/**
 * OpenClaw Pairing Skill
 *
 * 功能：生成配对码和二维码，用于手机App配对连接
 *
 * 使用方式：
 * 用户对话中输入：
 * - "生成配对码"
 * - "给我一个配对码"
 * - "pairing code"
 * - "生成二维码"
 *
 * 作者：TRIX Team
 * 版本：1.0.0
 */

const crypto = require('crypto');

// 配对码存储（内存存储，实际应用中可用Redis）
const pairingStore = {
  codes: new Map(),
  tokens: new Map()
};

// 生成6位配对码（排除易混淆字符）
function generatePairingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 生成二维码Token
function generateQRToken() {
  return crypto.randomBytes(16).toString('hex');
}

// 格式化剩余时间
function formatRemainingTime(expiresAt) {
  const now = new Date();
  const remaining = Math.floor((expiresAt - now) / 1000);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}分${seconds}秒`;
}

/**
 * Skill主函数
 * @param {Object} params - 参数对象
 * @param {string} params.message - 用户消息
 * @param {Object} params.config - 配置对象
 * @returns {Promise<Object>} - 返回结果
 */
async function skill(params) {
  const { message, config } = params;

  // 清理过期配对码
  const now = new Date();
  for (const [key, value] of pairingStore.codes.entries()) {
    if (value.expiresAt < now) {
      pairingStore.codes.delete(key);
    }
  }
  for (const [key, value] of pairingStore.tokens.entries()) {
    if (value.expiresAt < now) {
      pairingStore.tokens.delete(key);
    }
  }

  // 解析用户意图
  const msg = message.toLowerCase();

  // 判断用户想要什么
  if (msg.includes('配对码') || msg.includes('pairing') || msg.includes('配对')) {
    // 生成配对码
    return await generatePairingCode();
  } else if (msg.includes('二维码') || msg.includes('qr') || msg.includes('扫码')) {
    // 生成二维码
    return await generateQRCode();
  } else {
    // 默认生成配对码
    return await generatePairingCode();
  }
}

/**
 * 生成配对码
 */
async function generatePairingCode() {
  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期

  pairingStore.codes.set(code, {
    code,
    createdAt: new Date(),
    expiresAt,
    status: 'pending'
  });

  return {
    success: true,
    type: 'pairing_code',
    data: {
      code: code,
      expiresAt: expiresAt.toISOString(),
      remaining: formatRemainingTime(expiresAt)
    },
    message: `✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：${code}
⏰ 有效期：${formatRemainingTime(expiresAt)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 进入配对页面
3. 输入配对码：${code}
4. 点击确认配对

配对成功后即可开始聊天！`
  };
}

/**
 * 生成二维码
 */
async function generateQRCode() {
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期

  pairingStore.tokens.set(token, {
    token,
    createdAt: new Date(),
    expiresAt,
    status: 'pending'
  });

  // 生成二维码URL（手机App扫描此URL）
  const qrUrl = `trix://pair/${token}`;

  // 在线二维码生成器URL
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;

  return {
    success: true,
    type: 'qr_code',
    data: {
      token: token,
      qrUrl: qrUrl,
      qrImageUrl: qrImageUrl,
      expiresAt: expiresAt.toISOString(),
      remaining: formatRemainingTime(expiresAt)
    },
    message: `✅ 二维码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Token：${token.substring(0, 8)}...
⏰ 有效期：${formatRemainingTime(expiresAt)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 进入配对页面
3. 扫描二维码

或者访问以下地址查看二维码：
${qrImageUrl}

配对成功后即可开始聊天！`
  };
}

/**
 * 导出Skill元数据
 */
module.exports = {
  name: 'pairing',
  description: '生成配对码和二维码，用于手机App配对',
  version: '1.0.0',
  author: 'TRIX Team',

  // Skill入口函数
  handler: skill,

  // 触发关键词
  triggers: [
    '生成配对码',
    '配对码',
    '给我配对码',
    'pairing code',
    'generate pairing',
    '生成二维码',
    'qr code',
    '扫码配对',
    '我要配对'
  ],

  // 示例对话
  examples: [
    {
      input: '生成配对码',
      output: '✅ 配对码已生成！\n📱 配对码：ABC123\n⏰ 有效期：5分0秒'
    },
    {
      input: '生成二维码',
      output: '✅ 二维码已生成！\n🔑 Token：a1b2c3d4...\n⏰ 有效期：5分0秒'
    }
  ],

  // 配置选项
  options: {
    expiresIn: 300, // 配对码有效期（秒）
    codeLength: 6,  // 配对码长度
    codeChars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 配对码字符集
  }
};
