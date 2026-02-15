const WebSocket = require('ws');

const ws = new WebSocket('ws://TRIX_SERVER_HOST:8765');

ws.on('open', () => {
  console.log('✅ 已连接');

  // 注册
  ws.send(JSON.stringify({
    type: 'register',
    device_id: 'manual_test_' + Date.now(),
    device_type: 'mobile_app'
  }));

  // 3 秒后发送配对请求
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'app_pairing',
      code: '3W45S9SC',
      device_id: 'manual_test',
      client_info: {
        device_name: 'Manual Test',
        platform: 'nodejs',
        user_agent: 'Test'
      }
    }));
  }, 3000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 收到:', msg.type, msg);

  if (msg.type === 'pairing_success') {
    console.log('✅ 配对成功！');

    // 发送测试消息
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'chat_message',
        device_id: 'manual_test',
        msg_id: Date.now().toString(),
        message: '你好 Nanobot',
        message_type: 'text'
      }));
    }, 1000);
  }

  if (msg.type === 'chat_response') {
    console.log('\n🎉 Nanobot 回复:');
    console.log(msg.response);

    if (msg.response.includes('Nanobot 收到你的消息')) {
      console.log('\n❌ 这是简单的 echo，不是 AI 回复！');
    } else {
      console.log('\n✅ 这是 AI 回复！');
    }

    ws.close();
    process.exit(0);
  }
});

ws.on('error', (err) => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 连接已关闭');
  process.exit(0);
});

// 60 秒超时
setTimeout(() => {
  console.log('⏱️ 超时');
  ws.close();
  process.exit(1);
}, 60000);
