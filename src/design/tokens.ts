/**
 * ENERGY LAUNCH — дизайн-токены.
 *
 * Единственный источник значений. Отсюда:
 *  - tailwind.config.ts генерирует CSS-переменные (`--el-*`) и утилиты Tailwind;
 *  - TS-код (например, будущие графики ECharts) берёт сырые значения.
 *
 * Значения взяты из анализа https://oceli.energy/ (вычисленные стили страницы,
 * ноябрь 2026). Происхождение каждого значения — в docs/design-system.md.
 * Файл не должен импортировать модули приложения: его загружает конфиг Tailwind.
 */

/** Базовая палитра бренда (значения с сайта Oceli Energy). */
export const palette = {
  navy950: '#031A30',
  navy900: '#052849', // oceli: --menu-text-color, текст, тёмные кнопки, подвал
  navy800: '#0B3A64',
  navy700: '#1B4C78',
  teal700: '#016570',
  teal600: '#017683',
  teal500: '#018A98', // oceli: акцентный текст, рамки «Посмотреть», --t396-bordercolor
  teal400: '#22AFBF', // oceli: надзаголовки в подвале
  teal300: '#2BC7D6', // oceli: градиенты карточек
  teal100: '#CAF9FE', // oceli: фон секций
  teal50: '#E2FBFE', // oceli: фон секций
  aqua25: '#F6FFFF', // oceli: основной светлый фон
  blue600: '#015BB0', // oceli: градиент карточки «Студия»
  steel500: '#3A78A6', // oceli: градиент карточки «ИИ для бизнеса»
  sky300: '#8BBCE0', // oceli: градиент баннера «События»
  white: '#FFFFFF',
} as const;

/** Семантические цвета (светлая тема). */
export const colors = {
  // Бренд
  primary: palette.navy900,
  primaryHover: palette.navy800,
  primaryForeground: palette.white,
  secondary: palette.blue600,
  secondaryForeground: palette.white,
  accent: palette.teal500,
  /** Акцент для текста и заливок под белым текстом (контраст ≥ 4.5:1). */
  accentStrong: '#017E8B',
  accentForeground: palette.white,
  accentSubtle: palette.teal50,

  // Поверхности
  background: '#F2F8F9',
  surface: palette.white,
  surfaceSecondary: palette.aqua25,
  surfaceSunken: '#E9F2F4',
  surfaceInverse: palette.navy900,

  // Границы
  border: '#D6E5E9',
  borderStrong: '#B3CDD4',
  ring: palette.teal500,

  // Текст
  textPrimary: palette.navy900,
  textSecondary: '#4A6178',
  textMuted: '#5E7286',
  textInverse: palette.white,
  textInverseSecondary: 'rgba(255,255,255,0.78)', // oceli: ссылки в подвале
  textInverseMuted: 'rgba(255,255,255,0.48)', // oceli: юридические ссылки

  // Сигнальные
  success: '#177449',
  successSubtle: '#E7F5EE',
  successBorder: '#B7DEC9',
  warning: '#9A5700',
  warningSubtle: '#FFF4DE',
  warningBorder: '#F1D49B',
  error: '#B9402A',
  errorSubtle: '#FDF0EC',
  errorBorder: '#F2C3B8',
  info: palette.blue600,
  infoSubtle: '#E8F1FA',
  infoBorder: '#BCD4EE',
} as const;

/**
 * Цвета статусов этапов. Различаются тоном (серый / синий / коралловый / зелёный),
 * иконкой и формой маркера — статус не кодируется одним цветом.
 * «Заблокирован» — мягкий коралловый на светлой подложке, без сплошной красной заливки.
 */
export const stageStatusColors = {
  NOT_STARTED: { fg: '#56697D', bg: '#EEF3F6', border: '#D3DEE6', solid: '#8A9BAD' },
  IN_PROGRESS: { fg: colors.info, bg: colors.infoSubtle, border: colors.infoBorder, solid: colors.info },
  BLOCKED: { fg: colors.error, bg: colors.errorSubtle, border: colors.errorBorder, solid: '#D2553D' },
  COMPLETED: { fg: colors.success, bg: colors.successSubtle, border: colors.successBorder, solid: '#1F8C59' },
} as const;

/** Шрифты: Manrope — фирменный шрифт Oceli; моноширинный — для EAN, сигналов, ID. */
export const fontFamily = {
  sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
} as const;

/**
 * Типографическая шкала: [размер, { lineHeight, fontWeight, letterSpacing }].
 * Пропорции повторяют сайт (заголовки 800, надзаголовки 12/800/0.16em, текст 14–15px),
 * размеры уплотнены под рабочий интерфейс.
 */
export const typography = {
  display: ['2.75rem', { lineHeight: '3.25rem', fontWeight: '800', letterSpacing: '-0.01em' }], // 44/52 (oceli 45/52)
  h1: ['2rem', { lineHeight: '2.5rem', fontWeight: '800', letterSpacing: '-0.01em' }], // 32/40
  h2: ['1.5rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.005em' }], // 24/32
  h3: ['1.125rem', { lineHeight: '1.625rem', fontWeight: '700', letterSpacing: '0' }], // 18/26
  'body-lg': ['1rem', { lineHeight: '1.5rem', fontWeight: '400', letterSpacing: '0' }], // 16/24
  body: ['0.9375rem', { lineHeight: '1.4375rem', fontWeight: '400', letterSpacing: '0' }], // 15/23 (oceli)
  'body-sm': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400', letterSpacing: '0' }], // 14/20 (oceli)
  caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0' }], // 12/16
  label: ['0.75rem', { lineHeight: '1rem', fontWeight: '800', letterSpacing: '0.16em' }], // oceli: 12/800/1.92px
  numeric: ['1.75rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '-0.01em' }], // 28/32
  'numeric-sm': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600', letterSpacing: '0' }],
} as const;

/** Скругления: кнопки-«пилюли» как на сайте; карточки скруглены мягко, но плотнее (oceli: 30px). */
export const radius = {
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  pill: '999px',
} as const;

/** Тени: сайт почти не использует тени; одна мягкая тень для всплывающих слоёв. */
export const shadow = {
  xs: '0 1px 2px rgba(5,40,73,0.06)',
  md: '0 8px 24px rgba(5,40,73,0.10)', // oceli
  lg: '0 16px 40px -8px rgba(5,40,73,0.18)',
} as const;

/** Сетка отступов — шаг 4px. */
export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const motion = {
  fast: '120ms',
  base: '200ms',
  slow: '300ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

/**
 * Единственный разрешённый градиент — фирменная подложка Oceli
 * (баннер «События»: 105deg, #EFFAFB → #AAE4E7 → #8BBCE0). Используется только
 * в акцентных блоках верхнего уровня (итог запуска), не в рабочих элементах.
 */
export const brandGradient = 'linear-gradient(105deg, #EFFAFB 0%, #AAE4E7 48%, #8BBCE0 100%)';

/** Цвета рядов для графиков (порядок важен). */
export const chartSeries = [palette.teal500, palette.blue600, palette.navy900, palette.teal300, palette.steel500, palette.sky300] as const;

/** Преобразование HEX → "r g b" для CSS-переменных с поддержкой прозрачности. */
export function hexToRgbChannels(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** CSS-переменные :root, генерируемые из токенов. */
export function buildCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(colors)) {
    vars[`--el-${kebab(k)}`] = v.startsWith('#') ? hexToRgbChannels(v) : v;
  }
  for (const [status, set] of Object.entries(stageStatusColors)) {
    for (const [k, v] of Object.entries(set)) vars[`--el-status-${status.toLowerCase().replace('_', '-')}-${k}`] = hexToRgbChannels(v);
  }
  for (const [k, v] of Object.entries(radius)) vars[`--el-radius-${k}`] = v;
  for (const [k, v] of Object.entries(shadow)) vars[`--el-shadow-${k}`] = v;
  vars['--el-brand-gradient'] = brandGradient;
  vars['--el-ease'] = motion.easing;
  return vars;
}
