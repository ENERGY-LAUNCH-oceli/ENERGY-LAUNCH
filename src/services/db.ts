import Dexie, { type EntityTable } from 'dexie';
import { env } from '@/config/env';
import type { AuditEvent, ControlTest, Dashboard, Dataset, EnergyObject, LaunchSession } from '@/types';

/**
 * Локальное хранилище IndexedDB (Dexie).
 * Схема версионируется: при изменении индексов добавляется `this.version(N+1)`.
 */
export class EnergyLaunchDB extends Dexie {
  objects!: EntityTable<EnergyObject, 'id'>;
  sessions!: EntityTable<LaunchSession, 'id'>;
  datasets!: EntityTable<Dataset, 'id'>;
  controlTests!: EntityTable<ControlTest, 'id'>;
  dashboards!: EntityTable<Dashboard, 'id'>;
  auditEvents!: EntityTable<AuditEvent, 'id'>;

  constructor(name: string = env.dbName) {
    super(name);
    this.version(1).stores({
      objects: 'id, code, status',
      sessions: 'id, objectId, status, updatedAt',
      datasets: 'id, objectId, kind, importedAt',
      controlTests: 'id, objectId, assetId',
      dashboards: 'id, objectId',
      auditEvents: 'id, sessionId, objectId, action, timestamp',
    });
  }
}

let instance: EnergyLaunchDB | null = null;

export function getDb(): EnergyLaunchDB {
  instance ??= new EnergyLaunchDB();
  return instance;
}

/** Для тестов: подмена экземпляра БД. */
export function setDb(db: EnergyLaunchDB | null): void {
  instance = db;
}
