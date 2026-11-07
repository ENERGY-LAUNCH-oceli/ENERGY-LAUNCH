import { beforeAll, describe, expect, it, vi } from 'vitest';
import { pickAnimation, STATUS_ANIMATIONS, type AnimColors } from '@/errors/animations';
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
    expect(html).toContain('<h1>Я – &lt;чайник&gt;</h1>');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('data-status="418"');
    expect(html.match(/<script[^>]*>[^<]+<\/script>/g)).toBeNull();
    expect(html).toContain('<script src="/status/status.js" defer></script>');
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

/** canvas 2D в jsdom нет – заглушка принимает любые вызовы и свойства. */
function fakeCtx(): CanvasRenderingContext2D {
  const fn = () => undefined;
  return new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k in t ? t[k as string] : fn),
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D;
}

const COLORS: AnimColors = { bg: '#F6F8F9', fg: '#0B2236', muted: '#5F7082', line: '#E3E8EC', accent: '#018A98', accent2: '#015BB0', alert: '#B23A26', warn: '#8F5200', ok: '#177449' };

describe('анимации', () => {
  // Частицам нужен растровый текст – в jsdom canvas нет, анимация должна это пережить
  beforeAll(() => void vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null));

  it.each(STATUS_ANIMATIONS.map((a) => [a.id, a] as const))('%s: 600 кадров без ошибок на разных размерах', (_id, anim) => {
    for (const [w, h] of [[320, 220], [760, 300]] as const) {
      let seed = 1;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const frame = anim.setup({ ctx: fakeCtx(), w, h, colors: COLORS, label: '404', rand, pointer: { x: w / 2, y: h / 2, active: true } });
      for (let i = 1; i <= 600; i++) frame(i / 60, 1 / 60);
    }
  });

  it('при каждой загрузке – другая анимация, чем в прошлый раз', () => {
    sessionStorage.clear();
    let prev = pickAnimation().id;
    for (let i = 0; i < 50; i++) {
      const next = pickAnimation().id;
      expect(next).not.toBe(prev);
      prev = next;
    }
    expect(pickAnimation('radar').id).toBe('radar');
    expect(new Set(STATUS_ANIMATIONS.map((a) => a.id)).size).toBe(STATUS_ANIMATIONS.length);
  });
});
