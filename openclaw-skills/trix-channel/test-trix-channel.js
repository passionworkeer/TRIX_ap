/**
 * TRIX Channel 测试脚本
 */

const { io } = require('socket.io-client');

const SERVER_URL = 'http://47.243.55.130:8765';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 TRIX Channel 测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testPairing() {
  return new Promise((resolve, reject) => {
    console.log('[Test] 📡 连接到服务器...');
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Test] ✅ 已连接\n');

      // 请求配对码
      const deviceId = `test_${Date.now()}`;
      console.log(`[Test] 📱 请求配对码 (Device: ${deviceId})`);

      socket.emit('bot_request_pairing', { deviceId }, (response) => {
        console.log('\n[Test] 📩 收到响应:');
        console.log(JSON.stringify(response, null, 2));

        if (response.success) {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ 测试通过');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`📱 配对码: ${response.pairingCode}`);
          console.log(`🔗 配对ID: ${response.pairingId}`);
          console.log(`⏰ 过期时间: ${response.expiresAt}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          resolve(response);
        } else {
          console.error('\n❌ 测试失败:', response.error);
          reject(new Error(response.error));
        }

        socket.disconnect();
      });
    });

    socket.on('connect_error', (err) => {
      console.error('[Test] ❌ 连接失败:', err.message);
      reject(err);
    });

    setTimeout(() => {
      reject(new Error('测试超时'));
    }, 10000);
  });
}

async function testMessageFlow() {
  return new Promise((resolve, reject) => {
    console.log('\n[Test] 💬 测试消息流...');
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Test] ✅ 已连接');

      // 1. 请求配对码
      const deviceId = `test_msg_${Date.now()}`;
      socket.emit('bot_request_pairing', { deviceId }, (response) => {
        if (!response.success) {
          reject(new Error('配对失败'));
          return;
        }

        console.log(`[Test] 📱 配对码: ${response.pairingCode}`);

        // 2. 监听用户消息
        socket.on('user_message', (data) => {
          console.log('[Test] 📩 收到用户消息:', data.text);

          // 3. 发送响应
          socket.emit('bot_response', {
            response: '收到消息，正在处理...',
            messageId: data.messageId,
            timestamp: new Date().toISOString()
          });

          console.log('[Test] ⬅️  已发送响应');

          setTimeout(() => {
            socket.disconnect();
            resolve();
          }, 1000);
        });

        // 模拟用户消息（这里需要手动测试）
        console.log('[Test] 💡 等待用户消息...');
        console.log('[Test] 💡 请在 App 中发送消息进行测试');
      });
    });

    socket.on('connect_error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      resolve(); // 不阻塞
    }, 5000);
  });
}

// 运行测试
(async () => {
  try {
    console.log('测试 1: 配对码生成\n');
    await testPairing();

    console.log('测试 2: 消息流\n');
    await testMessageFlow();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有测试完成');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
})();
