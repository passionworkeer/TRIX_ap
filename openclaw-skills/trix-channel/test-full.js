const channel = require('./index.js');

async function test() {
  console.log('=== 启动 Channel ===');
  await channel.start();
  
  // 等待连接建立
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('\n=== 1. 获取状态 ===');
  const status = channel.getStatus();
  console.log('Server:', status.isConnectedToServer ? '✅' : '❌');
  console.log('Gateway:', status.isConnectedToGateway ? '✅' : '❌');
  console.log('DeviceID:', status.deviceId);
  console.log('PairingID:', status.pairingId);
  
  console.log('\n=== 2. 生成配对码 (强制新配对) ===');
  try {
    const pairing = await channel.generatePairingCode(true);  // 强制新配对
    console.log('✅ 配对码:', pairing.code);
    console.log('   配对ID:', pairing.pairingId);
    console.log('   过期时间:', pairing.expiresAt);
  } catch (e) {
    console.log('❌ 生成配对码失败:', e.message);
  }
  
  // 保持运行以测试消息收发
  console.log('\n=== 3. 等待测试消息 (30秒) ===');
  await new Promise(r => setTimeout(r, 30000));
  
  console.log('\n=== 4. 最终状态 ===');
  console.log(channel.getStatus());
  
  // 停止
  await channel.stop();
  console.log('\n=== 测试完成 ===');
}

test().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
