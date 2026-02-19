// openclaw-bridge.js - 配置管理
// 使用环境变量控制连接模式

const axios = require('axios');
const socketIOClient = require('socket.io-client');

// ==================== 配置 ====================

// 从环境变量读取配置（支持通过命令行切换）
const NODE_ENV = process.env.NODE_ENV || 'production';

// 根据环境选择 Relay Server
const RELAY_SERVER_URL = NODE_ENV === 'production'
  ? 'ws://TRIX_SERVER_HOST:8765'  // 生产环境: 云端服务器
  : 'ws://localhost:8765';      // 开发环境: 本地测试

// 本地 OpenClaw Gateway 配置（所有环境都相同）
const OPENCLAW_GATEWAY_URL = 'http://127.0.0.1:18789';
const OPENCLAW_AUTH_TOKEN = '__GATEWAY_AUTH_TOKEN_REDACTED__';

console.log(`╔════════════════════════════════════════════════════════╗`);
console.log(`║        OpenClaw Gateway Bridge Client                ║`);
console.log(`╠════════════════════════════════════════════════════════╣`);
console.log(`║  环境:         ${NODE_ENV.padEnd(40)}║`);
console.log(`║  Relay Server: ${RELAY_SERVER_URL.padEnd(40)}║`);
console.log(`║  OpenClaw:     ${OPENCLAW_GATEWAY_URL.padEnd(40)}║`);
console.log(`║  Model:        zai/glm-4.7                       ║`);
console.log(`╚════════════════════════════════════════════════════════╝`);

module.exports = {
  RELAY_SERVER_URL,
  OPENCLAW_GATEWAY_URL,
  OPENCLAW_AUTH_TOKEN,
  NODE_ENV
};
