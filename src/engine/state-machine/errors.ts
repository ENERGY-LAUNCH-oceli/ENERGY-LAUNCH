import type { StageId, StageStatus } from '@/types';

export const TRANSITION_ERROR_CODES = [
  'SESSION_NOT_ACTIVE',
  'INVALID_TRANSITION',
  'PREVIOUS_STAGE_NOT_COMPLETED',
  'VALIDATION_NOT_RUN',
  'VALIDATION_FAILED',
  'OPEN_BLOCKERS',
  'MISSING_CONFIRMATIONS',
  'RULESET_MISMATCH',
  'NOT_FOUND',
] as const;
export type TransitionErrorCode = (typeof TRANSITION_ERROR_CODES)[number];

export interface TransitionError {
  code: TransitionErrorCode;
  stageId?: StageId;
  message: string;
  from?: StageStatus;
  to?: StageStatus;
  details?: Record<string, unknown>;
}
