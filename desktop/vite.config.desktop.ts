import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const projectRoot = path.resolve(__dirname, '..');

// Keep plugins at module scope so the desktop renderer/main/preload builds share one config shape.
const desktopPlugins = [
  react(),
  tailwindcss(),
  renderer(),
  electron([
    {
      entry: 'desktop/src/main/index.ts',
      onstart({ startup }) {
        startup();
      },
      vite: {
        build: {
          outDir: 'desktop/dist-desktop/main',
          lib: {
            entry: 'desktop/src/main/index.ts',
            formats: ['cjs'],
            fileName: () => 'index.cjs',
          },
          rollupOptions: {
            external: ['electron', 'electron-store', 'dotenv'],
            output: {
              format: 'cjs',
              entryFileNames: 'index.cjs',
            },
          },
        },
      },
    },
    {
      entry: 'desktop/src/preload/index.js',
      onstart({ reload }) {
        reload();
      },
      vite: {
        build: {
          outDir: 'desktop/dist-desktop/preload',
          lib: {
            entry: 'desktop/src/preload/index.js',
            formats: ['cjs'],
            fileName: () => 'index.cjs',
          },
          rollupOptions: {
            output: {
              format: 'cjs',
              entryFileNames: 'index.cjs',
            },
          },
        },
      },
    },
  ]),
];

export default defineConfig(async () => {
  return {
    root: projectRoot,
    base: './',
    publicDir: 'public',
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    plugins: desktopPlugins,
    build: {
      outDir: path.resolve(__dirname, 'dist-desktop/renderer'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'src/renderer/main.html'),
          float: path.resolve(__dirname, 'src/renderer/float.html'),
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
    },
    optimizeDeps: {
      // Prevent react-i18next from being pre-bundled with its own React copy
      // This avoids React's multiple-instances detection breaking hooks in the float window
      exclude: ['react-i18next'],
      // Force pre-bundle to fix CJS/ESM interop issues
      include: ['html-parse-stringify', 'void-elements', 'use-sync-external-store'],
    },
  } as any;
});
