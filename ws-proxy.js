/**
 * WebSocket 反向代理服务器
 * 监听 0.0.0.0:18790,转发到 localhost:18789
 * 解决 Origin 检查问题
 */

import http from 'http';
import httpProxy from 'http-proxy';

const PROXY_PORT = 18790;
const TARGET_HOST = 'localhost';
const TARGET_PORT = 18789;

// 创建代理服务器
const proxy = httpProxy.createProxyServer({
  target: `ws://${TARGET_HOST}:${TARGET_PORT}`,
  ws: true,
  changeOrigin: true,
});

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Proxy Server\nUse WebSocket protocol to connect.');
});

// WebSocket 升级处理
server.on('upgrade', (req, socket, head) => {
  console.log(`[${new Date().toLocaleTimeString()}] WebSocket 连接请求`);
  console.log(`  Origin: ${req.headers.origin || '(无)'}`);
  console.log(`  Host: ${req.headers.host}`);
  console.log(`  转发到: ws://${TARGET_HOST}:${TARGET_PORT}`);
  
  proxy.ws(req, socket, head, (error) => {
    if (error) {
      console.error(`  ❌ 代理错误:`, error.message);
      socket.destroy();
    }
  });
});

// 代理错误处理
proxy.on('error', (err, req, socket) => {
  console.error(`  ❌ 代理服务器错误:`, err.message);
  if (socket && !socket.destroyed) {
    socket.destroy();
  }
});

// 代理成功处理
proxy.on('open', (proxySocket) => {
  console.log(`  ✅ 代理连接已建立`);
});

proxy.on('close', (res, socket, head) => {
  console.log(`  🔌 代理连接已关闭`);
});

// 启动服务器
server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🔄 WebSocket 反向代理服务器');
  console.log('========================================');
  console.log(`监听: 0.0.0.0:${PROXY_PORT}`);
  console.log(`目标: ws://${TARGET_HOST}:${TARGET_PORT}`);
  console.log('');
  console.log('使用方法:');
  console.log(`  电脑: ws://localhost:${PROXY_PORT}`);
  console.log(`  手机: ws://192.168.101.4:${PROXY_PORT}`);
  console.log('========================================');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭代理服务器...');
  server.close(() => {
    console.log('✅ 代理服务器已关闭');
    process.exit(0);
  });
});
