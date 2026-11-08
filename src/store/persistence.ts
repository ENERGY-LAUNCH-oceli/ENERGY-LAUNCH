import type { StoredUserObject } from '@/data/objects';
import { auditRepository, broadcastStorage, createWorkspaceWriter, saveLaunchInputs, saveServerObject, serverApi, sessionRepository, type WorkspaceDoc } from '@/services';
import type { AuditEvent, LaunchInputs, LaunchSession } from '@/types';
import { notify } from './notifications-store';

/**
 * Куда хранилище запуска сохраняет изменения. Хранилище зависит только от этого контракта;
 * реализация выбирается при старте (сервер PostgreSQL или браузер) и подменяется в тестах и песочницах сценариев.
 */
export interface LaunchPersistence {
  saveInputs(inputs: LaunchInputs): Promise<void>;
  saveSession(session: LaunchSession): Promise<void>;
  appendAudit(events: readonly AuditEvent[]): Promise<void>;
  /** Хранение на сервере (PostgreSQL): состояние объекта целиком, объекты пользователя, сброс. */
  saveWorkspace?(objectId: string, doc: WorkspaceDoc): void;
  saveUserObject?(o: StoredUserObject): Promise<void>;
  deleteUserObject?(id: string): Promise<void>;
  resetWorkspaces?(): Promise<void>;
  /** Дописать ожидающие изменения. */
  flush?(): Promise<void>;
}

/** Браузер (IndexedDB): копия входов, сессии и журнала. */
export const dexiePersistence: LaunchPersistence = {
  saveInputs: saveLaunchInputs,
  saveSession: sessionRepository.save,
  appendAudit: auditRepository.append,
};

/** Очередь записи документов объектов на сервер (ревизии, конфликты, повтор после ошибки). Общая для сохранения и синхронизации. */
export const workspaceWriter = createWorkspaceWriter();
workspaceWriter.onError((message) => notify({ tone: 'error', title: 'Не удалось сохранить в PostgreSQL', description: `${message}. Изменения будут отправлены со следующим действием.` }));

/** PostgreSQL через API сервера: каждое изменение объекта уходит документом (входы, сессия, журнал). */
export const serverPersistence: LaunchPersistence = {
  saveInputs: async () => {},
  saveSession: async () => {},
  appendAudit: async () => {},
  saveWorkspace: (objectId, doc) => workspaceWriter.schedule(objectId, doc),
  saveUserObject: saveServerObject,
  deleteUserObject: async (id) => {
    await workspaceWriter.cancel(id);
    await serverApi.deleteObject(id);
  },
  resetWorkspaces: async () => {
    await workspaceWriter.cancel();
    await serverApi.resetWorkspaces();
    workspaceWriter.clearRevisions();
    broadcastStorage({ type: 'reset' });
  },
  flush: () => workspaceWriter.flushAll(),
};

/** Ничего не сохраняет: тесты и песочницы сценариев. */
export const noopPersistence: LaunchPersistence = {
  saveInputs: async () => {},
  saveSession: async () => {},
  appendAudit: async () => {},
};

/** Ошибка фонового сохранения: в консоль, работа продолжается (состояние остаётся в памяти). */
export const reportPersistError = (e: unknown) => console.error('[launch-store] persist failed', e);

/** Ошибка операции с сервером, о которой нужно сказать пользователю. */
export const persistFailed = (what: string, e: unknown) => {
  console.error(`[storage] ${what}`, e);
  notify({ tone: 'error', title: 'Хранилище PostgreSQL', description: `${what}: ${e instanceof Error ? e.message : String(e)}` });
};
