/**
 * OpenClaw 长连接配对 Skill
 * 保持与服务器的持久化 WebSocket 连接，实现实时双向通信
 *
 * 使用方法：
 * 1. 在 OpenClaw 中输入: "启动配对服务" 或 "start pairing service"
 * 2. OpenClaw 会保持与服务器的长连接
 * 3. 生成配对码后，App 可以实时通信
 *
 * ✅ 长连接模式 - 像 WhatsApp Web 一样
 */

const { io } = require('socket.io-client');

// 配置
const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://TRIX_SERVER_HOST:8765';
let socket = null;
let isConnected = false;
let keepRunning = true;
let heartbeatInterval = null;

/**
 * 启动长连接服务
 */
async function startPairingService() {
  console.log('[PairingService] 🚀 启动长连接配对服务...');
  console.log(`[PairingService] 📡 连接到服务器: ${SERVER_URL}`);

  try {
    // 创建 Socket.IO 客户端
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // 注册事件处理器
    setupEventHandlers();

    // 连接
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        console.log('[PairingService] ✅ 已连接到服务器');
        isConnected = true;
        resolve();
      });

      socket.on('connect_error', (err) => {
        console.error('[PairingService] ❌ 连接失败:', err);
        reject(err);
      });

      // 连接超时
      setTimeout(() => {
        if (!isConnected) {
          reject(new Error('连接超时'));
        }
      }, 10000);
    });

    // 启动心跳
    startHeartbeat();

    // 运行服务
    console.log('[PairingService] ✅ 服务已启动，保持长连接...');
    console.log('[PairingService] 💡 输入 "生成配对码" 来生成配对码');
    console.log('[PairingService] 💡 输入 "停止服务" 来停止长连接');

    return {
      success: true,
      message: `✅ 长连接服务已启动
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 服务器: ${SERVER_URL}
🔌 状态: 已连接
💬 保持实时通信
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

服务将保持运行，直到你停止它。`
    };

  } catch (error) {
    console.error('[PairingService] ❌ 启动失败:', error);
    return {
      success: false,
      error: error.message,
      message: `❌ 启动失败: ${error.message}`
    };
  }
}

/**
 * 设置事件处理器
 */
function setupEventHandlers() {
  // 连接事件
  socket.on('connect', () => {
    console.log('[PairingService] ✅ Socket.IO 已连接');
    isConnected = true;

    // 发送设备注册（Bot 身份）
    const deviceId = getDeviceId();
    socket.emit('bot_request_pairing', { deviceId }, (response) => {
      if (response.success) {
        if (response.restored) {
          console.log('[PairingService] ♻️  恢复配对:', response.pairingId);
        } else {
          console.log('[PairingService] 🆕 新配对:', response.pairingCode);
        }
      }
    });
  });

  // 断开事件
  socket.on('disconnect', (reason) => {
    console.log('[PairingService] ⚠️  已断开:', reason);
    isConnected = false;
  });

  // 重连事件
  socket.on('reconnect', (attemptNumber) => {
    console.log(`[PairingService] 🔄 重连成功 (第 ${attemptNumber} 次尝试)`);
    isConnected = true;
  });

  // 用户消息（从 App 发来）
  socket.on('user_message', (data) => {
    console.log('[PairingService] 📩 收到用户消息:', data.text?.substring(0, 100));
    console.log('[PairingService] 💡 请在 OpenClaw 中回复此消息');

    // 触发 OpenClaw 处理消息
    // TODO: 需要与 OpenClaw Gateway 集成
    // 这里只是示例，实际需要调用 OpenClaw 的消息处理逻辑

    // 模拟响应（实际应该由 OpenClaw 生成）
    setTimeout(() => {
      if (socket && isConnected) {
        socket.emit('bot_response', {
          response: 'OpenClaw 已收到你的消息，正在处理...',
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });
      }
    }, 1000);
  });

  // 配对成功事件
  socket.on('pairing_success', (data) => {
    console.log('[PairingService] 🎉 配对成功:', data);
  });

  // 用户配对通知
  socket.on('user_paired', (data) => {
    console.log('[PairingService] 👤 用户已配对:', data.userId);
  });

  // 错误事件
  socket.on('error', (error) => {
    console.error('[PairingService] ❌ 错误:', error);
  });
}

/**
 * 启动心跳
 */
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (socket && isConnected) {
      socket.emit('ping', { timestamp: Date.now() });
    }
  }, 30000); // 每 30 秒一次心跳
}

/**
 * 停止心跳
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * 生成配对码（长连接模式下）
 */
async function generatePairingCodeLongLived() {
  if (!socket || !isConnected) {
    return {
      success: false,
      error: '服务未启动，请先运行 "启动配对服务"',
      message: '❌ 服务未启动，请先运行 "启动配对服务"'
    };
  }

  return new Promise((resolve, reject) => {
    const deviceId = getDeviceId();

    socket.emit('bot_request_pairing', { deviceId }, (response) => {
      if (response.success) {
        console.log('[PairingService] ✅ 配对码已生成:', response.pairingCode);

        resolve({
          success: true,
          code: response.pairingCode,
          token: response.pairingToken,
          pairingId: response.pairingId,
          expiresAt: response.expiresAt,
          message: `✅ 配对码已生成！

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 配对码：${response.pairingCode}
⏰ 有效期：5分钟
🔗 长连接：已保持
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

使用方法：
1. 打开手机App
2. 输入配对码：${response.pairingCode}
3. 完成配对后即可实时通信！

💡 服务保持运行中，可以实时收发消息`
        });
      } else {
        console.error('[PairingService] ❌ 生成失败:', response.error);
        reject(new Error(response.error || '生成配对码失败'));
      }
    });

    // 超时处理
    setTimeout(() => {
      reject(new Error('请求超时'));
    }, 5000);
  });
}

/**
 * 停止服务
 */
async function stopService() {
  console.log('[PairingService] 🛑 正在停止服务...');

  keepRunning = false;
  stopHeartbeat();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  isConnected = false;

  console.log('[PairingService] ✅ 服务已停止');

  return {
    success: true,
    message: '✅ 长连接服务已停止'
  };
}

/**
 * 获取设备 ID
 */
function getDeviceId() {
  const pid = process.pid || 'default';
  return `openclaw_${pid}_${Date.now()}`;
}

/**
 * 检查服务状态
 */
function getServiceStatus() {
  return {
    isConnected,
    serverUrl: SERVER_URL,
    hasSocket: !!socket,
    message: isConnected ? '✅ 服务运行中' : '❌ 服务未启动'
  };
}

/**
 * 主要技能函数
 */
async function skill(params) {
  const { message } = params;
  const msg = message.toLowerCase();

  // 启动服务
  if (msg.includes('启动配对') || msg.includes('start') || msg.includes('开始配对')) {
    return await startPairingService();
  }

  // 生成配对码
  if (msg.includes('生成配对码') || msg.includes('配对码') || msg.includes('pairing code')) {
    return await generatePairingCodeLongLived();
  }

  // 停止服务
  if (msg.includes('停止服务') || msg.includes('停止配对') || msg.includes('stop') || msg.includes('退出')) {
    return await stopService();
  }

  // 查看状态
  if (msg.includes('状态') || msg.includes('status')) {
    const status = getServiceStatus();
    return {
      success: true,
      ...status,
      message: status.message
    };
  }

  // 默认返回帮助
  return {
    success: true,
    message: `🔌 OpenClaw 长连接配对服务

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
可用命令：
• 启动配对服务 - 保持长连接
• 生成配对码 - 生成配对码
• 查看状态 - 查看服务状态
• 停止服务 - 停止长连接
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 长连接模式可以实时收发消息，像 WhatsApp Web 一样！`
  };
}

/**
 * 技能元数据
 */
module.exports = {
  name: 'pairing-service',
  description: 'OpenClaw 长连接配对服务 - 保持与服务器的持久化连接',
  version: '2.0.0',
  author: 'TRIX Team',

  handler: skill,

  triggers: [
    '启动配对服务',
    '开始配对',
    'start pairing',
    'start service',
    '生成配对码',
    '配对码',
    '停止服务',
    '查看状态'
  ],

  examples: [
    {
      input: '启动配对服务',
      output: '✅ 长连接服务已启动\n📡 服务器: http://TRIX_SERVER_HOST:8765'
    },
    {
      input: '生成配对码',
      output: '✅ 配对码已生成！\n📱 配对码：ABC123\n🔗 长连接：已保持'
    }
  ]
};
