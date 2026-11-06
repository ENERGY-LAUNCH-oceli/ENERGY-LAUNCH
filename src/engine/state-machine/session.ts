import { STAGE_IDS, type LaunchSession, type LaunchStage, type StageId } from '@/types';
import type { EngineContext } from '../context';

/** Создаёт новую сессию запуска: все этапы NOT_STARTED, текущий – первый. */
export function createLaunchSession(objectId: string, rulesetVersion: string, ctx: EngineContext): LaunchSession {
  const now = ctx.now();
  const stages = Object.fromEntries(
    STAGE_IDS.map((id, i): [StageId, LaunchStage] => [
      id,
      { id, order: i + 1, status: 'NOT_STARTED', validationResults: [], confirmations: [] },
    ]),
  ) as Record<StageId, LaunchStage>;

  return {
    id: ctx.newId(),
    objectId,
    rulesetVersion,
    status: 'ACTIVE',
    currentStageId: STAGE_IDS[0],
    stages,
    blockers: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}
