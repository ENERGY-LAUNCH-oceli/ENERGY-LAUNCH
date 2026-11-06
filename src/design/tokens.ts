/**
 * ENERGY LAUNCH – дизайн-токены.
 *
 * Единственный источник значений. Отсюда tailwind.config.ts генерирует CSS-переменные
 * (`--el-*`) для двух тем и утилиты Tailwind. Компоненты используют только семантические
 * имена (bg-surface, text-text-secondary …), поэтому тема переключается заменой переменных.
 *
 * От Oceli Energy взята только палитра (тёмно-синий, бирюзовый, синий).
 * Форма и типографика – минималистичные: тонкие линии, плоские поверхности,
 * Inter / Inter Tight / JetBrains Mono.
 * Файл не должен импортировать модули приложения: его загружает конфиг Tailwind.
 */

/** Базовая палитра бренда (Oceli Energy). */
export const palette = {
  navy950: '#031A30',
  navy900: '#052849',
  navy800: '#0B3A64',
  teal700: '#016570',
  teal600: '#017683',
  teal500: '#018A98',
  teal400: '#22AFBF',
  teal300: '#2BC7D6',
  teal50: '#E2FBFE',
  blue600: '#015BB0',
  blue400: '#4F9BE8',
  white: '#FFFFFF',
} as const;

export type ThemeId = 'light' | 'dark';
export type AccentId = 'teal' | 'blue';

export const accentThemes: Record<AccentId, Record<ThemeId, Pick<SemanticColors, 'accent' | 'accentStrong' | 'accentHover' | 'accentForeground' | 'accentSubtle' | 'ring'>>> = {
  teal: {
    light: { accent: palette.teal500, accentStrong: '#017E8B', accentHover: palette.teal700, accentForeground: palette.white, accentSubtle: '#E6F6F7', ring: palette.teal500 },
    dark: { accent: palette.teal400, accentStrong: '#3CC6D5', accentHover: '#5DD3E0', accentForeground: '#04191D', accentSubtle: '#0E2A30', ring: palette.teal400 },
  },
  blue: {
    light: { accent: palette.blue600, accentStrong: palette.blue600, accentHover: palette.navy800, accentForeground: palette.white, accentSubtle: '#EAF2FA', ring: palette.blue600 },
    dark: { accent: palette.blue400, accentStrong: '#6AAEF0', accentHover: '#86BBF3', accentForeground: '#06121D', accentSubtle: '#0F2236', ring: palette.blue400 },
  },
};

/** Семантические цвета. Ключи одинаковы в обеих темах. */
type SemanticColors = Record<
  | 'primary' | 'primaryHover' | 'primaryForeground'
  | 'secondary' | 'secondaryForeground'
  | 'accent' | 'accentStrong' | 'accentHover' | 'accentForeground' | 'accentSubtle'
  | 'background' | 'surface' | 'surfaceSecondary' | 'surfaceSunken' | 'surfaceHover' | 'surfaceInverse'
  | 'border' | 'borderStrong' | 'ring'
  | 'textPrimary' | 'textSecondary' | 'textMuted' | 'textInverse' | 'textInverseSecondary' | 'textInverseMuted'
  | 'success' | 'successSubtle' | 'successBorder'
  | 'warning' | 'warningSubtle' | 'warningBorder'
  | 'error' | 'errorSubtle' | 'errorBorder' | 'errorHover'
  | 'info' | 'infoSubtle' | 'infoBorder',
  string
>;

const light: SemanticColors = {
  primary: palette.navy900,
  primaryHover: palette.navy800,
  primaryForeground: palette.white,
  secondary: palette.blue600,
  secondaryForeground: palette.white,
  accent: palette.teal500,
  /** Акцент для текста и заливок под белым текстом (≥ 4.5:1). */
  accentStrong: '#017E8B',
  accentHover: palette.teal700,
  accentForeground: palette.white,
  accentSubtle: '#E6F6F7',

  background: '#F6F8F9',
  surface: palette.white,
  surfaceSecondary: '#FAFBFC',
  surfaceSunken: '#EEF2F4',
  surfaceHover: '#F2F5F7',
  surfaceInverse: palette.navy900,

  border: '#E3E8EC',
  borderStrong: '#CBD5DC',
  ring: palette.teal500,

  textPrimary: '#0B2236',
  textSecondary: '#44566A',
  textMuted: '#5F7082',
  textInverse: palette.white,
  textInverseSecondary: '#C4D0DB',
  textInverseMuted: '#8EA0B1',

  success: '#177449',
  successSubtle: '#E9F5EF',
  successBorder: '#C3E3D1',
  warning: '#8F5200',
  warningSubtle: '#FDF3E1',
  warningBorder: '#F0D7A6',
  error: '#B23A26',
  errorSubtle: '#FCEFEB',
  errorBorder: '#F1C9BF',
  errorHover: '#F8E1DA',
  info: palette.blue600,
  infoSubtle: '#EAF2FA',
  infoBorder: '#C5D9EE',
};

const dark: SemanticColors = {
  primary: '#F2F3F4',
  primaryHover: palette.white,
  primaryForeground: '#202225',
  secondary: palette.blue400,
  secondaryForeground: '#202225',
  accent: palette.teal400,
  accentStrong: '#3CC6D5',
  accentHover: '#5DD3E0',
  accentForeground: '#172522',
  accentSubtle: '#293A35',

  background: '#202225',
  surface: '#282A2D',
  surfaceSecondary: '#303236',
  surfaceSunken: '#191B1D',
  surfaceHover: '#37393D',
  surfaceInverse: '#F2F3F4',

  border: '#3D3F43',
  borderStrong: '#55585D',
  ring: palette.teal400,

  textPrimary: '#F2F3F4',
  textSecondary: '#C8C9CC',
  textMuted: '#A3A5A9',
  textInverse: '#202225',
  textInverseSecondary: '#55585D',
  textInverseMuted: '#707378',

  success: '#67D39C',
  successSubtle: '#263D34',
  successBorder: '#3B5D4D',
  warning: '#F0BD69',
  warningSubtle: '#443A2B',
  warningBorder: '#65553A',
  error: '#FF9683',
  errorSubtle: '#48332F',
  errorBorder: '#6B4942',
  errorHover: '#58403A',
  info: '#82BDF3',
  infoSubtle: '#30353B',
  infoBorder: '#51575E',
};

export const themes: Record<ThemeId, SemanticColors> = { light, dark };

/** Светлая тема – по умолчанию. Ключи используются для генерации утилит Tailwind. */
export const colors = light;

/**
 * Цвета статусов этапов. Различаются тоном (серый / синий / коралловый / зелёный),
 * формой маркера и текстом – статус не кодируется одним цветом.
 */
type StatusSet = { fg: string; bg: string; border: string; solid: string };
export const stageStatusThemes: Record<ThemeId, Record<'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED', StatusSet>> = {
  light: {
    NOT_STARTED: { fg: '#56697D', bg: '#EFF3F6', border: '#D8E1E8', solid: '#9AA9B7' },
    IN_PROGRESS: { fg: light.info, bg: light.infoSubtle, border: light.infoBorder, solid: light.info },
    BLOCKED: { fg: light.error, bg: light.errorSubtle, border: light.errorBorder, solid: '#D2553D' },
    COMPLETED: { fg: light.success, bg: light.successSubtle, border: light.successBorder, solid: '#1F8C59' },
  },
  dark: {
    NOT_STARTED: { fg: '#B3B5B8', bg: '#343639', border: '#4A4C50', solid: '#85878B' },
    IN_PROGRESS: { fg: dark.info, bg: dark.infoSubtle, border: dark.infoBorder, solid: dark.info },
    BLOCKED: { fg: dark.error, bg: dark.errorSubtle, border: dark.errorBorder, solid: '#E5694F' },
    COMPLETED: { fg: dark.success, bg: dark.successSubtle, border: dark.successBorder, solid: '#3DB07A' },
  },
};
export const stageStatusColors = stageStatusThemes.light;

/** Шрифты: Inter – текст, Inter Tight – заголовки и крупные числа, JetBrains Mono – коды, ID, даты. */
export const fontFamily = {
  sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
  heading: ['"Inter Tight Variable"', '"Inter Tight"', '"Inter Variable"', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
} as const;

/**
 * Типографическая шкала: [размер, { lineHeight, fontWeight, letterSpacing }].
 * Спокойные веса (400–600), плотный трекинг у заголовков.
 */
export const typography = {
  display: ['2.5rem', { lineHeight: '2.75rem', fontWeight: '600', letterSpacing: '-0.035em' }], // 40/44
  h1: ['1.75rem', { lineHeight: '2.125rem', fontWeight: '600', letterSpacing: '-0.025em' }], // 28/34
  h2: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600', letterSpacing: '-0.02em' }], // 20/28
  h3: ['1rem', { lineHeight: '1.5rem', fontWeight: '600', letterSpacing: '-0.01em' }], // 16/24
  'body-lg': ['0.9375rem', { lineHeight: '1.5rem', fontWeight: '400', letterSpacing: '0' }], // 15/24
  body: ['0.875rem', { lineHeight: '1.375rem', fontWeight: '400', letterSpacing: '0' }], // 14/22
  'body-sm': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '400', letterSpacing: '0' }], // 13/20
  caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '400', letterSpacing: '0' }], // 12/16
  label: ['0.6875rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.06em' }], // 11/16, моноширинный, uppercase
  numeric: ['1.75rem', { lineHeight: '2rem', fontWeight: '600', letterSpacing: '-0.04em' }], // 28/32
  'numeric-sm': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '500', letterSpacing: '0' }],
} as const;

/** Скругления: сдержанные, без «пилюль» у кнопок. */
export const radius = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  pill: '999px',
} as const;

/** Тени: только у всплывающих слоёв. */
export const shadowThemes: Record<ThemeId, Record<'xs' | 'md' | 'lg', string>> = {
  light: {
    xs: '0 1px 2px rgba(11,34,54,0.05)',
    md: '0 8px 24px rgba(11,34,54,0.08)',
    lg: '0 16px 40px -8px rgba(11,34,54,0.16)',
  },
  dark: {
    xs: '0 1px 2px rgba(0,0,0,0.18)',
    md: '0 8px 24px rgba(0,0,0,0.24)',
    lg: '0 16px 40px -8px rgba(0,0,0,0.32)',
  },
};
export const shadow = shadowThemes.light;

/** Сетка отступов – шаг 4px. */
export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const motion = {
  fast: '150ms',
  base: '240ms',
  slow: '400ms',
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/** Цвета рядов для графиков (порядок важен). */
export const chartSeries = [palette.teal500, palette.blue600, palette.navy900, palette.teal300] as const;

/** Преобразование HEX → "r g b" для CSS-переменных с поддержкой прозрачности. */
export function hexToRgbChannels(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Цветовые CSS-переменные одной темы. */
export function buildThemeVariables(theme: ThemeId): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(themes[theme])) vars[`--el-${kebab(k)}`] = hexToRgbChannels(v);
  for (const [status, set] of Object.entries(stageStatusThemes[theme])) {
    for (const [k, v] of Object.entries(set)) vars[`--el-status-${status.toLowerCase().replace('_', '-')}-${k}`] = hexToRgbChannels(v);
  }
  for (const [k, v] of Object.entries(shadowThemes[theme])) vars[`--el-shadow-${k}`] = v;
  vars['color-scheme'] = theme;
  return vars;
}

/** CSS-переменные акцентной палитры для выбранной светлой или тёмной темы. */
export function buildAccentVariables(accent: AccentId, theme: ThemeId): Record<string, string> {
  return Object.fromEntries(
    Object.entries(accentThemes[accent][theme]).map(([key, value]) => [`--el-${kebab(key)}`, hexToRgbChannels(value)]),
  );
}

/** CSS-переменные :root (светлая тема + общие значения). */
export function buildCssVariables(): Record<string, string> {
  const vars = buildThemeVariables('light');
  for (const [k, v] of Object.entries(radius)) vars[`--el-radius-${k}`] = v;
  vars['--el-ease'] = motion.easing;
  return vars;
}
