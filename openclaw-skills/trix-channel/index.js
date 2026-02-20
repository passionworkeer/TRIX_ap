/**
 * TRIX App Channel for OpenClaw (生产级版本)
 *
 * 功能：为 TRIX 3D Companion App 提供长连接 Channel
 * 类似 WhatsApp Web 的实时双向通信
 *
 * 架构：
 *   TRIX App <--WebSocket--> clawbot-channel Server <--WebSocket--> OpenClaw Gateway
 *
 * 作者：TRIX Team
 * 版本：2.0.0 (修复版)
 *
 * 修复问题：
 * - ✅ 动态获取 Gateway Token（不再硬编码）
 * - ✅ 持久化配对状态（重启不需要重新配对）
 * - ✅ Gateway 断线自动重连
 * - ✅ 防止消息回声循环
 */

const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://TRIX_SERVER_HOST:8765';
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
const AUTH_FILE = path.join(__dirname, 'trix-auth.json');

// 状态
let serverSocket = null;
let gatewayWs = null;
let isConnectedToServer = false;
let isConnectedToGateway = false;
let keepRunning = true;
let heartbeatInterval = null;
let gatewayReconnectTimer = null;
let deviceId = null;
let pairingId = null;
let lastSentMessageId = null; // 用于防止消息回声

/**
 * 获取 OpenClaw Gateway Token
 * 动态从 OpenClaw 配置中读取，不再硬编码
 */
function getGatewayToken() {
  try {
    // 方法 1: 从环境变量读取
    if (process.env.GATEWAY_TOKEN) {
      return process.env.GATEWAY_TOKEN;
    }

    // 方法 2: 从 OpenClaw 配置文件读取
    const openclawConfigPath = path.join(
      process.env.HOME || process.env.USERPROFILE,
      '.openclaw',
      'openclaw.json'
    );

    if (fs.existsSync(openclawConfigPath)) {
      const config = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
      const token = config?.gateway?.auth?.token;
      if (token) {
        console.log('[TRIXChannel] ✅ 从配置文件读取 Gateway Token');
        return token;
      }
    }

    // 方法 3: 使用 OpenClaw CLI 获取（如果可用）
    try {
      const token = execSync('claw config get gateway.auth.token 2>/dev/null || openclaw config get gateway.auth.token 2>/dev/null', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();

      if (token && token.length > 10) {
        console.log('[TRIXChannel] ✅ 从 CLI 获取 Gateway Token');
        return token;
      }
    } catch (e) {
      // CLI 不可用，继续
    }

    console.warn('[TRIXChannel] ⚠️  无法获取 Gateway Token，请手动设置 GATEWAY_TOKEN 环境变量');
    return null;

  } catch (error) {
    console.error('[TRIXChannel] ❌ 获取 Gateway Token 失败:', error.message);
    return null;
  }
}

/**
 * 加载持久化的认证信息
 */
function loadAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      console.log('[TRIXChannel] 📂 加载持久化认证信息');
      return auth;
    }
  } catch (error) {
    console.warn('[TRIXChannel] ⚠️  加载认证信息失败:', error.message);
  }
  return null;
}

/**
 * 保存认证信息到本地
 */
function saveAuth(auth) {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
    console.log('[TRIXChannel] 💾 认证信息已保存');
  } catch (error) {
    console.error('[TRIXChannel] ❌ 保存认证信息失败:', error.message);
  }
}

/**
 * 清除认证信息
 */
function clearAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
      console.log('[TRIXChannel] 🗑️  认证信息已清除');
    }
  } catch (error) {
    console.warn('[TRIXChannel] ⚠️  清除认证信息失败:', error.message);
  }
}

/**
 * 启动 TRIX Channel
 */
async function start() {
  console.log('[TRIXChannel] 🚀 启动 TRIX App Channel...');
  console.log(`[TRIXChannel] 📡 服务器: ${SERVER_URL}`);
  console.log(`[TRIXChannel] 🌐 Gateway: ${GATEWAY_URL}`);

  try {
    // 0. 加载持久化认证
    const savedAuth = loadAuth();
    if (savedAuth?.deviceId) {
      deviceId = savedAuth.deviceId;
      pairingId = savedAuth.pairingId;
      console.log(`[TRIXChannel] ♻️  恢复设备 ID: ${deviceId.substring(0, 30)}...`);
    }

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

      // 使用持久化的 deviceId 或生成新的
      if (!deviceId) {
        deviceId = `trix_${require('os').hostname()}_${Date.now()}`;
      }

      // 请求配对（Bot 身份）
      serverSocket.emit('bot_request_pairing', { deviceId }, (response) => {
        if (response.success) {
          pairingId = response.pairingId;

          if (response.restored) {
            console.log('[TRIXChannel] ♻️  恢复配对:', response.pairingId);
          } else {
            console.log('[TRIXChannel] 🆕 新配对码:', response.pairingCode);
          }

          // 持久化保存
          saveAuth({
            deviceId,
            pairingId,
            savedAt: new Date().toISOString()
          });

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

      // 重连后重新注册
      if (deviceId) {
        serverSocket.emit('bot_request_pairing', { deviceId }, (response) => {
          if (response.success) {
            console.log('[TRIXChannel] ✅ 重连后重新注册成功');
          }
        });
      }
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

    // 动态获取 Token
    const gatewayToken = getGatewayToken();

    if (!gatewayToken) {
      console.warn('[TRIXChannel] ⚠️  未获取到 Gateway Token，跳过 Gateway 连接');
      console.warn('[TRIXChannel] 💡 请设置环境变量 GATEWAY_TOKEN 或确保 OpenClaw 配置正确');
      resolve(); // 不阻塞启动
      return;
    }

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
            version: '2.0.0',
            platform: 'node',
            mode: 'channel'
          },
          auth: {
            token: gatewayToken
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
      if (!isConnectedToGateway) {
        resolve(); // 不阻塞启动
      }
    });

    // 连接关闭 - 关键修复：自动重连
    gatewayWs.on('close', () => {
      console.log('[TRIXChannel] ⚠️  Gateway 连接已关闭');
      isConnectedToGateway = false;

      // 清除旧的重连定时器
      if (gatewayReconnectTimer) {
        clearTimeout(gatewayReconnectTimer);
      }

      // 3秒后自动重连
      gatewayReconnectTimer = setTimeout(() => {
        console.log('[TRIXChannel] 🔄 尝试重新连接 Gateway...');
        connectToGateway().catch(err => {
          console.error('[TRIXChannel] ❌ Gateway 重连失败:', err.message);
        });
      }, 3000);
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
    // 关键修复：防止消息回声
    const payload = msg.payload || {};

    // 检查是否是我们自己发送的消息被广播回来了
    if (payload.messageId && lastSentMessageId === payload.messageId) {
      console.log('[TRIXChannel] 🔄 检测到消息回声，忽略');
      return;
    }

    // 确保这是 AI 的回复，而不是用户消息的回显
    if (payload.role === 'user' || payload.sender === 'user') {
      console.log('[TRIXChannel] 🔄 忽略用户消息回显');
      return;
    }

    console.log('[TRIXChannel] 💬 收到 Gateway Chat 事件');
    forwardToApp(payload);
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

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 记录发送的消息 ID，用于防止回声
  lastSentMessageId = messageId;

  const chatReq = {
    type: 'req',
    id: messageId,
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

  // 10秒后清除消息 ID（防止内存泄漏）
  setTimeout(() => {
    if (lastSentMessageId === messageId) {
      lastSentMessageId = null;
    }
  }, 10000);
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
  const responseText = payload.response || payload.text || payload.message?.content || '';

  if (!responseText) {
    console.warn('[TRIXChannel] ⚠️  空消息，跳过转发');
    return;
  }

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

  if (gatewayReconnectTimer) {
    clearTimeout(gatewayReconnectTimer);
    gatewayReconnectTimer = null;
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
    hasPersistentAuth: fs.existsSync(AUTH_FILE),
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
        // 更新持久化信息
        pairingId = response.pairingId;
        saveAuth({
          deviceId,
          pairingId,
          savedAt: new Date().toISOString()
        });

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

/**
 * 重置配对（清除本地认证信息）
 */
function resetPairing() {
  clearAuth();
  deviceId = null;
  pairingId = null;
  console.log('[TRIXChannel] 🔄 配对信息已重置');
}

// 导出
module.exports = {
  start,
  stop,
  getStatus,
  generatePairingCode,
  resetPairing,

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
