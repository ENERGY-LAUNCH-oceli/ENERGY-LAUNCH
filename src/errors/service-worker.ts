/**
 * Исходник service worker (/sw.js) – генерируется при сборке с версией по содержимому страниц состояния.
 * Делает одно: если страница не загрузилась из-за отсутствия сети – показывает /offline.html.
 * Ничего, кроме страниц состояния, не кеширует: приложение и данные всегда берутся с сервера.
 */
export const OFFLINE_PRECACHE = ['/offline.html', '/status/status.js', '/status/status.css', '/theme-init.js', '/favicon.svg'] as const;

export function serviceWorkerSource(version: string): string {
  return `// Energy Launch: страница «Нет подключения» без сети. Сгенерировано при сборке.
const CACHE = 'el-status-${version}';
const PRECACHE = ${JSON.stringify(OFFLINE_PRECACHE)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('el-status-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Сеть – первой; ответ сервера (в том числе ошибка 4xx/5xx) показывается как есть, офлайн-страница – только без сети
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html').then((r) => r || Response.error())));
    return;
  }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(fetch(req).catch(() => caches.match(url.pathname).then((r) => r || Response.error())));
  }
});
`;
}
