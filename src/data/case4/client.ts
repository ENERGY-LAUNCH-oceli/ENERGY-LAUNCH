import { loadCase4Portfolio, type Case4Progress } from './loader';

type Result = Awaited<ReturnType<typeof loadCase4Portfolio>>;

export interface Case4Job {
  /** Набор разобран и проверен (true – есть данные). */
  ready: Promise<boolean>;
  /** Забрать результат (передача в основной поток – по запросу, в удобный момент). */
  take(): Promise<Result>;
}

/** Набор кейса 4 через Web Worker; без поддержки воркеров – в основном потоке. */
export function startCase4Job(onProgress?: (p: Case4Progress) => void): Case4Job {
  const inMain = (): Case4Job => {
    const p = loadCase4Portfolio(onProgress);
    return { ready: p.then((r) => !!r?.entries.length), take: () => p };
  };
  if (typeof Worker === 'undefined') return inMain();
  let worker: Worker;
  try {
    worker = new Worker(new URL('./case4.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return inMain();
  }
  let fallback: Case4Job | null = null;
  let resolveReady!: (v: boolean) => void;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<boolean>((res, rej) => ((resolveReady = res), (rejectReady = rej)));
  let resolveTake: ((r: Result) => void) | null = null;
  worker.onmessage = (e: MessageEvent<{ type: string; progress?: Case4Progress; result?: Result; hasData?: boolean; message?: string }>) => {
    const m = e.data;
    if (m.type === 'progress' && m.progress) onProgress?.(m.progress);
    if (m.type === 'ready') resolveReady(!!m.hasData);
    if (m.type === 'done') {
      worker.terminate();
      resolveTake?.(m.result ?? null);
    }
    if (m.type === 'error') {
      worker.terminate();
      rejectReady(new Error(m.message));
    }
  };
  worker.onerror = (e) => {
    worker.terminate();
    console.warn('[case4] воркер недоступен, загрузка в основном потоке', e.message);
    fallback = inMain();
    fallback.ready.then(resolveReady, rejectReady);
  };
  worker.postMessage('load');
  return {
    ready,
    take: () => {
      if (fallback) return fallback.take();
      return new Promise<Result>((res) => {
        resolveTake = res;
        worker.postMessage('send');
      });
    },
  };
}
