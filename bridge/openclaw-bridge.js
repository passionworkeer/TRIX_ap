// openclaw-bridge.js
// 运行在本地电脑上，连接云端 Relay Server 和本地 OpenClaw Gateway

const axios = require('axios');
const socketIOClient = require('socket.io-client');

// ==================== 配置 ====================

// 云端 Relay Server 地址（生产环境）
const RELAY_SERVER_URL = 'ws://47.243.55.130:8765';
// 本地测试: 'ws://localhost:8765'
// 备选: 'wss://m.jmtrick.com'

// 本地 OpenClaw Gateway 配置
const OPENCLAW_GATEWAY_URL = 'http://127.0.0.1:18789';
const OPENCLAW_AUTH_TOKEN = '3162c7078b7fa574271f483401729cac57f309cd2a507dd7';

// ==================== OpenClaw Gateway 客户端 ====================

/**
 * 调用本地 OpenClaw Gateway API（带重试机制）
 * @param {string} message - 用户消息
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise<string>} AI 响应
 */
async function callOpenClawGateway(message, retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // 500ms

  try {
    console.log(`[Bridge] 调用 OpenClaw Gateway (尝试 ${retryCount + 1}/${MAX_RETRIES + 1})`);

    const response = await axios.post(
      `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
      {
        model: "zai/glm-4.7",
        messages: [
          { role: "user", content: message }
        ],
        stream: false  // 设为 true 启用流式输出
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000  // 30 秒超时
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log(`[Bridge] ✅ OpenClaw 响应成功: ${aiResponse.substring(0, 50)}...`);

    return aiResponse;

  } catch (error) {
    console.error(`[Bridge] ❌ OpenClaw 调用失败:`, error.message);

    // 如果未达到最大重试次数，延迟后重试
    if (retryCount < MAX_RETRIES) {
      console.log(`[Bridge] 🔄 ${RETRY_DELAY}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return callOpenClawGateway(message, retryCount + 1);
    }

    // 重试次数用尽，抛出错误
    throw new Error(`OpenClaw Gateway 调用失败（已重试 ${MAX_RETRIES} 次）: ${error.message}`);
  }
}

// ==================== Socket.IO 客户端 ====================

console.log(`[Bridge] 🚀 正在连接云端 Relay Server: ${RELAY_SERVER_URL}`);

const socket = socketIOClient(RELAY_SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});

// 连接成功
socket.on('connect', () => {
  console.log('[Bridge] ✅ 已连接到云端 Relay Server');

  // 注册为 OpenClaw Bridge
  socket.emit('bridge_register', {
    type: 'openclaw',
    version: '1.0.0',
    timestamp: Date.now()
  });
});

// 连接错误
socket.on('connect_error', (error) => {
  console.error('[Bridge] ❌ 连接失败:', error.message);
});

// 断开连接
socket.on('disconnect', (reason) => {
  console.log('[Bridge] 🔌 与云端断开连接:', reason);
});

// ==================== 消息处理（核心逻辑）====================

// 监听来自 App 的消息
socket.on('app_message', async (data) => {
  const { content, messageId, userId } = data;

  console.log(`[Bridge] 📨 收到 App 消息 (ID: ${messageId}): ${content.substring(0, 50)}...`);

  try {
    // 🎯 关键：调用本地 OpenClaw Gateway API（带自动重试）
    const aiResponse = await callOpenClawGateway(content);

    console.log(`[Bridge] 📤 发送 AI 响应回云端...`);

    // 发送回云端
    socket.emit('bot_message', {
      content: aiResponse,
      contentType: 'text',
      timestamp: Date.now(),
      messageId: messageId
    });

    // 确认消息已处理
    socket.emit('message_sent', {
      success: true,
      messageId: messageId
    });

  } catch (error) {
    console.error('[Bridge] ❌ 处理消息失败:', error.message);

    // 发送错误回云端
    socket.emit('bot_message', {
      content: '抱歉，AI 助手暂时无法响应。请检查本地 OpenClaw 是否正常运行。',
      contentType: 'text',
      timestamp: Date.now(),
      error: true,
      messageId: messageId
    });
  }
});

// 心跳检测
socket.on('ping', () => {
  socket.emit('pong');
});

// ==================== 启动信息 ====================

console.log(`
╔═══════════════════════════════════════════════════════╗
║        OpenClaw Gateway Bridge Client                ║
╠═══════════════════════════════════════════════════════╣
║  Relay Server: ${RELAY_SERVER_URL.padEnd(35)}║
║  OpenClaw:     ${OPENCLAW_GATEWAY_URL.padEnd(35)}║
║  Model:        zai/glm-4.7${' '.repeat(23)}║
╚═══════════════════════════════════════════════════════╝
`);

// 进程退出处理
process.on('SIGINT', () => {
  console.log('\n[Bridge] 🛑 收到退出信号，正在断开连接...');
  socket.disconnect();
  process.exit(0);
});
