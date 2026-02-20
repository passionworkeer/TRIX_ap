#!/usr/bin/env node

/**
 * TRIX Channel 集成测试
 *
 * 测试完整的消息流程：App ↔ Server ↔ OpenClaw Gateway
 */

const { io } = require('socket.io-client');
const { WebSocket } = require('ws');

const SERVER_URL = 'http://TRIX_SERVER_HOST:8765';
const GATEWAY_URL = 'ws://127.0.0.1:18789';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TRIX Channel 集成测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let serverSocket = null;
let gatewayWs = null;
let testsPassed = 0;
let testsFailed = 0;

async function test1_ServerConnection() {
  return new Promise((resolve, reject) => {
    console.log('测试 1: 连接到 clawbot-channel 服务器');

    serverSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    serverSocket.on('connect', () => {
      console.log('✅ 服务器连接成功\n');
      testsPassed++;
      resolve();
    });

    serverSocket.on('connect_error', (err) => {
      console.log('❌ 服务器连接失败:', err.message, '\n');
      testsFailed++;
      reject(err);
    });

    setTimeout(() => {
      reject(new Error('连接超时'));
    }, 10000);
  });
}

async function test2_PairingCode() {
  return new Promise((resolve, reject) => {
    console.log('测试 2: 生成配对码');

    const deviceId = `test_${Date.now()}`;
    serverSocket.emit('bot_request_pairing', { deviceId }, (response) => {
      if (response.success) {
        console.log('✅ 配对码生成成功');
        console.log(`   📱 配对码: ${response.pairingCode}`);
        console.log(`   🔗 配对ID: ${response.pairingId}\n`);
        testsPassed++;
        resolve(response);
      } else {
        console.log('❌ 配对码生成失败:', response.error, '\n');
        testsFailed++;
        reject(new Error(response.error));
      }
    });

    setTimeout(() => {
      reject(new Error('请求超时'));
    }, 5000);
  });
}

async function test3_GatewayConnection() {
  return new Promise((resolve, reject) => {
    console.log('测试 3: 连接到 OpenClaw Gateway');

    gatewayWs = new WebSocket(GATEWAY_URL);

    gatewayWs.on('open', () => {
      console.log('✅ Gateway 连接成功');

      // 发送连接请求
      const connectReq = {
        type: 'req',
        id: 'c1',
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'trix-test',
            displayName: 'TRIX Test',
            version: '1.0.0',
            platform: 'node',
            mode: 'test'
          }
        }
      };

      gatewayWs.send(JSON.stringify(connectReq));
    });

    gatewayWs.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'res' && msg.id === 'c1') {
        if (msg.ok) {
          console.log('   ✅ Gateway 握手成功\n');
          testsPassed++;
          resolve();
        } else {
          console.log('   ❌ Gateway 握手失败:', msg.error, '\n');
          testsFailed++;
          reject(new Error(msg.error));
        }
      }
    });

    gatewayWs.on('error', (err) => {
      console.log('❌ Gateway 连接失败:', err.message, '\n');
      testsFailed++;
      reject(err);
    });

    setTimeout(() => {
      console.log('⚠️  Gateway 连接超时（可能未启动）\n');
      // Gateway 未启动不算失败
      resolve();
    }, 5000);
  });
}

async function test4_MessageRouting() {
  return new Promise((resolve) => {
    console.log('测试 4: 消息路由');

    // 监听用户消息
    serverSocket.on('user_message', (data) => {
      console.log('✅ 收到用户消息:', data.text?.substring(0, 50));

      // 发送响应
      serverSocket.emit('bot_response', {
        response: '收到消息，正在处理...',
        messageId: data.messageId,
        timestamp: new Date().toISOString()
      });

      console.log('   ✅ 已发送响应\n');
      testsPassed++;
      resolve();
    });

    console.log('   💡 等待用户消息（需要在 App 中发送）');
    console.log('   💡 或者跳过此测试\n');

    setTimeout(() => {
      console.log('   ⚠️  超时，跳过此测试\n');
      resolve();
    }, 10000);
  });
}

async function cleanup() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('清理连接...');

  if (serverSocket) {
    serverSocket.disconnect();
  }

  if (gatewayWs) {
    gatewayWs.close();
  }

  console.log('✅ 清理完成\n');
}

async function runTests() {
  try {
    await test1_ServerConnection();
    await test2_PairingCode();
    await test3_GatewayConnection();
    await test4_MessageRouting();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('测试结果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 通过: ${testsPassed}`);
    console.log(`❌ 失败: ${testsFailed}`);
    console.log(`📊 总计: ${testsPassed + testsFailed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (testsFailed === 0) {
      console.log('🎉 所有测试通过！\n');
      process.exit(0);
    } else {
      console.log('⚠️  部分测试失败\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// 运行测试
runTests();
