import { create } from 'zustand';
import { localStore } from '@/utils/local-store';

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
const readDone = (): string[] => localStore.getJson<unknown[]>(DONE_KEY, [], Array.isArray).filter((x): x is string => typeof x === 'string');

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
    localStore.setJson(DONE_KEY, done);
    set({ done });
  },
  reset: () => {
    localStore.remove(DONE_KEY);
    set({ done: [] });
  },
}));
