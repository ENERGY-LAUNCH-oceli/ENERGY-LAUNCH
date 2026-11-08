/**
 * Скрипт статических страниц состояния (/status/<код>.html, /offline.html): кнопки «Обновить» и «Назад»,
 * для офлайна – возврат на страницу, как только сервер снова отвечает. Собирается отдельно (IIFE) плагином в vite.config.ts.
 */

function init() {
  const code = Number(document.documentElement.dataset.status ?? '0');
  document.querySelector('[data-action="back"]')?.addEventListener('click', () => (history.length > 1 ? history.back() : location.assign('/')));
  const reload = document.querySelector<HTMLButtonElement>('[data-action="reload"]');

  if (code !== 0) {
    reload?.addEventListener('click', () => location.reload());
    return;
  }

  // Офлайн: страницу отдал service worker вместо недоступной – как только сервер отвечает, открываем нужный адрес
  const note = document.getElementById('el-status-net');
  const ping = async () => {
    try {
      const r = await fetch(`/favicon.svg?ping=${Date.now()}`, { cache: 'no-store' });
      return r.ok;
    } catch {
      return false;
    }
  };
  const tryBack = async (manual: boolean) => {
    if (reload) reload.disabled = true;
    const ok = await ping();
    if (reload) reload.disabled = false;
    if (ok) location.reload();
    else if (manual && note) note.textContent = 'Сети по-прежнему нет. Страница обновится сама, когда связь вернётся.';
  };
  reload?.addEventListener('click', () => void tryBack(true));
  window.addEventListener('online', () => void tryBack(false));
  setInterval(() => {
    if (document.visibilityState === 'visible') void tryBack(false);
  }, 10_000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
