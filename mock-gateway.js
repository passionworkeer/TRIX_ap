// TRIX Mock Gateway - 用于前端测试
// 运行: node mock-gateway.js

import { WebSocketServer } from 'ws';

const PORT = 18789;
const HOST = '0.0.0.0'; // 监听所有网络接口

console.log('🚀 Starting TRIX Mock Gateway...');

const wss = new WebSocketServer({ 
  port: PORT, 
  host: HOST 
});

console.log(`✅ Mock Gateway listening on ${HOST}:${PORT}`);
console.log(`   - Local:   ws://localhost:${PORT}`);
console.log(`   - Network: ws://192.168.101.4:${PORT}`);
console.log('');

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`📱 New connection from ${clientIp}`);
  
  let isAuthenticated = false;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📥 Received:`, message);

      // Handle authentication
      if (message.action === 'auth') {
        isAuthenticated = true;
        const authResponse = {
          action: 'auth',
          status: 'ok'
        };
        ws.send(JSON.stringify(authResponse));
        console.log(`✅ Client authenticated`);
        console.log(`📤 Sent:`, authResponse);
        return;
      }

      // Handle message.send
      if (message.action === 'message.send') {
        if (!isAuthenticated) {
          ws.send(JSON.stringify({
            error: 'Not authenticated',
            status: 'error'
          }));
          return;
        }

        const userMessage = message.params?.message || '';
        console.log(`💬 User message: "${userMessage}"`);

        // Mock AI response
        const mockResponse = {
          result: `[Mock] 收到你的消息: "${userMessage}". 这是模拟回复,真实的 Gateway 会调用 AI 处理。`,
          status: 'ok'
        };

        setTimeout(() => {
          ws.send(JSON.stringify(mockResponse));
          console.log(`📤 Sent:`, mockResponse);
        }, 500);
      }

    } catch (error) {
      console.error('❌ Error parsing message:', error);
      ws.send(JSON.stringify({
        error: 'Invalid message format',
        status: 'error'
      }));
    }
  });

  ws.on('close', () => {
    console.log(`📴 Client disconnected (${clientIp})`);
    console.log('');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

wss.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log('ℹ️  This is a MOCK gateway for testing TRIX frontend.');
console.log('ℹ️  For real AI features, use the actual Clawdbot Gateway.');
console.log('');
console.log('Press Ctrl+C to stop...');
