/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // IPv4-адрес явно: на Windows «localhost» у Vite может слушать только ::1, и браузер не подключается.
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  preview: { host: '127.0.0.1' },
  build: {
    sourcemap: true,
    target: 'es2022',
    // Основной пакет — движок проверок и хранилище, нужны при старте; страницы — отдельными чанками
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['dexie', 'zod', 'papaparse', 'date-fns'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: { provider: 'v8', include: ['src/engine/**', 'src/services/**'] },
  },
});
