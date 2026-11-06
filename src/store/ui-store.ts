import { flushSync } from 'react-dom';
import { create } from 'zustand';
import type { AccentId } from '@/design/tokens';

const KEY = 'el.sidebar.collapsed';
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export type Theme = 'light' | 'dark';
const THEME_KEY = 'el.theme';
const ACCENT_KEY = 'el.accent';
const readTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};
const readAccent = (): AccentId => {
  try {
    return localStorage.getItem(ACCENT_KEY) === 'blue' ? 'blue' : 'teal';
  } catch {
    return 'teal';
  }
};

/** Последняя точка нажатия – центр кругового раскрытия новой темы. */
let lastPointer: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') window.addEventListener('pointerdown', (e) => (lastPointer = { x: e.clientX, y: e.clientY }), { capture: true, passive: true });

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Смена оформления с анимацией: новая тема раскрывается кругом от точки нажатия (View Transitions API);
 * без поддержки API – плавный переход цветов. При «уменьшении движения» – мгновенно.
 */
function transitionAppearance(change: () => void) {
  const root = document.documentElement;
  const start = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }).startViewTransition;
  if (reducedMotion()) return change();
  if (!start) {
    root.classList.add('theme-switching');
    change();
    window.setTimeout(() => root.classList.remove('theme-switching'), 300);
    return;
  }
  const { x, y } = lastPointer ?? { x: innerWidth / 2, y: 0 };
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('theme-reveal');
  const t = start.call(document, change);
  // fill: forwards – раскрытая тема держится до конца перехода; класс снимается только после t.finished,
  // иначе на последнем кадре включается стандартное перекрёстное затухание и мелькает старая тема
  t.ready
    .then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 520, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards', pseudoElement: '::view-transition-new(root)' }))
    .catch(() => {});
  t.finished.catch(() => {}).finally(() => root.classList.remove('theme-reveal'));
}

const setThemeAttr = (theme: Theme) => {
  const root = document.documentElement;
  if (theme === 'dark') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
};

/** Применяет тему к <html>. */
export function applyTheme(theme: Theme, animate = false) {
  if (typeof document === 'undefined') return;
  if (animate) transitionAppearance(() => setThemeAttr(theme));
  else setThemeAttr(theme);
}

export function applyAccent(accent: AccentId) {
  if (typeof document === 'undefined') return;
  if (accent === 'blue') document.documentElement.dataset.accent = 'blue';
  else delete document.documentElement.dataset.accent;
}

interface UiState {
  /** Тема интерфейса: по умолчанию светлая, выбор запоминается. */
  theme: Theme;
  toggleTheme(): void;
  accent: AccentId;
  setAppearance(theme: Theme, accent: AccentId): void;
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
  contextPanelOpen: boolean;
  /** Фильтры главного экрана – чтобы вернуться к тому же списку. */
  overviewSearch: string;
  setOverviewSearch(search: string): void;
  setContextPanelOpen(open: boolean): void;
}

/** Состояние оболочки интерфейса (не бизнес-данные). */
export const useUi = create<UiState>()((set, get) => ({
  theme: readTheme(),
  accent: readAccent(),
  toggleTheme: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* хранилище недоступно – тема живёт до перезагрузки */
    }
    // Состояние обновляется внутри перехода: снимок новой темы включает и элементы, окрашенные из JS
    if (typeof document === 'undefined') return set({ theme });
    transitionAppearance(() => {
      setThemeAttr(theme);
      flushSync(() => set({ theme }));
    });
  },
  setAppearance: (theme, accent) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // Appearance remains active for the current page if storage is unavailable.
    }
    if (theme === get().theme && accent === get().accent) return;
    if (typeof document === 'undefined') return set({ theme, accent });
    transitionAppearance(() => {
      setThemeAttr(theme);
      applyAccent(accent);
      flushSync(() => set({ theme, accent }));
    });
  },
  sidebarCollapsed: read(),
  toggleSidebar: () => {
    const v = !get().sidebarCollapsed;
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* хранилище недоступно – состояние живёт до перезагрузки */
    }
    set({ sidebarCollapsed: v });
  },
  overviewSearch: '',
  setOverviewSearch: (overviewSearch) => set({ overviewSearch }),
  contextPanelOpen: true,
  setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
}));
