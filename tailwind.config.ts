import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';
import { buildAccentVariables, buildCssVariables, buildThemeVariables, colors, fontFamily, motion, typography } from './src/design/tokens';

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const rgbVar = (name: string) => `rgb(var(--el-${name}) / <alpha-value>)`;

/** Цвета Tailwind из семантических токенов: bg-surface, text-text-secondary, border-border … */
const semanticColors = Object.fromEntries(
  Object.entries(colors)
    .map(([k]) => [kebab(k), rgbVar(kebab(k))]),
);

const statusColor = (s: string) => ({
  DEFAULT: rgbVar(`status-${s}-fg`),
  fg: rgbVar(`status-${s}-fg`),
  bg: rgbVar(`status-${s}-bg`),
  border: rgbVar(`status-${s}-border`),
  solid: rgbVar(`status-${s}-solid`),
});

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', md: '2rem' }, screens: { '2xl': '1440px' } },
    extend: {
      fontFamily: { sans: [...fontFamily.sans], heading: [...fontFamily.heading], mono: [...fontFamily.mono] },
      fontSize: typography as unknown as NonNullable<Config['theme']>['fontSize'],
      colors: {
        ...semanticColors,
        // совместимость с примитивами shadcn/ui
        foreground: rgbVar('text-primary'),
        muted: { DEFAULT: rgbVar('surface-sunken'), foreground: rgbVar('text-muted') },
        input: rgbVar('border-strong'),
        status: {
          'not-started': statusColor('not-started'),
          'in-progress': statusColor('in-progress'),
          blocked: statusColor('blocked'),
          completed: statusColor('completed'),
        },
      },
      borderRadius: {
        xs: 'var(--el-radius-xs)',
        sm: 'var(--el-radius-sm)',
        DEFAULT: 'var(--el-radius-sm)',
        md: 'var(--el-radius-md)',
        lg: 'var(--el-radius-lg)',
        xl: 'var(--el-radius-xl)',
        pill: 'var(--el-radius-pill)',
      },
      boxShadow: { xs: 'var(--el-shadow-xs)', md: 'var(--el-shadow-md)', lg: 'var(--el-shadow-lg)' },
      transitionTimingFunction: { brand: motion.easing },
      transitionDuration: { fast: motion.fast, base: motion.base, slow: motion.slow },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: { shimmer: 'shimmer 1.4s linear infinite' },
    },
  },
  plugins: [
    animate,
    plugin(({ addBase }) => {
      addBase({
        ':root': buildCssVariables(),
        ':root[data-theme="dark"]': buildThemeVariables('dark'),
        ':root[data-accent="blue"]': buildAccentVariables('blue', 'light'),
        ':root[data-theme="dark"][data-accent="blue"]': buildAccentVariables('blue', 'dark'),
        // Печать / PDF протокола — всегда в светлой теме
        '@media print': { ':root[data-theme="dark"]': buildThemeVariables('light') },
      });
    }),
  ],
} satisfies Config;
