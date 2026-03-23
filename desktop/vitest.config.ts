import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react() as Parameters<typeof defineConfig>[0]['plugins'] extends (infer T)[] ? T : never],
  test: {
    globals: true,
    // Main process (.ts): node; renderer (.tsx): happy-dom
    // We use environmentMatch globs to set per-file environment
    environmentMatchGlobs: [
      ['src/main/**/*.test.ts', 'node'],
      ['src/renderer/**/*.test.tsx', 'happy-dom'],
      ['src/renderer/**/*.test.ts', 'happy-dom'],
      ['src/test/**/*.ts', 'node'],
    ],
    // Fallback: node
    environment: 'node',
    setupFiles: [path.resolve(__dirname, 'src/test/setup.ts')],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    exclude: ['node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
