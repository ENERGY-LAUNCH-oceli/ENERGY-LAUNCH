import { create } from 'zustand';
import { env } from '@/config/env';
import { loadStoredObjects, replaceStoredObjects, type StoredUserObject } from '@/data/objects';
import type { AuditEvent, LaunchInputs, LaunchSession } from '@/types';

/**
 * Хранение в PostgreSQL через API сервера (server/). Состояние объекта – один документ:
 * входные данные, сессия автомата и журнал; журнал на сервере только дополняется.
 * Решения о запуске принимает движок в приложении – сервер их не пересчитывает.
 */

export interface WorkspaceDoc {
  scenarioId: string | null;
  inputs: LaunchInputs;
  session: LaunchSession;
  auditLog: AuditEvent[];
}

export interface SavedWorkspace extends WorkspaceDoc {
  objectId: string;
  revision: number;
  updatedAt: string;
}

export interface ServerState {
  objects: StoredUserObject[];
  workspaces: SavedWorkspace[];
}

export type StorageKind = 'postgres' | 'pglite';

/** Состояние хранилища для интерфейса (индикатор «сохранено»). */
export interface StorageStatus {
  mode: 'browser' | 'server';
  kind: StorageKind | null;
  status: 'idle' | 'saving' | 'saved' | 'error';
  savedAt: string | null;
  error: string | null;
}

export const useStorageStatus = create<StorageStatus>()(() => ({ mode: 'browser', kind: null, status: 'idle', savedAt: null, error: null }));

let apiBase = env.apiUrl;
/** Для тестов: адрес сервера. */
export const setApiBase = (url: string) => {
  apiBase = url.replace(/\/+$/, '');
};

/** Запрос к API сервера (JSON); ошибка – Error с текстом ответа сервера. */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(apiBase + path, { ...init, headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try {
      message = ((await r.json()) as { error?: string }).error ?? message;
    } catch {
      /* ответ без JSON */
    }
    throw new Error(message);
  }
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** Сервер доступен? Короткий таймаут: без сервера приложение не ждёт и работает в браузере. */
export async function detectServer(timeoutMs = 1500): Promise<StorageKind | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${apiBase}/health`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/json')) return null;
    const body = (await r.json()) as { ok?: boolean; storage?: StorageKind };
    return body.ok && (body.storage === 'postgres' || body.storage === 'pglite') ? body.storage : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const MIGRATED_KEY = 'el.objects.server-synced';

/**
 * Загрузка сохранённого состояния. При первом подключении объекты, созданные раньше только в браузере,
 * переносятся на сервер; дальше источник истины – сервер, а localStorage – его копия для синхронного старта.
 */
export async function loadServerState(): Promise<ServerState> {
  const state = await apiRequest<ServerState>('/state');
  let objects = state.objects;
  let migrated = false;
  try {
    migrated = localStorage.getItem(MIGRATED_KEY) === '1';
  } catch {
    /* хранилище браузера недоступно */
  }
  if (!migrated) {
    const local = loadStoredObjects().filter((o) => !objects.some((s) => s.id === o.id));
    for (const o of local) await saveServerObject(o);
    objects = [...objects, ...local];
    try {
      localStorage.setItem(MIGRATED_KEY, '1');
    } catch {
      /* без отметки перенос повторится – он идемпотентен */
    }
  }
  replaceStoredObjects(objects);
  return { ...state, objects };
}

export const saveServerObject = (o: StoredUserObject) => apiRequest<void>(`/objects/${encodeURIComponent(o.id)}`, { method: 'PUT', body: JSON.stringify(o) });

/**
 * Очередь записи состояний: изменения объекта собираются за короткую паузу и уходят одним запросом;
 * для одного объекта запросы идут строго по очереди, поэтому старое состояние не перезапишет новое.
 */
export function createWorkspaceWriter(delayMs = 350) {
  const pending = new Map<string, WorkspaceDoc>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const running = new Map<string, Promise<void>>();
  let failedNotified = false;
  const status = (patch: Partial<StorageStatus>) => useStorageStatus.setState(patch);

  const busy = () => pending.size > 0 || running.size > 0;

  async function flush(objectId: string): Promise<void> {
    timers.delete(objectId);
    while (running.has(objectId)) await running.get(objectId);
    const doc = pending.get(objectId);
    if (!doc) return;
    pending.delete(objectId);
    let savedAt: string | null = null;
    const job = apiRequest<{ revision: number; updatedAt: string }>(`/workspaces/${encodeURIComponent(objectId)}`, { method: 'PUT', body: JSON.stringify(doc) })
      .then((r) => {
        failedNotified = false;
        savedAt = r.updatedAt;
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[storage] состояние не сохранено', objectId, message);
        status({ status: 'error', error: message });
        if (!failedNotified) {
          failedNotified = true;
          onError?.(message);
        }
      });
    running.set(objectId, job);
    await job;
    running.delete(objectId);
    if (savedAt && !busy()) status({ status: 'saved', savedAt, error: null });
    if (pending.has(objectId) && !timers.has(objectId)) await flush(objectId);
  }

  let onError: ((message: string) => void) | undefined;

  return {
    onError(fn: (message: string) => void) {
      onError = fn;
    },
    schedule(objectId: string, doc: WorkspaceDoc) {
      pending.set(objectId, doc);
      clearTimeout(timers.get(objectId));
      timers.set(objectId, setTimeout(() => void flush(objectId), delayMs));
      status({ status: 'saving' });
    },
    /** Отменить ожидающую запись (объект удалён или портфель сбрасывается). */
    async cancel(objectId?: string) {
      for (const id of objectId ? [objectId] : [...pending.keys(), ...timers.keys()]) {
        clearTimeout(timers.get(id));
        timers.delete(id);
        pending.delete(id);
      }
      await Promise.all(objectId ? [running.get(objectId)] : [...running.values()]);
    },
    /** Дописать всё ожидающее сейчас (тесты, уход со страницы). */
    async flushAll() {
      await Promise.all([...new Set([...pending.keys(), ...timers.keys()])].map((id) => flush(id)));
      await Promise.all([...running.values()]);
    },
    busy,
  };
}

export const serverApi = {
  deleteObject: (id: string) => apiRequest<void>(`/objects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  resetWorkspaces: () => apiRequest<void>('/workspaces', { method: 'DELETE' }),
  audit: (q: { objectId?: string; sessionId?: string; limit?: number } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiRequest<{ events: AuditEvent[] }>(`/audit${p.size ? `?${p}` : ''}`);
  },
};
