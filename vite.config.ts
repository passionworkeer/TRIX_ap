import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
      // Tailscale 模式不需要代理，直接 WebSocket 连接
      // 注意: 相机功能需要 HTTPS 或 localhost
      // 如需在手机上使用相机，需配置 HTTPS 或使用 ngrok
    },
    plugins: [
      react(),
      // 暂时禁用压缩插件（兼容性问题）
      // ...(isProduction ? [
      //   viteCompression({
      //     algorithm: 'gzip',
      //     ext: '.gz',
      //     threshold: 10240,
      //   }),
      // ] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
