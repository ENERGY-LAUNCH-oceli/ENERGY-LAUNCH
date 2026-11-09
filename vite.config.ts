/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { connect } from 'node:net';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { build as viteBuild, defineConfig, loadEnv, type Plugin } from 'vite';
import { STATUS_CODES, statusInfo } from './src/errors/codes.ts';
import { serviceWorkerSource } from './src/errors/service-worker.ts';
import { renderOfflinePage, renderStatusPage, statusCss } from './src/errors/static-page.ts';

const apiProxy = { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8787', changeOrigin: false };

const portBusy = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = connect(port, '127.0.0.1');
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });

/**
 * Сервер хранилища внутри `npm run dev`: отдельно запускать `npm run api` не нужно.
 * Уже запущен `npm run api` – запросы уходят ему через прокси. В тестах (Vitest) и при VITE_STORAGE=browser не поднимается.
 */
function storageApi(env: Record<string, string>): Plugin {
  return {
    name: 'energy-launch-storage-api',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.VITEST || env.VITE_STORAGE === 'browser') return;
      const log = server.config.logger;
      if (await portBusy(Number(env.API_PORT || 8787))) return log.info('[api] используется запущенный сервер хранилища (npm run api)');
      // Модуль сервера – TypeScript без сборки: его выполняет сам Node (импорт по вычисляемому адресу Vite не трогает).
      // Один экземпляр на процесс: перезапуск dev-сервера (правка конфига) не открывает базу второй раз
      type DevApi = { db: { kind: string; close(): Promise<void> }; schema: number; handler: (req: unknown, res: unknown) => void };
      const g = globalThis as { __energyLaunchApi?: Promise<DevApi> };
      const entry = pathToFileURL(fileURLToPath(new URL('./server/dev.ts', import.meta.url))).href;
      g.__energyLaunchApi ??= import(/* @vite-ignore */ entry)
        .then((m: { startDevApi: (e: Record<string, string>) => Promise<DevApi> }) => m.startDevApi(env))
        .then((api) => {
          log.info(`[api] хранилище: ${api.db.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : `встроенный PostgreSQL · ${env.PGLITE_DIR || '.data/pglite'}`} · схема v${api.schema}`);
          // Ctrl+C: база закрывается аккуратно (встроенный PostgreSQL не любит обрыв на записи)
          process.once('SIGINT', () => void api.db.close().catch(() => {}).finally(() => process.exit(0)));
          return api;
        })
        .catch((e: unknown) => {
          log.error(`[api] сервер хранилища не запущен: ${e instanceof Error ? e.message : String(e)}`);
          g.__energyLaunchApi = undefined;
          throw e;
        });
      const ready = g.__energyLaunchApi;
      // Ошибка запуска не роняет dev-сервер: приложение работает в браузере, запросы к /api получают 503
      ready.catch(() => {});
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        ready.then(
          ({ handler }) => handler(req, res),
          () => {
            res.statusCode = 503;
            res.end();
          },
        );
      });
    },
  };
}

/** Скрипт статических страниц состояния – отдельная сборка в один файл (IIFE), без общих чанков с приложением. */
async function bundleStatusScript(): Promise<string> {
  const out = await viteBuild({
    configFile: false,
    logLevel: 'silent',
    publicDir: false,
    build: {
      write: false,
      minify: true,
      target: 'es2020',
      sourcemap: false,
      emptyOutDir: false,
      lib: { entry: fileURLToPath(new URL('./src/errors/static-entry.ts', import.meta.url)), formats: ['iife'], name: 'ElStatus', fileName: () => 'status.js' },
    },
  });
  for (const o of Array.isArray(out) ? out : [out]) {
    if (!('output' in o)) continue;
    const chunk = o.output.find((c) => c.type === 'chunk');
    if (chunk?.type === 'chunk') return chunk.code;
  }
  throw new Error('status.js не собран');
}

/** Файлы статических страниц: /status/<код>.html для всех кодов, /offline.html, стили и скрипт. */
const statusFiles = (script: string): Record<string, string> => ({
  'status/status.js': script,
  'status/status.css': statusCss(),
  'offline.html': renderOfflinePage(),
  ...Object.fromEntries(STATUS_CODES.map((c) => [`status/${c.code}.html`, renderStatusPage(c)])),
});

/**
 * Страницы состояния без приложения: error_page nginx (502, 504 – когда приложение не отвечает) и офлайн-страница
 * service worker'а (/sw.js, версия – по содержимому). В dev-сервере те же адреса отдаются на лету.
 */
function statusPages(): Plugin {
  return {
    name: 'energy-launch-status-pages',
    configureServer(server) {
      let script: Promise<string> | null = null;
      server.watcher.on('change', (f) => {
        if (/src[\\/](errors|design)[\\/]/.test(f)) script = null;
      });
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? '';
        const m = /^\/status\/(\d{3})\.html$/.exec(path);
        const known = m ? STATUS_CODES.some((c) => c.code === Number(m[1])) : false;
        const html = path === '/offline.html' ? renderOfflinePage() : m && known ? renderStatusPage(statusInfo(Number(m[1]))!) : null;
        const send = (type: string, body: string) => {
          res.setHeader('Content-Type', `${type}; charset=utf-8`);
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        };
        if (html) return send('text/html', html);
        if (path === '/status/status.css') return send('text/css', statusCss());
        if (path === '/status/status.js') {
          script ??= bundleStatusScript();
          return void script.then(
            (code) => send('application/javascript', code),
            (e: unknown) => {
              script = null;
              next(e);
            },
          );
        }
        next();
      });
    },
    async generateBundle() {
      const files = statusFiles(await bundleStatusScript());
      for (const [fileName, source] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source });
      const version = createHash('sha256').update(files['status/status.js']!).update(files['status/status.css']!).update(files['offline.html']!).digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(version) });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), storageApi(loadEnv(mode, process.cwd(), '')), statusPages()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // IPv4-адрес явно: на Windows «localhost» у Vite может слушать только ::1, и браузер не подключается.
  // /api – сервер хранилища: встроен в dev-сервер (плагин выше) или отдельный npm run api; в preview – прокси
  server: { host: '127.0.0.1', port: 5173, strictPort: false, proxy: { '/api': apiProxy } },
  preview: { host: '127.0.0.1', proxy: { '/api': apiProxy } },
  build: {
    sourcemap: mode !== 'production',
    // Шрифты – только файлами: CSP разрешает font-src 'self' без data:, а мелкие woff2 Vite иначе встроил бы в CSS
    assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
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
}));
