const { io } = require('socket.io-client');

const SERVER_URL = 'http://47.243.55.130:8765';
const PAIRING_ID = '486e5b70-5986-4535-86c0-b3b9c295b1a5'; // 刚生成的配对ID

const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // 先配对
  socket.emit('app_pairing', { 
    pairingId: PAIRING_ID,
    deviceName: 'Test Device'
  }, (response) => {
    console.log('📥 Pairing Response:', JSON.stringify(response, null, 2));
    
    if (response.success) {
      // 发送文本消息
      setTimeout(() => {
        console.log('\n📤 发送文本消息...');
        socket.emit('user_message', {
          pairingId: PAIRING_ID,
          content: '你好，TRIX！测试消息',
          contentType: 'text'
        });
      }, 1000);
      
      // 发送图片消息
      setTimeout(() => {
        console.log('\n📤 发送图片消息...');
        socket.emit('user_message', {
          pairingId: PAIRING_ID,
          content: '看看这张图',
          contentType: 'image',
          mediaUrl: 'https://httpbin.org/image/jpeg',
          mediaMimeType: 'image/jpeg'
        });
      }, 5000);
      
      // 接收 bot 响应
      socket.on('bot_message', (data) => {
        console.log('\n📥 收到 Bot 消息:');
        console.log(JSON.stringify(data, null, 2));
      });
      
      socket.on('bot_response', (data) => {
        console.log('\n📥 收到 Bot 响应 (legacy):');
        console.log(JSON.stringify(data, null, 2));
      });
    }
    
    // 30秒后退出
    setTimeout(() => {
      console.log('\n⏰ 测试结束');
      socket.disconnect();
      process.exit(0);
    }, 35000);
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
}, 45000);
