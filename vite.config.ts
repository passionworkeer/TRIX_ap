import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      root: '.',
      server: {
        host: '0.0.0.0',
        strictPort: false,
        proxy: {
          // WebSocket 反向代理
          '/gateway': {
            target: 'ws://127.0.0.1:18789',
            ws: true,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/gateway/, ''),
          },
        },
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
