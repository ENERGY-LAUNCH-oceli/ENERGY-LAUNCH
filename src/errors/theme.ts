import { accentThemes, themes, type AccentId, type ThemeId } from '../design/tokens';
import type { AnimColors } from './animations';
import type { StatusClass } from './codes';

/** Текущая тема страницы (data-theme / data-accent на <html>, как у приложения). */
export function currentTheme(): { theme: ThemeId; accent: AccentId } {
  const d = typeof document === 'undefined' ? undefined : document.documentElement.dataset;
  return { theme: d?.theme === 'dark' ? 'dark' : 'light', accent: d?.accent === 'blue' ? 'blue' : 'teal' };
}

/** Цвета анимации из токенов дизайна: «сбой» – цвет ошибки только у 4xx, 5xx и офлайна. */
export function animationColors(cls: StatusClass, t = currentTheme()): AnimColors {
  const c = { ...themes[t.theme], ...accentThemes[t.accent][t.theme] };
  const second = accentThemes[t.accent === 'teal' ? 'blue' : 'teal'][t.theme].accent;
  const failing = cls === 'client' || cls === 'server' || cls === 'offline';
  return {
    bg: c.background,
    fg: c.textPrimary,
    muted: c.textMuted,
    line: c.border,
    accent: c.accent,
    accent2: second,
    alert: failing ? c.error : second,
    warn: c.warning,
    ok: c.success,
  };
}
