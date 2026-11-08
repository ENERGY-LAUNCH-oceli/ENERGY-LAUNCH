import { env } from '@/config/env';
import { OBJECT_CATALOG, findObject, seedWorkspace } from '@/data/objects';
import { detectServer, loadServerState, onStorageSignal, serverApi, useStorageStatus, type SavedWorkspace, type ServerState } from '@/services';
import type { AuditEvent, LaunchInputs, LaunchSession, RulesConfig } from '@/types';
import { notify } from './notifications-store';
import { persistFailed, serverPersistence, workspaceWriter, type LaunchPersistence } from './persistence';

/** Состояние запуска одного объекта. */
export interface ObjectWorkspace {
  scenarioId: string | null;
  inputs: LaunchInputs;
  session: LaunchSession;
  auditLog: AuditEvent[];
}

/** Часть состояния хранилища, которую читает и меняет синхронизация (только она – ничего лишнего). */
export interface SyncedState {
  ruleset: RulesConfig;
  currentObjectId: string | null;
  workspaces: Record<string, ObjectWorkspace>;
  persistence: LaunchPersistence;
  scenarioId: string | null;
  inputs: LaunchInputs | null;
  session: LaunchSession | null;
  auditLog: AuditEvent[];
}

/** Изменение среза: применённое с сервера состояние сбрасывает ошибку последнего перехода. */
export type SyncPatch = Partial<SyncedState> & { lastError?: null };

/** Опрос ревизий: изменения из других вкладок и от других пользователей видны без перезагрузки. */
const SYNC_INTERVAL_MS = 15_000;

/** Сохранённое состояние пригодно, если оно того же объекта и той же версии правил (иначе объект начинается заново). */
const usable = (saved: SavedWorkspace | null, objectId: string, ruleset: RulesConfig): saved is SavedWorkspace & { session: LaunchSession } =>
  !!saved && saved.session?.objectId === objectId && saved.session.rulesetVersion === ruleset.version;

const toWorkspace = (w: SavedWorkspace): ObjectWorkspace => ({ scenarioId: w.scenarioId, inputs: w.inputs, session: w.session, auditLog: w.auditLog });

export interface RemoteSync {
  /** Сервер хранилища запущен – переключить сохранение на PostgreSQL и загрузить сохранённое; нет – null (хранение в браузере). */
  connect(): Promise<ServerState | null>;
  /** Сохранённые состояния объектов поверх исходного портфеля. */
  applySaved(saved: readonly SavedWorkspace[]): void;
  /** Следить за изменениями на сервере (сигналы вкладок, фокус, опрос, конфликты записи). Повторный вызов ничего не делает. */
  watch(): void;
  /** Сейчас применяется состояние с сервера – его не нужно сохранять обратно. */
  isApplyingRemote(): boolean;
}

/**
 * Синхронизация портфеля с сервером хранилища. Отделена от действий запуска: хранилище только вызывает
 * connect / applySaved / watch, а синхронизация работает с узким срезом состояния `SyncedState`.
 */
export function createRemoteSync(get: () => SyncedState, set: (patch: SyncPatch) => void): RemoteSync {
  let applyingRemote = false;
  let syncing: Promise<void> | null = null;
  let watching = false;

  const connect = async (): Promise<ServerState | null> => {
    if (env.storage === 'browser') return null;
    const kind = await detectServer();
    if (!kind) {
      if (env.storage === 'server') notify({ tone: 'error', title: 'Сервер хранилища недоступен', description: 'Запустите npm run api. Пока изменения хранятся только до перезагрузки страницы.' });
      return null;
    }
    try {
      const state = await loadServerState();
      set({ persistence: serverPersistence });
      useStorageStatus.setState({ mode: 'server', kind, status: 'idle', error: null });
      // Перезагрузка страницы, пока изменения ещё отправляются, – браузер переспросит
      window.addEventListener('beforeunload', (e) => {
        if (workspaceWriter.busy()) e.preventDefault();
      });
      return state;
    } catch (e) {
      persistFailed('сохранённое состояние не загружено', e);
      return null;
    }
  };

  const applySaved = (saved: readonly SavedWorkspace[]) => {
    const s = get();
    const workspaces = { ...s.workspaces };
    let current: ObjectWorkspace | null = null;
    for (const w of saved) {
      workspaceWriter.setRevision(w.objectId, w.revision);
      const entry = findObject(w.objectId);
      if (!entry || entry.source === 'SCENARIO' || !usable(w, w.objectId, s.ruleset)) continue;
      if (w.objectId === s.currentObjectId) current = toWorkspace(w);
      else workspaces[w.objectId] = toWorkspace(w);
    }
    set({ workspaces, ...(current ?? {}) });
  };

  /** Заменить состояние объекта сохранённым на сервере (null – на сервере его нет: исходное состояние). */
  const applyRemote = (objectId: string, saved: SavedWorkspace | null): boolean => {
    const s = get();
    const entry = findObject(objectId);
    if (!entry || entry.source === 'SCENARIO') return false;
    workspaceWriter.setRevision(objectId, saved?.revision ?? 0);
    const ws = usable(saved, objectId, s.ruleset) ? toWorkspace(saved) : seedWorkspace(entry, s.ruleset);
    applyingRemote = true;
    try {
      if (objectId === s.currentObjectId) set({ ...ws, lastError: null });
      else set({ workspaces: { ...s.workspaces, [objectId]: ws } });
    } finally {
      applyingRemote = false;
    }
    return true;
  };

  /**
   * Подтянуть изменения, сделанные в другой вкладке или другим пользователем: сравниваются ревизии,
   * загружаются только изменённые объекты. Объект с неотправленными изменениями этой вкладки не трогается –
   * если они построены на устаревшем состоянии, сервер их отклонит (409) и объект обновится через конфликт.
   */
  const syncFromServer = (force: readonly string[] = []): Promise<void> => {
    if (syncing) return syncing.then(() => (force.length ? syncFromServer(force) : undefined));
    syncing = (async () => {
      const revs = await serverApi.revisions();
      const ids = new Set([...Object.keys(revs), ...OBJECT_CATALOG.map((e) => e.id), ...force]);
      let currentChanged = false;
      for (const id of ids) {
        const forced = force.includes(id);
        const known = workspaceWriter.revision(id);
        if (workspaceWriter.busyFor(id) || (!forced && (revs[id] ?? 0) === known)) continue;
        const saved = revs[id] ? await serverApi.workspace(id) : null;
        // Пока загружалось, вкладка могла изменить объект или сохранить его сама – её состояние новее
        if (workspaceWriter.busyFor(id) || workspaceWriter.revision(id) !== known) continue;
        if (applyRemote(id, saved) && id === get().currentObjectId && !forced) currentChanged = true;
      }
      if (currentChanged) notify({ tone: 'info', title: 'Состояние объекта обновлено', description: 'Объект изменили в другой вкладке или другим пользователем – показано актуальное состояние' });
    })()
      .catch((e: unknown) => console.error('[storage] синхронизация не выполнена', e))
      .finally(() => {
        syncing = null;
      });
    return syncing;
  };

  const watch = () => {
    if (watching || typeof window === 'undefined') return;
    watching = true;
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    onStorageSignal(() => void syncFromServer());
    document.addEventListener('visibilitychange', () => visible() && void syncFromServer());
    window.addEventListener('focus', () => void syncFromServer());
    setInterval(() => visible() && void syncFromServer(), SYNC_INTERVAL_MS);
    workspaceWriter.onConflict((objectId) => {
      const name = findObject(objectId)?.name ?? objectId;
      notify({ tone: 'warning', title: 'Изменение не сохранено', description: `Объект «${name}» уже изменили в другой вкладке или другим пользователем. Показано актуальное состояние – повторите действие, если оно ещё нужно.` });
      // После того как отклонённая запись снимется с очереди
      setTimeout(() => void syncFromServer([objectId]), 0);
    });
  };

  return { connect, applySaved, watch, isApplyingRemote: () => applyingRemote };
}
