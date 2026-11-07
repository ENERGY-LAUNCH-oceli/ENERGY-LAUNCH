/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiProxy = { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8787', changeOrigin: false };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // IPv4-адрес явно: на Windows «localhost» у Vite может слушать только ::1, и браузер не подключается.
  // /api – сервер хранилища (npm run api, PostgreSQL); без него приложение хранит данные в браузере
  server: { host: '127.0.0.1', port: 5173, strictPort: false, proxy: { '/api': apiProxy } },
  preview: { host: '127.0.0.1', proxy: { '/api': apiProxy } },
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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts', 'tests/server/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Разбор крупных CSV и PGlite (WebAssembly) при параллельном прогоне не всегда укладываются в 5 с по умолчанию
    testTimeout: 15_000,
    coverage: { provider: 'v8', include: ['src/engine/**', 'src/services/**'] },
  },
});
