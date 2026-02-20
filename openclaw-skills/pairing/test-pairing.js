/**
 * 配对功能测试脚本
 * 测试 OpenClaw pairing skill 能否正确从服务器获取配对码
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.CLAWBOT_SERVER_URL || 'http://m.jmtrick.com:8765';

console.log(`🔌 Connecting to ${SERVER_URL}...`);

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: false
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  const deviceId = 'clawbot_test_' + Date.now();
  console.log(`📱 Device ID: ${deviceId}`);

  socket.emit('bot_request_pairing', { deviceId }, (response) => {
    console.log('\n📥 Response received:');
    console.log(JSON.stringify(response, null, 2));

    if (response.success) {
      if (response.restored) {
        console.log('\n♻️  Existing pairing restored');
      } else {
        console.log('\n✅ New pairing created');
        if (response.pairingCode) {
          console.log(`🔑 Pairing Code: ${response.pairingCode}`);
        }
        if (response.pairingToken) {
          console.log(`🎫 Pairing Token: ${response.pairingToken}`);
        }
        if (response.expiresAt) {
          console.log(`⏰ Expires At: ${response.expiresAt}`);
        }
      }
    } else {
      console.log(`\n❌ Error: ${response.error}`);
    }

    socket.disconnect();
    process.exit(response.success ? 0 : 1);
  });
});

socket.on('connect_error', (err) => {
  console.error(`❌ Connection error: ${err.message}`);
  process.exit(1);
});

socket.on('error', (err) => {
  console.error(`❌ Socket error: ${err.message}`);
  process.exit(1);
});

// 超时处理
setTimeout(() => {
  console.error('❌ Timeout: No response within 5 seconds');
  socket.disconnect();
  process.exit(1);
}, 5000);
