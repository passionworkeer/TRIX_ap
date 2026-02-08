// Vite 插件: WebSocket 代理
import { Plugin } from 'vite';
import httpProxy from 'http-proxy';

export default function websocketProxy(): Plugin {
  let proxy: httpProxy | null = null;

  return {
    name: 'websocket-proxy',
    configureServer(server) {
      // 创建代理服务器
      proxy = httpProxy.createProxyServer({
        target: 'ws://127.0.0.1:18789',
        ws: true,
        changeOrigin: true,
      });

      // 监听 WebSocket 升级请求
      server.httpServer?.on('upgrade', (req, socket, head) => {
        const pathname = req.url || '';
        
        console.log(' 收到 WebSocket 升级请求:', pathname);
        
        // 只代理 /gateway-ws 路径
        if (pathname.startsWith('/gateway-ws')) {
          console.log(' 代理给 Gateway...');
          
          // 重写路径
          req.url = pathname.replace(/^\/gateway-ws/, '');
          
          proxy?.ws(req, socket, head, {}, (err) => {
            if (err) {
              console.error(' WebSocket 代理错误:', err);
              socket.destroy();
            }
          });
        }
      });

      proxy.on('error', (err) => {
        console.error(' 代理服务器错误', err);
      });

      proxy.on('open', (proxySocket) => {
        console.log(' WebSocket 代理连接已建立');
      });

      proxy.on('close', (res, socket, head) => {
        console.log(' WebSocket 代理连接已关闭');
      });
    },

    closeBundle() {
      proxy?.close();
    },
  };
}
