/**
 * TRIX App Channel for OpenClaw
 *
 * 功能：为 TRIX 3D Companion App 提供长连接 Channel
 * 类似 WhatsApp Web 的实时双向通信
 *
 * 架构：
 *   TRIX App <--WebSocket--> clawbot-channel Server <--WebSocket--> OpenClaw Gateway
 *
 * 作者：TRIX Team
 * 版本：1.0.0
 */

const { io } = require('socket.io-client');

// 配置
const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://47.243.55.130:8765';
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';

// 状态
let serverSocket = null;
let gatewayWs = null;
let isConnectedToServer = false;
let isConnectedToGateway = false;
let keepRunning = true;
let heartbeatInterval = null;
let deviceId = null;
let pairingId = null;

/**
 * 启动 TRIX Channel
 */
async function start() {
  console.log('[TRIXChannel] 🚀 启动 TRIX App Channel...');
  console.log(`[TRIXChannel] 📡 服务器: ${SERVER_URL}`);
  console.log(`[TRIXChannel] 🌐 Gateway: ${GATEWAY_URL}`);

  try {
    // 1. 连接到 clawbot-channel 服务器
    await connectToServer();

    // 2. 连接到 OpenClaw Gateway
    await connectToGateway();

    // 3. 启动心跳
    startHeartbeat();

    console.log('[TRIXChannel] ✅ TRIX Channel 已启动');
    console.log('[TRIXChannel] 💡 可以通过 TRIX App 与 OpenClaw 实时通信');

    return { success: true };

  } catch (error) {
    console.error('[TRIXChannel] ❌ 启动失败:', error);
    throw error;
  }
}

/**
 * 连接到 clawbot-channel 服务器
 */
async function connectToServer() {
  return new Promise((resolve, reject) => {
    console.log('[TRIXChannel] 📡 连接到 clawbot-channel 服务器...');

    serverSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // 连接成功
    serverSocket.on('connect', () => {
      console.log('[TRIXChannel] ✅ 已连接到 clawbot-channel 服务器');
      isConnectedToServer = true;

      // 请求配对（Bot 身份）
      deviceId = `trix_${process.pid || 'default'}_${Date.now()}`;
      serverSocket.emit('bot_request_pairing', { deviceId }, (response) => {
        if (response.success) {
          pairingId = response.pairingId;
          if (response.restored) {
            console.log('[TRIXChannel] ♻️  恢复配对:', response.pairingId);
          } else {
            console.log('[TRIXChannel] 🆕 新配对码:', response.pairingCode);
          }
          resolve();
        } else {
          reject(new Error(response.error || '配对请求失败'));
        }
      });
    });

    // 连接错误
    serverSocket.on('connect_error', (err) => {
      console.error('[TRIXChannel] ❌ 连接失败:', err.message);
      reject(err);
    });

    // 断开
    serverSocket.on('disconnect', (reason) => {
      console.log('[TRIXChannel] ⚠️  已与服务器断开:', reason);
      isConnectedToServer = false;
    });

    // 重连
    serverSocket.on('reconnect', (attemptNumber) => {
      console.log(`[TRIXChannel] 🔄 重连成功 (第 ${attemptNumber} 次尝试)`);
      isConnectedToServer = true;
    });

    // 用户消息（从 App 发来）
    serverSocket.on('user_message', (data) => {
      console.log('[TRIXChannel] 📩 收到 App 消息:', data.text?.substring(0, 100));
      forwardToGateway(data);
    });

    // 配对成功
    serverSocket.on('pairing_success', (data) => {
      console.log('[TRIXChannel] 🎉 配对成功:', data);
    });

    // 用户已配对
    serverSocket.on('user_paired', (data) => {
      console.log('[TRIXChannel] 👤 用户已配对:', data.userId);
    });

    // 错误
    serverSocket.on('error', (error) => {
      console.error('[TRIXChannel] ❌ 错误:', error);
    });

    // 超时
    setTimeout(() => {
      if (!isConnectedToServer) {
        reject(new Error('连接服务器超时'));
      }
    }, 15000);
  });
}

/**
 * 连接到 OpenClaw Gateway
 */
async function connectToGateway() {
  const { WebSocket } = require('ws');

  return new Promise((resolve, reject) => {
    console.log('[TRIXChannel] 🌐 连接到 OpenClaw Gateway...');

    gatewayWs = new WebSocket(GATEWAY_URL);

    // 连接成功
    gatewayWs.on('open', () => {
      console.log('[TRIXChannel] ✅ 已连接到 Gateway');

      // 发送连接请求
      const connectReq = {
        type: 'req',
        id: 'c1',
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'trix-channel',
            displayName: 'TRIX App Channel',
            version: '1.0.0',
            platform: 'node',
            mode: 'channel'
          }
        }
      };

      gatewayWs.send(JSON.stringify(connectReq));
    });

    // 接收消息
    gatewayWs.on('message', (data) => {
      const msg = JSON.parse(String(data));
      handleGatewayMessage(msg);
    });

    // 连接错误
    gatewayWs.on('error', (err) => {
      console.error('[TRIXChannel] ❌ Gateway 错误:', err.message);
      // Gateway 连接失败不是致命错误，继续运行
      if (!isConnectedToGateway) {
        resolve(); // 不阻塞启动
      }
    });

    // 连接关闭
    gatewayWs.on('close', () => {
      console.log('[TRIXChannel] ⚠️  Gateway 连接已关闭');
      isConnectedToGateway = false;
    });

    // 超时
    setTimeout(() => {
      resolve(); // 不阻塞启动
    }, 5000);
  });
}

/**
 * 处理 Gateway 消息
 */
function handleGatewayMessage(msg) {
  // 连接响应
  if (msg.type === 'res' && msg.id === 'c1') {
    if (msg.ok) {
      console.log('[TRIXChannel] ✅ Gateway 连接成功');
      isConnectedToGateway = true;
    } else {
      console.error('[TRIXChannel] ❌ Gateway 连接失败:', msg.error);
    }
  }

  // Chat 响应（OpenClaw 的回复）
  if (msg.type === 'event' && msg.event === 'chat') {
    console.log('[TRIXChannel] 💬 收到 Gateway Chat 事件');
    forwardToApp(msg.payload);
  }

  // 其他响应
  if (msg.type === 'res') {
    console.log('[TRIXChannel] 📩 Gateway 响应:', msg.id, msg.ok ? 'OK' : 'Error');
  }
}

/**
 * 转发消息到 Gateway
 */
function forwardToGateway(data) {
  if (!gatewayWs || gatewayWs.readyState !== 1 /* OPEN */) {
    console.error('[TRIXChannel] ⚠️  Gateway 未连接，无法转发消息');
    return;
  }

  const chatReq = {
    type: 'req',
    id: `chat_${Date.now()}`,
    method: 'chat',
    params: {
      text: data.text,
      threadId: data.threadId || 'default',
      context: {
        source: 'trix-app',
        userId: data.userId,
        deviceId: data.deviceId
      }
    }
  };

  try {
    gatewayWs.send(JSON.stringify(chatReq));
    console.log('[TRIXChannel] ➡️  已转发到 Gateway');
  } catch (error) {
    console.error('[TRIXChannel] ❌ 转发到 Gateway 失败:', error);
  }
}

/**
 * 转发消息到 App
 */
function forwardToApp(payload) {
  if (!serverSocket || !isConnectedToServer) {
    console.error('[TRIXChannel] ⚠️  服务器未连接，无法转发消息');
    return;
  }

  // 提取回复文本
  const responseText = payload.response || payload.text || '';

  serverSocket.emit('bot_response', {
    response: responseText,
    messageId: payload.messageId,
    timestamp: new Date().toISOString(),
    pairingId: pairingId
  });

  console.log('[TRIXChannel] ⬅️  已转发到 App');
}

/**
 * 启动心跳
 */
function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    // 服务器心跳
    if (serverSocket && isConnectedToServer) {
      serverSocket.emit('ping', { timestamp: Date.now() });
    }

    // Gateway 心跳
    if (gatewayWs && gatewayWs.readyState === 1) {
      const healthReq = {
        type: 'req',
        id: `health_${Date.now()}`,
        method: 'health'
      };
      gatewayWs.send(JSON.stringify(healthReq));
    }
  }, 30000); // 每 30 秒
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
 * 停止 Channel
 */
async function stop() {
  console.log('[TRIXChannel] 🛑 正在停止 TRIX Channel...');

  keepRunning = false;
  stopHeartbeat();

  if (serverSocket) {
    serverSocket.disconnect();
    serverSocket = null;
  }

  if (gatewayWs) {
    gatewayWs.close();
    gatewayWs = null;
  }

  isConnectedToServer = false;
  isConnectedToGateway = false;

  console.log('[TRIXChannel] ✅ TRIX Channel 已停止');

  return { success: true };
}

/**
 * 获取状态
 */
function getStatus() {
  return {
    isConnectedToServer,
    isConnectedToGateway,
    serverUrl: SERVER_URL,
    gatewayUrl: GATEWAY_URL,
    deviceId,
    pairingId,
    message: isConnectedToServer ? '✅ 运行中' : '❌ 未启动'
  };
}

/**
 * 生成配对码
 */
async function generatePairingCode() {
  if (!serverSocket || !isConnectedToServer) {
    return {
      success: false,
      error: 'Channel 未启动'
    };
  }

  return new Promise((resolve, reject) => {
    serverSocket.emit('bot_request_pairing', { deviceId }, (response) => {
      if (response.success) {
        resolve({
          success: true,
          code: response.pairingCode,
          pairingId: response.pairingId,
          expiresAt: response.expiresAt
        });
      } else {
        reject(new Error(response.error || '生成配对码失败'));
      }
    });

    setTimeout(() => {
      reject(new Error('请求超时'));
    }, 5000);
  });
}

// 导出
module.exports = {
  start,
  stop,
  getStatus,
  generatePairingCode,

  // OpenClaw Channel Plugin API
  id: 'trix-app',
  meta: {
    id: 'trix-app',
    label: 'TRIX App',
    selectionLabel: 'TRIX App (WebSocket)',
    docsPath: '/channels/trix-app',
    blurb: 'TRIX 3D Companion App Channel - 实时双向通信',
    aliases: ['trix', 'trixapp']
  },
  capabilities: {
    chatTypes: ['direct']
  },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.trixApp?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.trixApp?.accounts?.[accountId ?? 'default'] ?? {
        accountId: 'default'
      }
  }
};

// 如果直接运行此文件
if (require.main === module) {
  (async () => {
    try {
      await start();

      // 保持运行
      console.log('[TRIXChannel] 💡 按 Ctrl+C 停止');
      process.on('SIGINT', async () => {
        await stop();
        process.exit(0);
      });

    } catch (error) {
      console.error('[TRIXChannel] ❌ 启动失败:', error);
      process.exit(1);
    }
  })();
}
