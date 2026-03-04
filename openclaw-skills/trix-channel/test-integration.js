const channel = require('./index.js');
const { io } = require('socket.io-client');

const SERVER_URL = 'http://47.243.55.130:8765';
const PAIRING_ID = '486e5b70-5986-4535-86c0-b3b9c295b1a5';

async function test() {
  console.log('=== 启动 Channel ===');
  await channel.start();
  await new Promise(r => setTimeout(r, 3000));
  
  const status = channel.getStatus();
  console.log('状态:', status.isConnectedToServer ? 'Server ✅' : 'Server ❌', 
              status.isConnectedToGateway ? 'Gateway ✅' : 'Gateway ❌');
  
  // 连接 App 模拟器
  console.log('\n=== 连接 App 模拟器 ===');
  const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 10000
  });
  
  socket.on('connect', () => {
    console.log('✅ App 连接成功');
    
    // 发送消息
    setTimeout(() => {
      console.log('📤 发送文本消息...');
      socket.emit('user_message', {
        pairingId: PAIRING_ID,
        content: '你好！测试一下',
        contentType: 'text'
      });
    }, 1000);
    
    // 发送图片
    setTimeout(() => {
      console.log('📤 发送图片消息...');
      socket.emit('user_message', {
        pairingId: PAIRING_ID,
        content: '看看这张图',
        contentType: 'image',
        mediaUrl: 'https://httpbin.org/image/jpeg',
        mediaMimeType: 'image/jpeg'
      });
    }, 8000);
  });
  
  socket.on('bot_message', (data) => {
    console.log('\n📥 收到 bot_message:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on('bot_response', (data) => {
    console.log('\n📥 收到 bot_response:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on('disconnect', (reason) => {
    console.log('❌ App 断开:', reason);
  });
  
  // 等待 40 秒
  await new Promise(r => setTimeout(r, 40000));
  
  console.log('\n=== 测试完成 ===');
  await channel.stop();
  process.exit(0);
}

test().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
