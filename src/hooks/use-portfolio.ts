import { useMemo } from 'react';
import { OBJECT_CATALOG } from '@/data/objects';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type LaunchSession, type StageStatus } from '@/types';

/** Сводный статус запуска: заблокирован, если заблокирован любой этап; иначе статус текущего этапа. */
export function sessionStatus(session: LaunchSession | undefined): StageStatus {
  if (!session) return 'NOT_STARTED';
  if (session.status === 'COMPLETED') return 'COMPLETED';
  const statuses = STAGE_IDS.map((id) => session.stages[id].status);
  if (statuses.includes('BLOCKED')) return 'BLOCKED';
  if (statuses.some((s) => s !== 'NOT_STARTED')) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

/** Сессии всех объектов портфеля: текущая + сохранённые. */
export function usePortfolioSessions(): Record<string, LaunchSession | undefined> {
  const currentId = useLaunchStore((s) => s.currentObjectId);
  const session = useLaunchStore((s) => s.session);
  const workspaces = useLaunchStore((s) => s.workspaces);
  return useMemo(() => {
    const out: Record<string, LaunchSession | undefined> = {};
    for (const o of OBJECT_CATALOG) out[o.id] = o.id === currentId ? (session ?? undefined) : workspaces[o.id]?.session;
    return out;
  }, [currentId, session, workspaces]);
}

export function useObjectStatuses(): Record<string, StageStatus> {
  const sessions = usePortfolioSessions();
  return useMemo(() => Object.fromEntries(Object.entries(sessions).map(([id, s]) => [id, sessionStatus(s)])), [sessions]);
}

/** Время последней проверки по всем этапам сессии. */
export function lastCheckAt(session: LaunchSession | null | undefined): string | undefined {
  if (!session) return undefined;
  return STAGE_IDS.map((id) => session.stages[id].lastValidatedAt).filter((x): x is string => !!x).sort().at(-1);
}
