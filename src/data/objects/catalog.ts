import { loadScenario } from '@/data/scenarios';
import { withCheckDigit } from '@/engine/invoice/format';
import type { LaunchInputs, StageId } from '@/types';

/**
 * Демонстрационный портфель: шесть синтетических объектов в разных состояниях запуска
 * (требование кейса). Названия, адреса и люди вымышлены.
 */
export interface ObjectCatalogEntry {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  kind: string;
  assets: string;
  assetCount: number;
  responsible: string;
  /** Синтетические 18-значные коды EAN точки подключения. */
  ean: { offtake: string; injection: string };
  scenarioId: string;
  /** До какого этапа демо-сессия проходится автоматически (включительно). */
  seedUntil: StageId;
  /** Фиксированная точка времени демо-проверок — данные воспроизводимы. */
  seedAt: string;
}

export const OBJECT_CATALOG: ObjectCatalogEntry[] = [
  { id: 'obj-001', ean: { offtake: withCheckDigit('54144880000000101'), injection: withCheckDigit('54144880000000102') }, code: 'OBJ-001', name: 'Кампус «Северный»', city: 'Брюссель', address: 'Rue Synthétique 12, 1000 Брюссель', kind: 'Офисный кампус', assets: 'PV · BESS', assetCount: 3, responsible: 'А. Верхаген', scenarioId: 'happy-path', seedUntil: 'FINAL_DASHBOARDS', seedAt: '2026-11-05T07:40:00.000Z' },
  { id: 'obj-002', ean: { offtake: withCheckDigit('54144880000000201'), injection: withCheckDigit('54144880000000202') }, code: 'OBJ-002', name: 'Логистический центр «Порт-7»', city: 'Антверпен', address: 'Havenweg 7, 2030 Антверпен', kind: 'Склад', assets: 'PV', assetCount: 2, responsible: 'М. Янссенс', scenarioId: 'short-history', seedUntil: 'METER_HISTORY', seedAt: '2026-11-05T08:05:00.000Z' },
  { id: 'obj-003', ean: { offtake: withCheckDigit('54144880000000301'), injection: withCheckDigit('54144880000000302') }, code: 'OBJ-003', name: 'Школа «Ливадия»', city: 'Гент', address: 'Schoolstraat 31, 9000 Гент', kind: 'Образовательное здание', assets: 'PV', assetCount: 2, responsible: 'Л. Петерс', scenarioId: 'meter-gaps', seedUntil: 'METER_HISTORY', seedAt: '2026-11-05T08:20:00.000Z' },
  { id: 'obj-004', ean: { offtake: withCheckDigit('54144880000000401'), injection: withCheckDigit('54144880000000402') }, code: 'OBJ-004', name: 'Медцентр «Ривьера»', city: 'Льеж', address: 'Quai Fictif 4, 4000 Льеж', kind: 'Медицинский центр', assets: 'PV · BESS', assetCount: 3, responsible: 'А. Верхаген', scenarioId: 'missing-signal', seedUntil: 'REALTIME_TELEMETRY', seedAt: '2026-11-05T08:45:00.000Z' },
  { id: 'obj-005', ean: { offtake: withCheckDigit('54144880000000501'), injection: withCheckDigit('54144880000000502') }, code: 'OBJ-005', name: 'Бизнес-парк «Меридиан»', city: 'Лёвен', address: 'Parklaan 55, 3000 Лёвен', kind: 'Бизнес-парк', assets: 'PV · BESS', assetCount: 3, responsible: 'С. Дюбуа', scenarioId: 'wrong-binding', seedUntil: 'REALTIME_TELEMETRY', seedAt: '2026-11-05T09:10:00.000Z' },
  { id: 'obj-006', ean: { offtake: withCheckDigit('54144880000000601'), injection: withCheckDigit('54144880000000602') }, code: 'OBJ-006', name: 'Технопарк «Квант»', city: 'Брюгге', address: 'Kanaalstraat 9, 8000 Брюгге', kind: 'Производственное здание', assets: 'BESS', assetCount: 3, responsible: 'М. Янссенс', scenarioId: 'control-timeout', seedUntil: 'ASSET_CONTROL', seedAt: '2026-11-05T09:30:00.000Z' },
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
      passport: { ...inputs.object.passport, objectId: entry.id, timezone: 'Europe/Brussels', location: { region: entry.city, address: entry.address } },
      gridConnection: { ...inputs.object.gridConnection, objectId: entry.id, eanOfftake: entry.ean.offtake, eanInjection: entry.ean.injection },
    },
    ...(inputs.invoice ? { invoice: { ...inputs.invoice, objectId: entry.id, id: `invoice-${entry.id}-v1` } } : {}),
  };
}
