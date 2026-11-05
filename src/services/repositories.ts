import type { AuditEvent, ControlTest, Dashboard, Dataset, EnergyObject, Id, LaunchInputs, LaunchSession } from '@/types';
import { getDb } from './db';

/** Репозитории — единственная точка доступа к хранилищу для остальных слоёв. */
export const objectRepository = {
  list: (): Promise<EnergyObject[]> => getDb().objects.toArray(),
  get: (id: Id) => getDb().objects.get(id),
  save: async (object: EnergyObject) => {
    await getDb().objects.put(object);
  },
};

export const sessionRepository = {
  get: (id: Id) => getDb().sessions.get(id),
  listByObject: (objectId: Id) => getDb().sessions.where('objectId').equals(objectId).reverse().sortBy('updatedAt'),
  save: async (session: LaunchSession) => {
    await getDb().sessions.put(session);
  },
};

export const datasetRepository = {
  listByObject: (objectId: Id) => getDb().datasets.where('objectId').equals(objectId).toArray(),
  save: async (dataset: Dataset) => {
    await getDb().datasets.put(dataset);
  },
};

export const auditRepository = {
  /** Журнал только дополняется: записи не изменяются и не удаляются. */
  append: async (events: readonly AuditEvent[]) => {
    if (events.length) await getDb().auditEvents.bulkAdd([...events]);
  },
  listBySession: (sessionId: Id) => getDb().auditEvents.where('sessionId').equals(sessionId).sortBy('timestamp'),
};

/** Сохранение полного набора входных данных (например, демо-сценария). */
export async function saveLaunchInputs(inputs: LaunchInputs): Promise<void> {
  const db = getDb();
  await db.transaction('rw', [db.objects, db.datasets, db.controlTests, db.dashboards], async () => {
    await db.objects.put(inputs.object);
    if (inputs.invoice) await db.datasets.put(inputs.invoice);
    if (inputs.telemetry) await db.datasets.put(inputs.telemetry);
    await db.controlTests.bulkPut(inputs.controlTests as ControlTest[]);
    await db.dashboards.bulkPut(inputs.dashboards as Dashboard[]);
  });
}

/** Сборка LaunchInputs объекта из хранилища (последние наборы данных каждого вида). */
export async function loadLaunchInputs(objectId: Id): Promise<LaunchInputs | null> {
  const db = getDb();
  const object = await db.objects.get(objectId);
  if (!object) return null;
  const datasets = await db.datasets.where('objectId').equals(objectId).sortBy('importedAt');
  const latest = <K extends Dataset['kind']>(kind: K) =>
    datasets.filter((d): d is Extract<Dataset, { kind: K }> => d.kind === kind).at(-1);
  const invoice = latest('INVOICE');
  const telemetry = latest('TELEMETRY');
  return {
    object,
    ...(invoice ? { invoice } : {}),
    ...(telemetry ? { telemetry } : {}),
    controlTests: await db.controlTests.where('objectId').equals(objectId).toArray(),
    dashboards: await db.dashboards.where('objectId').equals(objectId).toArray(),
  };
}
