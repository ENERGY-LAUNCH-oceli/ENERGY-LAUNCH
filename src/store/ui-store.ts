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

/** Применяет тему к <html>; короткий класс даёт плавный переход цветов только в момент смены. */
export function applyTheme(theme: Theme, animate = false) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-switching');
    window.setTimeout(() => root.classList.remove('theme-switching'), 300);
  }
  if (theme === 'dark') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
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
    applyTheme(theme, true);
    set({ theme });
  },
  setAppearance: (theme, accent) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      // Appearance remains active for the current page if storage is unavailable.
    }
    applyTheme(theme, true);
    applyAccent(accent);
    set({ theme, accent });
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
