import { useSyncExternalStore } from 'react';

/**
 * Общие «часы» для относительного времени («2 минуты назад»): один интервал на всё приложение,
 * работает, только пока на экране есть подписчики. Подписи обновляются сами, без закрытия и открытия панели.
 */
// Раз в секунду: «25 секунд назад» должно меняться плавно. Перерисовываются только подписи времени
const TICK_MS = 1_000;
const listeners = new Set<() => void>();
let now = Date.now();
let timer: number | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export const useNow = () => useSyncExternalStore(subscribe, () => now, () => now);
