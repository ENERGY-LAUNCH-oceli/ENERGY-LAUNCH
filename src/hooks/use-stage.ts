import { useMemo } from 'react';
import { getPrerequisites, getUnmetConfirmations, openBlockers } from '@/engine';
import { useLaunchStore } from '@/store';
import type { StageId } from '@/types';

/** Производные данные этапа для UI. Вычисления — функциями движка, не в компонентах. */
export function useStage(stageId: StageId) {
  const session = useLaunchStore((s) => s.session);
  const ruleset = useLaunchStore((s) => s.ruleset);

  return useMemo(() => {
    if (!session) return null;
    const stage = session.stages[stageId];
    const prerequisitesMet = getPrerequisites(stageId).every((id) => session.stages[id].status === 'COMPLETED');
    return {
      stage,
      prerequisitesMet,
      blockers: openBlockers(session, stageId),
      unmetConfirmations: getUnmetConfirmations(session, stageId, ruleset),
      isCurrent: session.currentStageId === stageId,
    };
  }, [session, ruleset, stageId]);
}
