const channel = require('./index.js');
const { io } = require('socket.io-client');

const SERVER_URL = 'http://TRIX_SERVER_HOST:8765';
// 使用旧的配对ID (Channel 恢复的那个)
const PAIRING_ID = 'ee96be5e-8572-4e5a-b1dd-5fc9696aa94c';

async function test() {
  console.log('=== 启动 Channel ===');
  await channel.start();
  await new Promise(r => setTimeout(r, 3000));
  
  const status = channel.getStatus();
  console.log('状态:', status.isConnectedToServer ? 'Server ✅' : 'Server ❌', 
              status.isConnectedToGateway ? 'Gateway ✅' : 'Gateway ❌');
  console.log('配对ID:', status.pairingId);
  
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
        content: '你好！',
        contentType: 'text'
      });
    }, 1000);
  });
  
  socket.on('bot_message', (data) => {
    console.log('\n📥 收到 bot_message:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on('bot_response', (data) => {
    console.log('\n📥 收到 bot_response:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  // 等待 30 秒
  await new Promise(r => setTimeout(r, 30000));
  
  console.log('\n=== 测试完成 ===');
  await channel.stop();
  process.exit(0);
}

test().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
