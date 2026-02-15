import WebSocket from 'ws';

const CLOUD_SERVER = 'ws://TRIX_SERVER_HOST:8765';
const PAIRING_CODE = '4UIGWW6Y';
const TEST_MESSAGE = '你好';

// 生成设备 ID
function generateDeviceId() {
  return 'app_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

const deviceId = generateDeviceId();
console.log('🚀 开始三端连通测试');
console.log('================================');
console.log(`📱 App 设备 ID: ${deviceId}`);
console.log(`🔑 配对码: ${PAIRING_CODE}`);
console.log(`☁️ 云端服务器: ${CLOUD_SERVER}`);
console.log('================================\n');

const ws = new WebSocket(CLOUD_SERVER);

ws.on('open', () => {
  console.log('✅ WebSocket 连接成功!');

  // 步骤 1: 注册设备
  setTimeout(() => {
    console.log('\n📝 步骤 1: 注册设备...');
    ws.send(JSON.stringify({
      type: 'register',
      device_id: deviceId,
      device_type: 'mobile_app'
    }));
  }, 500);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    handleMessage(msg);
  } catch (error) {
    console.log('❌ 消息解析错误:', error.message);
  }
});

ws.on('error', (error) => {
  console.log('❌ WebSocket 错误:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n🔌 WebSocket 连接已关闭');
  process.exit(0);
});

let currentStep = 0;
let pairingDeviceId = null;

function handleMessage(msg) {
  switch (currentStep) {
    case 0:
      // 处理注册成功
      if (msg.type === 'register_success') {
        console.log(`✅ 设备注册成功: ${deviceId}`);

        // 步骤 2: 发送配对请求
        currentStep = 1;
        setTimeout(() => {
          console.log('\n📝 步骤 2: 发送配对请求...');
          ws.send(JSON.stringify({
            type: 'app_pairing',
            code: PAIRING_CODE,
            device_id: deviceId,
            client_info: {
              device_name: 'Automated Test',
              platform: 'nodejs',
              user_agent: 'Node.js WebSocket Client'
            }
          }));
        }, 1000);
      }
      break;

    case 1:
      // 处理配对结果
      if (msg.type === 'pairing_success') {
        console.log('🎉 配对成功!');
        console.log(`   Nanobot: ${msg.nanobot_id}`);

        pairingDeviceId = msg.nanobot_id;

        // 步骤 3: 发送测试消息
        currentStep = 2;
        setTimeout(() => {
          console.log('\n📝 步骤 3: 发送测试消息...');
          console.log(`   消息: "${TEST_MESSAGE}"`);

          ws.send(JSON.stringify({
            type: 'chat_message',
            device_id: deviceId,
            msg_id: Date.now().toString(),
            message: TEST_MESSAGE,
            message_type: 'text'
          }));
        }, 1000);
      } else if (msg.type === 'pairing_failed') {
        console.log(`❌ 配对失败: ${msg.message}`);
        ws.close();
      }
      break;

    case 2:
      // 处理 Nanobot 回复
      if (msg.type === 'chat_response') {
        console.log('\n🎉 收到 Nanobot 回复!');
        console.log(`   回复: "${msg.response}"`);

        // 检查是否是简单的 echo
        if (msg.response.includes('Nanobot 收到你的消息')) {
          console.log('\n⚠️  警告: 收到的是简单 echo，不是 AI 回复');
        } else {
          console.log('\n✅ 成功! 收到 AI 回复');
        }

        console.log('\n✅ 测试完成! 三端连通正常!');
        console.log('================================');
        console.log('✅ App → 云端 → Nanobot → 云端 → App');
        console.log('================================\n');

        setTimeout(() => ws.close(), 1000);
      }
      break;
  }

  // 打印其他消息用于调试
  if (!['register_success', 'pairing_success', 'pairing_failed', 'chat_response'].includes(msg.type)) {
    console.log('📨 收到消息:', JSON.stringify(msg, null, 2));
  }
}

// 30 秒超时
setTimeout(() => {
  console.log('\n⏱️  测试超时');
  ws.close();
}, 30000);
