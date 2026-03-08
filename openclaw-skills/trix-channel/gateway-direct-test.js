/**
 * Gateway Direct Connect Test
 *
 * 测试直接连接 OpenClaw Gateway
 *
 * 使用方法：
 * 1. 设置环境变量或修改下面的配置
 * 2. 运行: node gateway-direct-test.js
 */

const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ==================== 配置 ====================
// Gateway WebSocket 地址
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
// Gateway 认证 Token（从配置文件读取）
let GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';
// 客户端 ID - 使用固定的已知 ID
const CLIENT_ID = process.env.GATEWAY_CLIENT_ID || 'cli';
// 客户端模式
const CLIENT_MODE = 'backend';
// 角色
const ROLE = 'operator';
// 需要的功能
const SCOPES = ['operator.read', 'operator.write'];

// ==================== 状态 ====================
let ws = null;
let connected = false;
let requestId = 0;
const pendingRequests = new Map();

// ==================== 工具函数 ====================

// 生成请求 ID
function makeId(prefix = 'req') {
  return `${prefix}_${Date.now()}_${++requestId}`;
}

// 加载 Gateway 配置
function loadGatewayConfig() {
  const configPaths = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    path.join(os.homedir(), '.openclaw', 'config.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const token = config?.gateway?.auth?.token || config?.gateway?.remote?.token;
        if (token) {
          console.log(`[Config] 从 ${configPath} 加载 token`);
          return token;
        }
      }
    } catch (e) {
      // 忽略错误，继续尝试下一个
    }
  }
  return null;
}

// 连接到 Gateway
function connect() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    console.log(`[Gateway] 连接中: ${GATEWAY_URL}`);

    ws = new WebSocket(GATEWAY_URL);

    ws.on('open', () => {
      console.log('[Gateway] ✅ 连接已建立，发送认证请求...');
      sendConnectRequest();
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(msg);
      } catch (e) {
        console.error('[Gateway] ❌ 解析消息失败:', e.message);
      }
    });

    ws.on('error', (error) => {
      console.error('[Gateway] ❌ 错误:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('[Gateway] ⚠️  连接已关闭');
      connected = false;
    });

    // 等待连接完成
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        resolve();
      } else {
        reject(new Error('连接超时'));
      }
    }, 5000);
  });
}

// 处理消息
function handleMessage(msg) {
  // console.log('[Gateway] <-', msg.type, msg.method || msg.event || '');

  // 处理连接挑战
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const nonce = msg?.payload?.nonce;
    if (nonce) {
      console.log('[Gateway] 收到连接挑战，发送认证请求...');
      sendConnectRequest(nonce);
    }
    return;
  }

  // 处理连接响应
  if (msg.type === 'res' && (msg.id === 'c1' || msg.id === 'connect')) {
    if (msg.ok) {
      connected = true;
      console.log('✅ Gateway 连接成功!');
      console.log('   scopes:', msg?.payload?.auth?.scopes);
    } else {
      console.error('❌ Gateway 连接失败:', msg.error);
    }
    return;
  }

  // 处理方法响应
  if (msg.type === 'res' && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      pendingRequests.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.payload);
      } else {
        pending.reject(new Error(msg.error?.message || 'Unknown error'));
      }
    }
    return;
  }

  // 处理事件
  if (msg.type === 'event') {
    console.log('[Gateway] 事件:', msg.event, msg.payload ? JSON.stringify(msg.payload).slice(0, 100) : '');
  }
}

// 发送连接请求
function sendConnectRequest() {
  const id = 'c1';
  const params = {
    minProtocol: 3,
    maxProtocol: 3,
    role: ROLE,
    scopes: SCOPES,
    client: {
      id: CLIENT_ID,
      displayName: 'TRIX Direct Test',
      version: '1.0.0',
      platform: 'node',
      mode: CLIENT_MODE,
      instanceId: `test-${os.hostname()}-${Date.now()}`
    }
  };

  // 简单认证：直接使用 token
  if (GATEWAY_TOKEN) {
    params.auth = {
      token: GATEWAY_TOKEN
    };
  }

  ws.send(JSON.stringify({
    type: 'req',
    id,
    method: 'connect',
    params
  }));

  console.log('[Gateway] -> connect 请求已发送');
}

// 发送请求并等待响应
function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('未连接'));
      return;
    }

    const id = makeId();
    pendingRequests.set(id, { resolve, reject });

    ws.send(JSON.stringify({
      type: 'req',
      id,
      method,
      params
    }));

    // 超时
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`请求 ${method} 超时`));
      }
    }, 30000);
  });
}

// ==================== 测试命令 ====================

async function testHealth() {
  console.log('\n--- 测试 health ---');
  try {
    const result = await sendRequest('health');
    console.log('✅ health 响应:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ health 失败:', e.message);
  }
}

async function testStatus() {
  console.log('\n--- 测试 status ---');
  try {
    const result = await sendRequest('status');
    console.log('✅ status 响应:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ status 失败:', e.message);
  }
}

async function testSystemPresence() {
  console.log('\n--- 测试 system.presence ---');
  try {
    const result = await sendRequest('system.presence');
    console.log('✅ presence 响应:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ presence 失败:', e.message);
  }
}

async function testNodeList() {
  console.log('\n--- 测试 node.list ---');
  try {
    const result = await sendRequest('node.list');
    console.log('✅ node.list 响应:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ node.list 失败:', e.message);
  }
}

async function testSendMessage() {
  console.log('\n--- 测试 chat.send ---');
  try {
    const result = await sendRequest('chat.send', {
      sessionKey: 'agent:main:main',
      message: 'Hello from TRIX Direct Test!',
      idempotencyKey: `test_${Date.now()}`
    });
    console.log('✅ chat.send 响应:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ chat.send 失败:', e.message);
  }
}

// ==================== 交互界面 ====================

function createInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const commands = {
    help: '显示帮助',
    health: '测试 health',
    status: '测试 status',
    presence: '测试 system.presence',
    nodes: '测试 node.list',
    send: '发送测试消息',
    quit: '退出'
  };

  console.log('\n========== 可用命令 ==========');
  for (const [cmd, desc] of Object.entries(commands)) {
    console.log(`  ${cmd.padEnd(10)} - ${desc}`);
  }
  console.log('================================\n');

  function ask() {
    rl.question('> ', async (input) => {
      const cmd = input.trim().toLowerCase();

      if (cmd === 'quit' || cmd === 'exit' || cmd === 'q') {
        console.log('再见!');
        rl.close();
        if (ws) ws.close();
        process.exit(0);
        return;
      }

      try {
        switch (cmd) {
          case 'help':
          case 'h':
            console.log('\n========== 可用命令 ==========');
            for (const [c, d] of Object.entries(commands)) {
              console.log(`  ${c.padEnd(10)} - ${d}`);
            }
            console.log('================================\n');
            break;
          case 'health':
            await testHealth();
            break;
          case 'status':
            await testStatus();
            break;
          case 'presence':
            await testSystemPresence();
            break;
          case 'nodes':
            await testNodeList();
            break;
          case 'send':
            await testSendMessage();
            break;
          default:
            console.log(`未知命令: ${cmd}`);
        }
      } catch (e) {
        console.error('错误:', e.message);
      }

      ask();
    });
  }

  ask();
}

// ==================== 主函数 ====================

async function main() {
  console.log('========================================');
  console.log('   TRIX Gateway Direct Connect Test    ');
  console.log('========================================\n');

  // 加载配置
  console.log('[Config] Gateway URL:', GATEWAY_URL);

  const loadedToken = loadGatewayConfig();
  if (loadedToken) {
    GATEWAY_TOKEN = loadedToken;
    console.log('[Config] ✅ Token 已加载');
  } else if (!GATEWAY_TOKEN) {
    console.error('[Config] ❌ 未找到 Token，请设置:');
    console.error('   1. 设置环境变量 GATEWAY_TOKEN');
    console.error('   2. 或确保 ~/.openclaw/openclaw.json 中有 gateway.auth.token');
    process.exit(1);
  }

  try {
    await connect();
    createInterface();
  } catch (e) {
    console.error('❌ 连接失败:', e.message);
    process.exit(1);
  }
}

main();
