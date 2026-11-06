import { useMemo } from 'react';
import { getNextAction, objectReadiness, openBlockers, type NextAction } from '@/engine';
import { OBJECT_CATALOG, type ObjectCatalogEntry } from '@/data/objects';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type Blocker, type LaunchSession, type StageStatus } from '@/types';
import { lastCheckAt, sessionStatus, usePortfolioSessions } from './use-portfolio';

export interface PortfolioRow {
  entry: ObjectCatalogEntry;
  session: LaunchSession | undefined;
  status: StageStatus;
  /** Готовность, %: доля завершённых этапов; 100 только при готовности объекта (этапы + приёмка). */
  progress: number;
  ready: boolean;
  blockers: Blocker[];
  nextAction: NextAction | null;
  lastCheck: string | undefined;
  awaitingCheck: boolean;
}

export function usePortfolioRows(): PortfolioRow[] {
  const sessions = usePortfolioSessions();
  const ruleset = useLaunchStore((s) => s.ruleset);
  const currentId = useLaunchStore((s) => s.currentObjectId);
  const inputs = useLaunchStore((s) => s.inputs);
  const workspaces = useLaunchStore((s) => s.workspaces);
  return useMemo(
    () =>
      OBJECT_CATALOG.map((entry) => {
        const session = sessions[entry.id];
        const completed = session ? STAGE_IDS.filter((id) => session.stages[id].status === 'COMPLETED').length : 0;
        const objInputs = entry.id === currentId ? inputs : workspaces[entry.id]?.inputs;
        const ready = objectReadiness(session, objInputs, ruleset).ready;
        const progress = ready ? 100 : Math.min(75, completed * 25);
        const blockers = session ? STAGE_IDS.flatMap((id) => openBlockers(session, id)) : [];
        const nextAction = session ? getNextAction(session, session.currentStageId, ruleset) : null;
        const status = sessionStatus(session);
        return {
          entry,
          session,
          status,
          progress,
          ready,
          blockers,
          nextAction,
          lastCheck: lastCheckAt(session),
          awaitingCheck: status !== 'BLOCKED' && !!nextAction && ['START', 'RUN_CHECKS', 'CONFIRM', 'COMPLETE'].includes(nextAction.kind),
        };
      }),
    [sessions, ruleset, currentId, inputs, workspaces],
  );
}
