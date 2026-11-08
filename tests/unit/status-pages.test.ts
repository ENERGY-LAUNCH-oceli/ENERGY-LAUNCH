import { describe, expect, it } from 'vitest';
import { CLASS_TITLE, NGINX_ERROR_CODES, OFFLINE_INFO, STATUS_CODES, statusClass, statusInfo } from '@/errors/codes';
import { serviceWorkerSource } from '@/errors/service-worker';
import { renderStatusPage, statusCss } from '@/errors/static-page';

describe('коды состояния', () => {
  it('все стандартные коды 1xx–5xx, без повторов, с текстами по-русски', () => {
    const codes = STATUS_CODES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const g of ['info', 'success', 'redirect', 'client', 'server'] as const) expect(STATUS_CODES.some((c) => statusClass(c.code) === g), CLASS_TITLE[g]).toBe(true);
    for (const c of [100, 200, 204, 301, 304, 400, 401, 403, 404, 409, 418, 429, 451, 500, 502, 503, 504, 511]) expect(codes).toContain(c);
    for (const c of STATUS_CODES) expect(c.title && c.text && c.hint, String(c.code)).toBeTruthy();
    // Всё, что может отдать nginx, есть в каталоге
    for (const c of NGINX_ERROR_CODES) expect(codes).toContain(c);
  });

  it('нестандартный код – описание его группы; вне диапазона – нет', () => {
    expect(statusInfo(599)?.title).toBe('Код 599');
    expect(statusInfo(42)).toBeNull();
    expect(statusInfo(0)).toBe(OFFLINE_INFO);
  });
});

describe('статические страницы', () => {
  it('текст в HTML, скрипты только внешние (строгая CSP), символы экранированы', () => {
    const html = renderStatusPage({ code: 418, name: "I'm a teapot", title: 'Я – <чайник>', text: 'a & b', hint: 'x' });
    expect(html).toContain('<h1 id="status-title">Я – &lt;чайник&gt;</h1>');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('data-status="418"');
    expect(html.match(/<script[^>]*>[^<]+<\/script>/g)).toBeNull();
    expect(html).toContain('<script src="/status/status.js" defer></script>');
    // Без анимаций: код крупно на тёмной панели, группа кода, кнопки
    expect(html).not.toContain('<canvas');
    expect(html).toContain('<div class="code">418</div>');
    expect(html).toContain('4xx · Ошибки запроса');
  });

  it('офлайн-страница: кнопка проверки связи; стили – обе темы', () => {
    expect(renderStatusPage(OFFLINE_INFO)).toContain('Проверить подключение');
    expect(statusCss()).toContain(':root[data-theme="dark"]');
  });

  it('service worker подменяет только недоступные из-за сети страницы и не трогает API', () => {
    const sw = serviceWorkerSource('abc');
    expect(sw).toContain("'el-status-abc'");
    expect(sw).toContain("req.mode === 'navigate'");
    expect(sw).toContain("startsWith('/api/')");
  });
});
