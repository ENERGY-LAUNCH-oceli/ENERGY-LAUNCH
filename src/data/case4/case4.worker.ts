/// <reference lib="webworker" />
import { loadCase4Portfolio } from './loader';

/**
 * Загрузка и проверка набора кейса 4 в отдельном потоке.
 * Протокол: 'load' → прогресс → 'ready' (маленькое сообщение); результат отдаётся только по 'send' –
 * основной поток забирает его в момент, когда анимация прелоадера неподвижна.
 */
let result: Awaited<ReturnType<typeof loadCase4Portfolio>> = null;

self.onmessage = async (e: MessageEvent<'load' | 'send'>) => {
  if (e.data === 'send') {
    self.postMessage({ type: 'done', result });
    return;
  }
  try {
    result = await loadCase4Portfolio((p) => self.postMessage({ type: 'progress', progress: p }));
    self.postMessage({ type: 'ready', hasData: !!result?.entries.length });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
