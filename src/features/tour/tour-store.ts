import { create } from 'zustand';

/** Активный тур «Обучения»: какой урок показывается и на каком шаге. */
interface TourState {
  tourId: string | null;
  index: number;
  /** Направление последнего перехода (для шагов, которые нужно пропустить). */
  dir: 1 | -1;
  start(tourId: string): void;
  go(index: number): void;
  stop(): void;
}

export const useTour = create<TourState>()((set, get) => ({
  tourId: null,
  index: 0,
  dir: 1,
  start: (tourId) => set({ tourId, index: 0, dir: 1 }),
  go: (index) => set({ index, dir: index >= get().index ? 1 : -1 }),
  stop: () => set({ tourId: null, index: 0, dir: 1 }),
}));

const DONE_KEY = 'el.help.done';
const readDone = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Пройденные уроки. Хранятся в браузере: это удобство, а не данные запуска – без хранилища всё работает. */
interface ProgressState {
  done: string[];
  markDone(id: string): void;
  reset(): void;
}

export const useHelpProgress = create<ProgressState>()((set, get) => ({
  done: readDone(),
  markDone: (id) => {
    if (get().done.includes(id)) return;
    const done = [...get().done, id];
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(done));
    } catch {
      /* приватный режим – отметка живёт до перезагрузки */
    }
    set({ done });
  },
  reset: () => {
    try {
      localStorage.removeItem(DONE_KEY);
    } catch {
      /* нет хранилища */
    }
    set({ done: [] });
  },
}));
