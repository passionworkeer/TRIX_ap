/**
 * OpenClaw Pairing Skill
 *
 * 功能：生成配对码和二维码，用于手机App配对连接
 * ✅ 修复：通过 Socket.IO 连接到服务器，使用数据库存储配对码
 *
 * 使用方式：
 * - "生成配对码"
 * - "给我一个配对码"
 * - "pairing code"
 *
 * 作者：TRIX Team
 * 版本：2.0.0
 */

const { io } = require('socket.io-client');

// 配置
const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://47.243.55.130:8765';
let socket = null;

/**
 * 获取或创建 Socket 连接
 */
function getSocket() {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) {
      return resolve(socket);
    }

    // 创建新连接
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log(`[PairingSkill] ✅ 已连接到服务器: ${SERVER_URL}`);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      console.error('[PairingSkill] ❌ 连接失败:', err);
      reject(new Error(`无法连接到服务器: ${err.message}`));
    });

    socket.on('disconnect', () => {
      console.log('[PairingSkill] ⚠️  已断开连接');
    });

    // 连接超时
    setTimeout(() => {
      if (!socket || !socket.connected) {
        reject(new Error('连接超时'));
      }
    }, 5000);
  });
}

/**
 * 格式化剩余时间
 */
function formatRemainingTime(expiresAt) {
  const now = new Date();
  const remaining = Math.floor((new Date(expiresAt) - now) / 1000);
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
  const { message } = params;

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
 * 生成配对码（通过服务器）
 */
async function generatePairingCode() {
  try {
    const sock = await getSocket();

    return new Promise((resolve, reject) => {
      // 生成设备ID（使用进程ID或固定标识）
      const deviceId = `clawbot_${process.pid || 'default'}`;

      sock.emit('bot_request_pairing', { deviceId }, (response) => {
        if (response.success) {
          console.log('[PairingSkill] ✅ 配对码已生成:', response.pairingCode);

          resolve({
            success: true,
            type: 'pairing_code',
            data: {
              code: response.pairingCode,
              expiresAt: response.expiresAt,
              remaining: formatRemainingTime(response.expiresAt)
            },
            message: `✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：${response.pairingCode}
⏰ 有效期：${formatRemainingTime(response.expiresAt)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 进入配对页面
3. 输入配对码：${response.pairingCode}
4. 点击确认配对

配对成功后即可开始聊天！`
          });
        } else {
          console.error('[PairingSkill] ❌ 生成失败:', response.error);
          resolve({
            success: false,
            error: response.error || '生成配对码失败',
            message: `❌ ${response.error || '生成配对码失败'}`
          });
        }
      });

      // 超时处理
      setTimeout(() => {
        resolve({
          success: false,
          error: '请求超时',
          message: '❌ 请求超时，请检查服务器连接'
        });
      }, 5000);
    });
  } catch (error) {
    console.error('[PairingSkill] ❌ 生成配对码错误:', error);
    return {
      success: false,
      error: error.message || '无法连接到服务器',
      message: `❌ 无法连接到服务器: ${error.message}`
    };
  }
}

/**
 * 生成二维码Token（通过服务器）
 */
async function generateQRCode() {
  try {
    const sock = await getSocket();

    return new Promise((resolve, reject) => {
      const deviceId = `clawbot_${process.pid || 'default'}`;

      sock.emit('bot_request_pairing', { deviceId }, (response) => {
        if (response.success) {
          // 生成二维码URL（手机App扫描此URL）
          const qrUrl = `trix://pair/${response.pairingToken}`;

          // 在线二维码生成器URL
          const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;

          console.log('[PairingSkill] ✅ 二维码已生成');

          resolve({
            success: true,
            type: 'qr_code',
            data: {
              token: response.pairingToken,
              qrUrl: qrUrl,
              qrImageUrl: qrImageUrl,
              expiresAt: response.expiresAt,
              remaining: formatRemainingTime(response.expiresAt)
            },
            message: `✅ 二维码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Token：${response.pairingToken.substring(0, 8)}...
⏰ 有效期：${formatRemainingTime(response.expiresAt)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 进入配对页面
3. 扫描二维码

或者访问以下地址查看二维码：
${qrImageUrl}

配对成功后即可开始聊天！`
          });
        } else {
          console.error('[PairingSkill] ❌ 生成失败:', response.error);
          resolve({
            success: false,
            error: response.error || '生成二维码失败',
            message: `❌ ${response.error || '生成二维码失败'}`
          });
        }
      });

      // 超时处理
      setTimeout(() => {
        resolve({
          success: false,
          error: '请求超时',
          message: '❌ 请求超时，请检查服务器连接'
        });
      }, 5000);
    });
  } catch (error) {
    console.error('[PairingSkill] ❌ 生成二维码错误:', error);
    return {
      success: false,
      error: error.message || '无法连接到服务器',
      message: `❌ 无法连接到服务器: ${error.message}`
    };
  }
}

/**
 * 导出Skill元数据
 */
module.exports = {
  name: 'pairing',
  description: '生成配对码和二维码，用于手机App配对（通过服务器）',
  version: '2.0.0',
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
    serverUrl: SERVER_URL,
    expiresIn: 300, // 配对码有效期（秒）
    codeLength: 6,  // 配对码长度
    timeout: 5000   // 请求超时（毫秒）
  }
};
