const fs = require('fs');
const path = 'E:/desktop/trix-3d-companion/src/contexts/WebSocketContext.tsx';

// 读取文件
const content = fs.readFileSync(path, 'utf8');

// 查找 challenge 响应部分
const oldCode = `            const challengeResponse: ConnectRequest = {
              type: 'req',
              id: data.id,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                role: 'operator',
                client: {
                  id: 'clawdbot-ios',
                  mode: 'webchat',
                  platform: 'ios',
                  displayName: 'TRIX App',
                  version: '1.0.0',
                  instanceId: generateId()
                },
                caps: [],
                auth: { token: AUTH_TOKEN }
              }
            };`;

const newCode = `            const challengeResponse: ConnectRequest = {
              type: 'req',
              id: data.id,
              method: 'connect',
              params: {
                minProtocol: 3,
                maxProtocol: 3,
                role: 'operator',
                client: {
                  id: 'clawdbot-ios',
                  mode: 'webchat',
                  platform: 'ios',
                  displayName: 'TRIX App',
                  version: '1.0.0',
                  instanceId: generateId()
                },
                caps: [],
                auth: { token: AUTH_TOKEN }
              }
            };`;

// 检查是否已经包含 id 字段
if (content.includes('"id": data.id')) {
  console.log('✅ 代码已经包含 id 字段');
  
  // 验证响应格式
  const hasCorrectId = content.includes('id: data.id') && 
                       content.includes('"type": "req"') && 
                       content.includes('"method": "connect"');
  
  if (hasCorrectId) {
    console.log('✅ 格式看起来正确');
    
    // 添加调试日志
    const debugCode = `            console.log('🎯 响应 challenge ID:', data.id);
            console.log('📤 发送 challenge 响应:', JSON.stringify(challengeResponse));`;
    
    const withDebug = content.replace('socket.send(JSON.stringify(challengeResponse));', 
      debugCode + '\n            socket.send(JSON.stringify(challengeResponse));');
    
    fs.writeFileSync(path, withDebug);
    console.log('✅ 已添加调试日志');
  } else {
    console.log('❌ 格式不正确');
  }
} else {
  console.log('❌ 代码中缺少 id 字段');
  console.log('请确保 challenge 响应包含: "id": data.id');
}

console.log('\n📝 请检查文件是否包含以下内容:');
console.log('1. "id": data.id');
console.log('2. "type": "req"');
console.log('3. "method": "connect"');