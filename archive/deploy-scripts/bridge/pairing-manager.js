/**
 * OpenClaw 配对管理器
 * 直接在本地运行，生成配对码和二维码
 *
 * 运行方式：
 * node pairing-manager.js
 * 或
 * node pairing-manager.js generate-code  # 生成配对码
 * node pairing-manager.js generate-qr    # 生成二维码
 * node pairing-manager.js list           # 查看有效配对
 */

const crypto = require('crypto');

// 配对码存储
const pairingCodes = new Map();
const qrTokens = new Map();

// 生成6位配对码
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

// 生成配对码
function createPairingCode() {
  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  pairingCodes.set(code, {
    code,
    createdAt: new Date(),
    expiresAt,
    status: 'pending'
  });

  return {
    code,
    expiresAt,
    expiresIn: 300 // 5分钟
  };
}

// 生成二维码Token
function createQRToken() {
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  qrTokens.set(token, {
    token,
    createdAt: new Date(),
    expiresAt,
    status: 'pending'
  });

  return {
    token,
    qrUrl: `trix://pair/${token}`,
    expiresAt,
    expiresIn: 300
  };
}

// 格式化时间
function formatTime(date) {
  return date.toTimeString().split(' ')[0];
}

// 倒计时显示
function showCountdown(expiresAt) {
  const now = new Date();
  const remaining = Math.floor((expiresAt - now) / 1000);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}分${seconds}秒`;
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(`
╔═══════════════════════════════════════════════════════╗
║        OpenClaw 配对管理器                             ║
╠═══════════════════════════════════════════════════════╣
║  用于生成配对码和二维码，连接手机App                   ║
╚═══════════════════════════════════════════════════════╝
`);

  if (command === 'generate-code' || command === 'code') {
    const pairing = createPairingCode();
    console.log(`✅ 配对码已生成\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  配对码:  ${pairing.code}`);
    console.log(`  有效期:  ${showCountdown(pairing.expiresAt)}`);
    console.log(`  过期时间: ${formatTime(pairing.expiresAt)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`📱 请在手机App中输入此配对码\n`);

  } else if (command === 'generate-qr' || command === 'qr') {
    const qr = createQRToken();
    console.log(`✅ 二维码已生成\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Token:   ${qr.token}`);
    console.log(`  二维码:   ${qr.qrUrl}`);
    console.log(`  有效期:  ${showCountdown(qr.expiresAt)}`);
    console.log(`  过期时间: ${formatTime(qr.expiresAt)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log(`📱 请在手机App中扫描二维码\n`);
    console.log(`提示: 可以使用在线二维码生成器将以下URL生成二维码`);
    console.log(`      https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr.qrUrl)}\n`);

  } else if (command === 'list' || command === 'l') {
    const now = new Date();
    const activeCodes = Array.from(pairingCodes.values())
      .filter(p => p.status === 'pending' && p.expiresAt > now);

    const activeTokens = Array.from(qrTokens.values())
      .filter(p => p.status === 'pending' && p.expiresAt > now);

    console.log(`📋 当前有效的配对\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (activeCodes.length > 0) {
      console.log(`配对码 (${activeCodes.length}个):`);
      activeCodes.forEach(p => {
        console.log(`  • ${p.code} - 剩余 ${showCountdown(p.expiresAt)}`);
      });
      console.log('');
    }

    if (activeTokens.length > 0) {
      console.log(`二维码 (${activeTokens.length}个):`);
      activeTokens.forEach(p => {
        console.log(`  • ${p.token.substring(0, 8)}... - 剩余 ${showCountdown(p.expiresAt)}`);
      });
      console.log('');
    }

    if (activeCodes.length === 0 && activeTokens.length === 0) {
      console.log(`  暂无有效的配对码或二维码\n`);
      console.log(`使用方法:`);
      console.log(`  node pairing-manager.js generate-code  # 生成配对码`);
      console.log(`  node pairing-manager.js generate-qr    # 生成二维码\n`);
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } else {
    console.log(`使用方法:\n`);
    console.log(`  node pairing-manager.js generate-code  # 生成配对码`);
    console.log(`  node pairing-manager.js generate-qr    # 生成二维码`);
    console.log(`  node pairing-manager.js list           # 查看有效配对\n`);
    console.log(`示例:\n`);
    console.log(`  node pairing-manager.js generate-code`);
    console.log(`  输出: 配对码: ABC123\n`);
  }
}

// 运行
main().catch(console.error);
