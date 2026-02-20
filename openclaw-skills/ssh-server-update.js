/**
 * SSH Server Update Skill
 * 连接到服务器并更新配对服务代码
 *
 * 使用方法：
 * "更新服务器配对代码"
 * "修复服务器配对功能"
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 服务器配置
const SERVER_CONFIG = {
  host: '47.243.55.130',
  port: 22,
  username: 'root',  // 或者 ubuntu
  // 密码需要用户提供或从配置文件读取
};

/**
 * 执行 SSH 命令
 */
function execSSH(command, password = null) {
  return new Promise((resolve, reject) => {
    const ssh = spawn('ssh', [`${SERVER_CONFIG.username}@${SERVER_CONFIG.host}`, command], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    ssh.stdout.on('data', (data) => {
      output += data.toString();
    });

    ssh.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // 如果提供了密码，自动输入
    if (password) {
      setTimeout(() => {
        ssh.stdin.write(password + '\n');
      }, 1000);
    }

    ssh.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`SSH command failed (code ${code}): ${errorOutput || output}`));
      }
    });

    ssh.on('error', (err) => {
      reject(new Error(`SSH connection error: ${err.message}`));
    });
  });
}

/**
 * 主要技能函数
 */
async function skill(params) {
  const { message, config } = params;
  const msg = message.toLowerCase();

  // 检查是否是更新服务器的请求
  if (!msg.includes('更新') && !msg.includes('服务器') && !msg.includes('配对') && !msg.includes('修复')) {
    return {
      success: false,
      message: '请明确说明要更新服务器配对代码'
    };
  }

  try {
    // 1. 读取修复后的代码
    const serverJsPath = path.join(__dirname, '../../server/clawbot-channel/server.js');
    const serverJs = fs.readFileSync(serverJsPath, 'utf8');

    // 2. 检查代码是否已修复
    if (serverJs.includes('pairingCode: pairing.pairingCode')) {
      console.log('[SSH] ✅ 本地代码已修复');
    } else {
      return {
        success: false,
        message: '❌ 本地代码尚未修复，请先修复 server.js'
      };
    }

    return {
      success: true,
      message: `✅ 准备连接服务器 ${SERVER_CONFIG.host}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️  服务器: ${SERVER_CONFIG.host}
👤 用户: ${SERVER_CONFIG.username}
📁 目标: /opt/clawbot-channel/server.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请提供 SSH 密码以继续：
（密码将用于一次性连接，不会被保存）

或者手动执行以下命令：

1. 连接服务器:
   ssh ${SERVER_CONFIG.username}@${SERVER_CONFIG.host}

2. 编辑代码:
   nano /opt/clawbot-channel/server.js

3. 找到第 304 行，修改为:
   callback({
     success: true,
     restored: false,
     pairingCode: pairing.pairingCode,
     pairingToken: pairing.pairingToken,
     pairingId: pairing.id,
     expiresAt: pairing.expiresAt
   });

4. 重启服务:
   pm2 restart clawbot-channel

5. 验证修复:
   pm2 logs clawbot-channel --lines 20`
    };

  } catch (error) {
    console.error('[SSH] ❌ Error:', error);
    return {
      success: false,
      error: error.message,
      message: `❌ 错误: ${error.message}`
    };
  }
}

/**
 * 技能元数据
 */
module.exports = {
  name: 'ssh-server-update',
  description: '连接服务器并更新配对服务代码',
  version: '1.0.0',
  author: 'TRIX Team',

  handler: skill,

  triggers: [
    '更新服务器',
    '修复服务器配对',
    '连接服务器',
    'ssh server',
    'update server'
  ],

  examples: [
    {
      input: '更新服务器配对代码',
      output: '✅ 准备连接服务器...'
    }
  ]
};
