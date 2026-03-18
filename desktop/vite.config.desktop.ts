import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const projectRoot = path.resolve(__dirname, '..');

export default defineConfig(() => {
  return {
    root: projectRoot,
    base: './',
    publicDir: 'public',
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'src'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      // renderer must come before electron so preload is ready
      renderer(),
      electron([
        {
          // Main process (must be CJS for Electron)
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
                external: ['electron', 'electron-log', 'electron-log/main', 'electron-store'],
                output: {
                  entryFileNames: 'index.cjs',
                },
              },
            },
          },
        },
        {
          // Preload script (must be CJS for Electron)
          entry: 'desktop/src/preload/index.ts',
          onstart({ reload }) {
            reload();
          },
          vite: {
            build: {
              outDir: 'desktop/dist-desktop/preload',
              rollupOptions: {
                external: ['electron'],
                output: {
                  entryFileNames: 'index.cjs',
                },
              },
            },
          },
        },
      ]),
    ],
    build: {
      outDir: 'desktop/dist-desktop/renderer',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(projectRoot, 'desktop/src/renderer/main.html'),
          float: path.resolve(projectRoot, 'desktop/src/renderer/float.html'),
        },
      },
    },
    server: {
      port: 5174,
      strictPort: true,
    },
  };
});
