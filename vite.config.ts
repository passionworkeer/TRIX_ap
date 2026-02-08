import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      root: '.',
      server: {
        port: 5173,
        host: '0.0.0.0',
        strictPort: false,
        proxy: {
          // WebSocket 反向代理
          // 手机访问: ws://192.168.101.4:5173/gateway → ws://localhost:18789
          // 电脑访问: ws://localhost:5173/gateway → ws://localhost:18789
          '/gateway': {
            target: 'ws://127.0.0.1:18789',
            ws: true,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/gateway/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
