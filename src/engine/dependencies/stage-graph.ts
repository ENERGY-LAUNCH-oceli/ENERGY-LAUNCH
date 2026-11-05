import { STAGE_IDS, type LaunchInputs, type StageId } from '@/types';

/** Порядок этапов — строго последовательный. */
export const STAGE_ORDER: readonly StageId[] = STAGE_IDS;

export function stageIndex(stageId: StageId): number {
  return STAGE_ORDER.indexOf(stageId);
}

/** Непосредственно предшествующий этап (или `null` для первого). */
export function getPreviousStage(stageId: StageId): StageId | null {
  const i = stageIndex(stageId);
  return i > 0 ? (STAGE_ORDER[i - 1] ?? null) : null;
}

export function getNextStage(stageId: StageId): StageId | null {
  const i = stageIndex(stageId);
  return STAGE_ORDER[i + 1] ?? null;
}

/** Все этапы, которые должны быть завершены до данного. */
export function getPrerequisites(stageId: StageId): StageId[] {
  return STAGE_ORDER.slice(0, stageIndex(stageId));
}

/** Какие входные данные нужны этапу (для подсказок UI и проверки готовности). */
export const STAGE_DATA_DEPENDENCIES: Record<StageId, ReadonlyArray<keyof LaunchInputs>> = {
  METER_HISTORY: ['object', 'invoice'],
  REALTIME_TELEMETRY: ['object', 'telemetry'],
  ASSET_CONTROL: ['object', 'controlTests'],
  FINAL_DASHBOARDS: ['object', 'dashboards'],
};

/** Список отсутствующих входных данных этапа. */
export function getMissingInputs(stageId: StageId, inputs: Partial<LaunchInputs>): Array<keyof LaunchInputs> {
  return STAGE_DATA_DEPENDENCIES[stageId].filter((key) => {
    const value = inputs[key];
    return value === undefined || (Array.isArray(value) && value.length === 0);
  });
}
