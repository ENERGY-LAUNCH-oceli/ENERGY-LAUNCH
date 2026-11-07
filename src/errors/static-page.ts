/**
 * Статические страницы состояния: /status/<код>.html (error_page nginx) и /offline.html (service worker).
 * Работают без приложения: текст – в HTML, анимация и кнопки – /status/status.js (строгая CSP: без встроенных скриптов).
 * Модуль используется конфигом сборки (vite.config.ts) – только относительные импорты.
 */
import { accentThemes, themes } from '../design/tokens';
import { OFFLINE_INFO, statusClass, type StatusInfo } from './codes';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function renderStatusPage(info: StatusInfo): string {
  const cls = statusClass(info.code);
  const offline = info.code === 0;
  const failing = cls === 'client' || cls === 'server' || offline;
  const label = offline ? 'Offline · нет ответа сервера' : `HTTP ${info.code} · ${info.name}`;
  const title = offline ? info.title : `${info.code} – ${info.title}`;
  return `<!doctype html>
<html lang="ru" data-status="${info.code}" data-class="${cls}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${esc(title)} · Energy Launch</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/status/status.css" />
<script src="/theme-init.js"></script>
<script src="/status/status.js" defer></script>
</head>
<body>
<main class="status">
<canvas id="el-status-anim" aria-hidden="true"></canvas>
<p class="status-label${failing ? ' is-failing' : ''}">${esc(label)}</p>
<h1>${esc(info.title)}</h1>
<p class="status-text">${esc(info.text)}</p>
<p class="status-hint">${esc(info.hint)}</p>
<div class="status-actions">
<button type="button" class="btn btn-accent" data-action="reload">${offline ? 'Проверить подключение' : 'Обновить страницу'}</button>
<a class="btn" href="/">На главную</a>
${offline ? '' : '<button type="button" class="btn btn-ghost" data-action="back">Назад</button>'}
</div>
${offline ? '<p class="status-note" id="el-status-net" aria-live="polite">Страница обновится сама, когда связь вернётся.</p>' : ''}
<p class="status-anim" id="el-status-anim-name"></p>
</main>
</body>
</html>
`;
}

export const renderOfflinePage = () => renderStatusPage(OFFLINE_INFO);

/** Стили страниц из тех же токенов, что у приложения: обе темы, оба акцента. */
export function statusCss(): string {
  const vars = (t: 'light' | 'dark', a: 'teal' | 'blue') => {
    const c = { ...themes[t], ...accentThemes[a][t] };
    return `--bg:${c.background};--fg:${c.textPrimary};--fg2:${c.textSecondary};--muted:${c.textMuted};--border:${c.border};--border2:${c.borderStrong};--surface:${c.surface};--hover:${c.surfaceHover};--accent:${c.accentStrong};--accent-fg:${c.accentForeground};--accent-hover:${c.accentHover};--error:${c.error};`;
  };
  return `:root{${vars('light', 'teal')}color-scheme:light}
:root[data-accent="blue"]{${vars('light', 'blue')}}
:root[data-theme="dark"]{${vars('dark', 'teal')}color-scheme:dark}
:root[data-theme="dark"][data-accent="blue"]{${vars('dark', 'blue')}}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:var(--bg);color:var(--fg);font:400 15px/1.55 "Inter Variable",Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.status{min-height:100vh;max-width:760px;margin:0 auto;padding:32px 16px 40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
canvas{width:100%;height:240px;display:block;touch-action:none;margin-bottom:12px}
@media (min-width:640px){canvas{height:300px}}
.status-label{margin:0;font:600 12px/1.4 "JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.status-label.is-failing{color:var(--error)}
h1{margin:0;font:600 clamp(26px,5vw,34px)/1.2 "Inter Tight Variable","Inter Tight","Inter Variable",Inter,system-ui,sans-serif;letter-spacing:-.01em}
.status-text{margin:0;max-width:560px;font-size:17px;color:var(--fg2)}
.status-hint,.status-note,.status-anim{margin:0;max-width:560px;font-size:13px;color:var(--muted)}
.status-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:14px 0 6px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font:500 14px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer;transition:background-color .15s,border-color .15s}
.btn:hover{background:var(--hover);border-color:var(--border2)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn-accent{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.btn-accent:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
.btn-ghost{border-color:transparent;background:transparent;color:var(--fg2)}
.status-anim{margin-top:10px}
`;
}
