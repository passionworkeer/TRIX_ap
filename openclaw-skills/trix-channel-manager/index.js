/**
 * TRIX Channel Manager Skill for OpenClaw
 *
 * 管理和启动 TRIX App Channel
 *
 * 作者：TRIX Team
 * 版本：1.0.0
 */

const { spawn } = require('child_process');
const path = require('path');

// 配置
const CHANNEL_PATH = path.join(__dirname, 'trix-channel');
let channelProcess = null;
let isRunning = false;

/**
 * 启动 TRIX Channel
 */
async function startChannel() {
  if (isRunning) {
    return {
      success: true,
      message: '✅ TRIX Channel 已在运行中'
    };
  }

  console.log('[TRIXManager] 🚀 启动 TRIX Channel...');

  return new Promise((resolve, reject) => {
    channelProcess = spawn('node', ['index.js'], {
      cwd: CHANNEL_PATH,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    let output = '';
    let errors = '';

    channelProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[TRIX Channel]', text.trim());

      // 检测启动成功
      if (text.includes('✅ TRIX Channel 已启动') || text.includes('✅ 已连接到')) {
        isRunning = true;
        resolve({
          success: true,
          message: `✅ TRIX Channel 已启动

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务器: http://47.243.55.130:8765
🌐 Gateway: ws://127.0.0.1:18789
✅ 状态: 运行中
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 下一步：
1. 在 App 中输入配对码
2. 开始实时聊天！`
        });
      }
    });

    channelProcess.stderr.on('data', (data) => {
      const text = data.toString();
      errors += text;
      console.error('[TRIX Channel Error]', text.trim());
    });

    channelProcess.on('error', (err) => {
      console.error('[TRIXManager] ❌ 启动失败:', err);
      reject(new Error(`启动失败: ${err.message}`));
    });

    channelProcess.on('exit', (code) => {
      console.log('[TRIXManager] ⚠️  Channel 已退出, code:', code);
      isRunning = false;
      channelProcess = null;
    });

    // 超时处理
    setTimeout(() => {
      if (!isRunning) {
        // 即使没有明确的启动消息，如果进程在运行，也算启动
        if (channelProcess && !channelProcess.killed) {
          isRunning = true;
          resolve({
            success: true,
            message: `✅ TRIX Channel 进程已启动

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务器: http://47.243.55.130:8765
🌐 Gateway: ws://127.0.0.1:18789
⚠️  请检查日志确认状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          });
        } else {
          reject(new Error('启动超时'));
        }
      }
    }, 5000);
  });
}

/**
 * 生成配对码
 */
async function generatePairingCode() {
  if (!isRunning) {
    return {
      success: false,
      error: 'Channel 未启动，请先运行 "启动 TRIX Channel"',
      message: '❌ Channel 未启动，请先运行 "启动 TRIX Channel"'
    };
  }

  // 动态调用 trix-channel 的方法
  const trixChannel = require(path.join(CHANNEL_PATH, 'index.js'));

  try {
    const result = await trixChannel.generatePairingCode();
    return {
      success: true,
      code: result.code,
      pairingId: result.pairingId,
      expiresAt: result.expiresAt,
      message: `✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：${result.code}
🔗 配对ID：${result.pairingId}
⏰ 有效期：5分钟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开 TRIX App
2. 输入配对码：${result.code}
3. 完成配对后即可实时通信！

💡 Channel 保持运行中，可以实时收发消息`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `❌ 生成配对码失败: ${error.message}`
    };
  }
}

/**
 * 查看状态
 */
async function getStatus() {
  if (!isRunning) {
    return {
      success: true,
      isRunning: false,
      message: '❌ TRIX Channel 未启动\n\n💡 运行 "启动 TRIX Channel" 来启动'
    };
  }

  const trixChannel = require(path.join(CHANNEL_PATH, 'index.js'));
  const status = trixChannel.getStatus();

  return {
    success: true,
    isRunning: true,
    ...status,
    message: `✅ TRIX Channel 状态

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务器连接: ${status.isConnectedToServer ? '✅' : '❌'}
🌐 Gateway 连接: ${status.isConnectedToGateway ? '✅' : '❌'}
🔑 Device ID: ${status.deviceId?.substring(0, 30)}...
🔗 配对 ID: ${status.pairingId || '未配对'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  };
}

/**
 * 停止 Channel
 */
async function stopChannel() {
  if (!isRunning) {
    return {
      success: true,
      message: '✅ TRIX Channel 未运行'
    };
  }

  console.log('[TRIXManager] 🛑 停止 TRIX Channel...');

  if (channelProcess) {
    channelProcess.kill('SIGTERM');
    channelProcess = null;
  }

  isRunning = false;

  return {
    success: true,
    message: '✅ TRIX Channel 已停止'
  };
}

/**
 * Skill 主函数
 */
async function skill(params) {
  const { message } = params;
  const msg = message.toLowerCase();

  // 启动 Channel
  if (msg.includes('启动') && msg.includes('trix')) {
    return await startChannel();
  }

  // 生成配对码
  if (msg.includes('生成') && (msg.includes('配对码') || msg.includes('trix'))) {
    return await generatePairingCode();
  }

  // 停止 Channel
  if (msg.includes('停止') && msg.includes('trix')) {
    return await stopChannel();
  }

  // 查看状态
  if (msg.includes('状态') && msg.includes('trix')) {
    return await getStatus();
  }

  // 默认帮助
  return {
    success: true,
    message: `🎮 TRIX App Channel Manager

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
可用命令：
• 启动 TRIX Channel - 启动长连接服务
• 生成 TRIX 配对码 - 生成配对码
• 查看 TRIX Channel 状态 - 查看状态
• 停止 TRIX Channel - 停止服务
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TRIX Channel 为你的 App 提供与 OpenClaw 的实时双向通信！

像 WhatsApp Web 一样，保持连接，实时聊天！`
  };
}

/**
 * 导出 Skill 元数据
 */
module.exports = {
  name: 'trix-channel-manager',
  description: 'TRIX App Channel Manager - 管理和启动 TRIX App 与 OpenClaw 的实时通信',
  version: '1.0.0',
  author: 'TRIX Team',

  handler: skill,

  triggers: [
    '启动 trix channel',
    '启动 trix',
    'start trix channel',
    '生成 trix 配对码',
    'trix 配对码',
    'trix pairing code',
    '停止 trix channel',
    'trix 状态',
    'trix status'
  ],

  examples: [
    {
      input: '启动 TRIX Channel',
      output: '✅ TRIX Channel 已启动\n📡 服务器: http://47.243.55.130:8765'
    },
    {
      input: '生成 TRIX 配对码',
      output: '✅ 配对码已生成！\n📱 配对码：ABC123\n⏰ 有效期：5分钟'
    }
  ]
};
