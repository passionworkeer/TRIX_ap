import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    root: '.',
    build: isProduction
      ? {
          target: 'es2015',
          minify: 'terser',
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          },
          rollupOptions: {
            output: {
              manualChunks: {
                'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                supabase: ['@supabase/supabase-js'],
                leaflet: ['leaflet', 'react-leaflet'],
                motion: ['framer-motion'],
              },
            },
          },
          chunkSizeWarningLimit: 1000,
          sourcemap: false,
        }
      : undefined,
    server: {
      host: '0.0.0.0',
      strictPort: false,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
