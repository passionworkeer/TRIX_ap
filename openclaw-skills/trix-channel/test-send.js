const { io } = require('socket.io-client');

const SERVER_URL = 'http://TRIX_SERVER_HOST:8765';
const PAIRING_ID = '486e5b70-5986-4535-86c0-b3b9c295b1a5';

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected, 尝试直接发消息...');
  
  // 直接发送 user_message（不配对试试）
  setTimeout(() => {
    console.log('📤 发送文本消息 (无配对)...');
    socket.emit('user_message', {
      pairingId: PAIRING_ID,
      content: '你好！',
      contentType: 'text'
    });
  }, 1000);
});

socket.on('bot_message', (data) => {
  console.log('\n📥 bot_message:', JSON.stringify(data, null, 2));
});

socket.on('bot_response', (data) => {
  console.log('\n📥 bot_response:', JSON.stringify(data, null, 2));
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (err) => {
  console.log('❌ Error:', err.message);
});

setTimeout(() => {
  console.log('⏰ Timeout');
  socket.disconnect();
  process.exit(0);
}, 20000);
