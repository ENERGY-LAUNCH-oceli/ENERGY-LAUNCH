/**
 * Скрипт статических страниц состояния (/status/<код>.html, /offline.html): анимация, кнопки,
 * для офлайна – автоматическое обновление, когда связь вернулась. Собирается отдельно (IIFE) плагином в vite.config.ts.
 */
import { pickAnimation, startStatusAnimation, type RunningAnimation } from './animations';
import { statusClass } from './codes';
import { animationColors } from './theme';

function init() {
  const root = document.documentElement;
  const code = Number(root.dataset.status ?? '0');
  const cls = statusClass(code);
  const canvas = document.getElementById('el-status-anim') as HTMLCanvasElement | null;
  const nameEl = document.getElementById('el-status-anim-name');
  let forced: string | null = null;
  try {
    forced = new URLSearchParams(location.search).get('anim');
  } catch {
    /* без параметров */
  }
  const anim = pickAnimation(forced);
  let running: RunningAnimation | null = null;
  const start = () => {
    running?.stop();
    if (canvas) running = startStatusAnimation(canvas, { label: code ? String(code) : '000', colors: animationColors(cls), animation: anim });
  };
  start();
  if (nameEl) nameEl.textContent = `Анимация «${anim.name}» – при обновлении страницы будет другая`;
  root.dataset.animation = anim.id;
  new MutationObserver(start).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });

  document.querySelector('[data-action="back"]')?.addEventListener('click', () => (history.length > 1 ? history.back() : location.assign('/')));
  const reload = document.querySelector<HTMLButtonElement>('[data-action="reload"]');

  if (code !== 0) {
    reload?.addEventListener('click', () => location.reload());
    return;
  }

  // Офлайн: страница отдана service worker'ом вместо недоступной – как только сервер отвечает, открываем нужный адрес
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
