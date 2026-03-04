const channel = require('./index.js');

async function test() {
  console.log('=== 1. 获取状态 ===');
  console.log(channel.getStatus());
  
  console.log('\n=== 2. 生成配对码 ===');
  try {
    const pairing = await channel.generatePairingCode();
    console.log(pairing);
  } catch (e) {
    console.log('生成配对码失败:', e.message);
  }
  
  // 等待一下让消息流通
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('\n=== 3. 最终状态 ===');
  console.log(channel.getStatus());
}

test();
