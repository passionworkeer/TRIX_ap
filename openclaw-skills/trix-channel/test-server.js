const { io } = require('socket.io-client');

const SERVER_URL = 'http://47.243.55.130:8765';

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // 请求新的配对码（清除之前的配对）
  socket.emit('bot_request_pairing', { 
    deviceId: `test_${Date.now()}`,
    forceNew: true  // 尝试请求新配对码
  }, (response) => {
    console.log('📥 Response:', JSON.stringify(response, null, 2));
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.log('❌ Connection error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏰ Timeout');
  socket.disconnect();
  process.exit(1);
}, 15000);
