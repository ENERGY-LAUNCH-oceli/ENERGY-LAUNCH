/**
 * Статические страницы состояния: /status/<код>.html (error_page nginx) и /offline.html (service worker).
 * Работают без приложения: текст – в HTML, кнопки – /status/status.js (строгая CSP: без встроенных скриптов).
 * Вид – как у страниц ошибок в приложении: тёмная панель с кодом слева, пояснение справа.
 * Модуль используется конфигом сборки (vite.config.ts) – только относительные импорты.
 */
import { accentThemes, themes } from '../design/tokens';
import { CLASS_TITLE, OFFLINE_INFO, statusClass, type StatusInfo } from './codes';

/** «Нет сигнала»: точка и три гаснущие дуги волн (как в приложении). */
const WIFI_OFF =
  '<svg class="no-signal" viewBox="0 0 120 100" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M44.44 68.44A22 22 0 0 1 75.56 68.44" stroke="#fff" stroke-opacity=".4" stroke-width="7"/><path d="M30.3 54.3A42 42 0 0 1 89.7 54.3" stroke="#fff" stroke-opacity=".2" stroke-width="7"/><path d="M16.16 40.16A62 62 0 0 1 103.84 40.16" stroke="#fff" stroke-opacity=".1" stroke-width="7"/><circle cx="60" cy="84" r="6.5" fill="#fff"/></svg>';

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
<main class="page">
<section class="card" aria-labelledby="status-title">
<div class="side">
<div class="brand"><img src="/favicon.svg" alt="" width="32" height="32" /><span>Energy Launch</span></div>
<div class="code">${offline ? WIFI_OFF : esc(String(info.code))}</div>
<p class="side-label">${esc(label)}</p>
</div>
<div class="body">
<p class="group${failing ? ' is-failing' : ''}">${esc(CLASS_TITLE[cls])}</p>
<h1 id="status-title">${esc(info.title)}</h1>
<p class="text">${esc(info.text)}</p>
<p class="hint">${esc(info.hint)}</p>
<div class="actions">
<button type="button" class="btn btn-accent" data-action="reload">${offline ? 'Проверить подключение' : 'Обновить страницу'}</button>
<a class="btn" href="/">На главную</a>
${offline ? '' : '<button type="button" class="btn btn-ghost" data-action="back">Назад</button>'}
</div>
${offline ? '<p class="hint" id="el-status-net" aria-live="polite">Страница обновится сама, когда связь вернётся.</p>' : ''}
</div>
</section>
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
.page{min-height:100vh;padding:12px}
.card{min-height:calc(100vh - 24px);display:grid;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
@media (min-width:768px){.card{grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}}
.side{position:relative;overflow:hidden;min-height:240px;padding:32px;color:#fff;background:radial-gradient(130% 85% at 80% 110%,rgba(43,199,214,.95) 0%,rgba(1,138,152,.7) 22%,rgba(1,101,112,.4) 42%,rgba(5,40,73,.25) 62%,transparent 80%),#020B16}
.side::after{content:"";position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");pointer-events:none}
.brand{position:absolute;top:32px;left:32px;z-index:1;display:flex;align-items:center;gap:10px;font:600 18px/1 "Inter Tight Variable","Inter Tight","Inter Variable",Inter,system-ui,sans-serif;letter-spacing:-.01em}
.code{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-right:.05em;font:600 clamp(96px,13vw,200px)/1 "Inter Tight Variable","Inter Tight","Inter Variable",Inter,system-ui,sans-serif;letter-spacing:-.05em}
.side-label{position:absolute;bottom:32px;left:32px;z-index:1;margin:0;font:500 12px/1.4 "JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.no-signal{width:clamp(120px,14vw,190px)}
.body{display:flex;flex-direction:column;justify-content:center;gap:16px;padding:32px}
@media (min-width:640px){.body{padding:48px}}
.group{margin:0;font:600 11px/1.4 "JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.group.is-failing{color:var(--error)}
h1{margin:0;font:600 clamp(28px,4vw,36px)/1.15 "Inter Tight Variable","Inter Tight","Inter Variable",Inter,system-ui,sans-serif;letter-spacing:-.02em}
.text{margin:0;max-width:520px;font-size:17px;color:var(--fg2)}
.hint{margin:0;max-width:520px;font-size:13px;color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 16px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--fg);font:500 14px/1 "Inter Variable",Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-decoration:none;cursor:pointer;transition:background-color .15s,border-color .15s}
.btn:hover{background:var(--hover);border-color:var(--border2)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn:disabled{opacity:.5;cursor:default}
.btn-accent{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.btn-accent:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
.btn-ghost{border-color:transparent;background:transparent;color:var(--fg2)}
`;
}
