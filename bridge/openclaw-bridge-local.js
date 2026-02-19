// openclaw-bridge-local.js
// 本地测试版本 - 连接 localhost:8765

const axios = require('axios');
const socketIOClient = require('socket.io-client');

// 本地测试配置
const RELAY_SERVER_URL = 'ws://localhost:8765';
const OPENCLAW_GATEWAY_URL = 'http://127.0.0.1:18789';
const OPENCLAW_AUTH_TOKEN = '__GATEWAY_AUTH_TOKEN_REDACTED__';

// 创建Socket.IO连接
const socket = socketIOClient(RELAY_SERVER_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 30000
});

// 注册Bridge
socket.on('connect', () => {
  console.log('[Bridge] ✅ 已连接到本地 Relay Server');

  socket.emit('bridge_register', {
    type: 'openclaw',
    version: '1.0.0'
  });
});

// 接收App消息
socket.on('app_message', async (data) => {
  const { content, messageId } = data;

  console.log(`[Bridge] 📨 收到 App 消息: ${content.substring(0, 50)}...`);

  try {
    const response = await axios.post(
      `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
      {
        model: "zai/glm-4.7",
        messages: [
          { role: "user", content: content }
        ],
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log(`[Bridge] ✅ OpenClaw 响应: ${aiResponse.substring(0, 50)}...`);

    socket.emit('bot_message', {
      content: aiResponse,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[Bridge] ❌ OpenClaw 调用失败:', error.message);
    socket.emit('bot_message', {
      content: '抱歉，AI 助手暂时无法响应。',
      timestamp: Date.now(),
      error: true,
      messageId: messageId
    });
  }
});

// 心跳
socket.on('ping', () => {
  socket.emit('pong');
});

// 启动信息
console.log(`
╔═══════════════════════════════════════════════════════╗
║        OpenClaw Gateway Bridge (本地测试)           ║
╠═══════════════════════════════════════════════════════╣
║  Relay Server: ${RELAY_SERVER_URL.padEnd(35)}║
║  OpenClaw:     ${OPENCLAW_GATEWAY_URL.padEnd(35)}║
║  Model:        zai/glm-4.7${' '.repeat(23)}║
╚═══════════════════════════════════════════════════════╝
`);

// 进程退出处理
process.on('SIGINT', () => {
  console.log('\n[Bridge] 🛑 正在断开连接...');
  socket.disconnect();
  process.exit(0);
});
