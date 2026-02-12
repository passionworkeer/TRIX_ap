import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    root: '.',
    build: isProduction ? {
      // 生产构建优化
      target: 'es2015',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,  // 移除console
          drop_debugger: true,  // 移除debugger
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            // 将大型依赖打包成单独的chunk
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase': ['@supabase/supabase-js'],
            'leaflet': ['leaflet', 'react-leaflet'],
            'motion': ['framer-motion'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
      // 启用源码映射（便于调试，生产环境可设为false以减小体积）
      sourcemap: false,
    } : undefined,
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
    plugins: [
      react(),
      // 生产环境启用Gzip压缩
      ...(isProduction ? [
        viteCompression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 10240, // 只压缩大于10KB的文件
        }),
      ] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
