import { loadScenario } from '@/data/scenarios';
import type { LaunchInputs } from '@/types';

/**
 * Демонстрационный портфель: шесть объектов, как в наборе кейса (Building1 … Building6).
 * Каждый объект получает входные данные своего сценария; реквизиты условные.
 */
export interface ObjectCatalogEntry {
  id: string;
  code: string;
  name: string;
  city: string;
  assets: string;
  scenarioId: string;
}

export const OBJECT_CATALOG: ObjectCatalogEntry[] = [
  { id: 'building-1', code: 'B1', name: 'Building1', city: 'Брюссель', assets: 'PV · BESS', scenarioId: 'happy-path' },
  { id: 'building-2', code: 'B2', name: 'Building2', city: 'Гент', assets: 'PV', scenarioId: 'meter-gaps' },
  { id: 'building-3', code: 'B3', name: 'Building3', city: 'Антверпен', assets: 'PV · BESS', scenarioId: 'invoice-mismatch' },
  { id: 'building-4', code: 'B4', name: 'Building4', city: 'Льеж', assets: 'PV · BESS', scenarioId: 'missing-signal' },
  { id: 'building-5', code: 'B5', name: 'Building5', city: 'Брюгге', assets: 'BESS', scenarioId: 'control-timeout' },
  { id: 'building-6', code: 'B6', name: 'Building6', city: 'Лёвен', assets: 'PV · BESS', scenarioId: 'dashboard-unpublished' },
];

export const DEFAULT_OBJECT_ID = OBJECT_CATALOG[0]!.id;

export const findObject = (id: string | undefined) => OBJECT_CATALOG.find((o) => o.id === id);

/** Входные данные объекта: сценарий с подставленными реквизитами объекта. */
export function loadObjectInputs(entry: ObjectCatalogEntry): LaunchInputs {
  const { inputs } = loadScenario(entry.scenarioId);
  return {
    ...inputs,
    object: {
      ...inputs.object,
      id: entry.id,
      code: entry.code,
      name: entry.name,
      passport: { ...inputs.object.passport, objectId: entry.id, timezone: 'Europe/Brussels', location: { region: entry.city } },
    },
  };
}
