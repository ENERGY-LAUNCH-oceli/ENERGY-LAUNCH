import { create } from 'zustand';

const KEY = 'el.sidebar.collapsed';
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
  searchOpen: boolean;
  setSearchOpen(open: boolean): void;
  contextPanelOpen: boolean;
  /** Фильтры главного экрана — чтобы вернуться к тому же списку. */
  overviewSearch: string;
  setOverviewSearch(search: string): void;
  setContextPanelOpen(open: boolean): void;
}

/** Состояние оболочки интерфейса (не бизнес-данные). */
export const useUi = create<UiState>()((set, get) => ({
  sidebarCollapsed: read(),
  toggleSidebar: () => {
    const v = !get().sidebarCollapsed;
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* хранилище недоступно — состояние живёт до перезагрузки */
    }
    set({ sidebarCollapsed: v });
  },
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  overviewSearch: '',
  setOverviewSearch: (overviewSearch) => set({ overviewSearch }),
  contextPanelOpen: true,
  setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
}));
