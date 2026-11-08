import { STAGE_IDS, type StageId } from '@/types';

/** Порядок этапов – строго последовательный. */
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
