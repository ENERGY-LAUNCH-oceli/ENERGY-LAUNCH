import type { StageStatus } from '@/types';

/**
 * Допустимые переходы статуса этапа.
 *
 *   NOT_STARTED ──START──▶ IN_PROGRESS ──COMPLETE──▶ COMPLETED
 *                             ▲    │
 *                     UNBLOCK │    │ BLOCK
 *                             │    ▼
 *                            BLOCKED
 *
 * COMPLETED — терминальный статус.
 */
export const STAGE_TRANSITIONS: Readonly<Record<StageStatus, readonly StageStatus[]>> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['BLOCKED', 'COMPLETED'],
  BLOCKED: ['IN_PROGRESS'],
  COMPLETED: [],
};

export function canTransition(from: StageStatus, to: StageStatus): boolean {
  return STAGE_TRANSITIONS[from].includes(to);
}
