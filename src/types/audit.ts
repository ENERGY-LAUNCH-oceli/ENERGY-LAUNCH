import type { Id, IsoDateTime } from './common';
import type { StageId } from './launch';

export const AUDIT_ACTIONS = [
  'SESSION_CREATED',
  'SESSION_COMPLETED',
  'STAGE_STARTED',
  'STAGE_BLOCKED',
  'STAGE_UNBLOCKED',
  'STAGE_COMPLETED',
  'TRANSITION_REJECTED',
  'VALIDATION_RUN',
  'BLOCKER_OPENED',
  'BLOCKER_RESOLVED',
  'EVIDENCE_ADDED',
  'CONFIRMATION_ADDED',
  'DATASET_IMPORTED',
  'CONTROL_COMMAND',
  'DASHBOARD_UPDATED',
  'DASHBOARD_PUBLISHED',
  'DASHBOARD_ACCEPTANCE',
  'ACCESS_DENIED',
  'CONFIRMATIONS_STALE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Неизменяемая запись журнала аудита. */
export interface AuditEvent {
  id: Id;
  action: AuditAction;
  actor: string;
  timestamp: IsoDateTime;
  sessionId?: Id;
  objectId?: Id;
  stageId?: StageId;
  rulesetVersion?: string;
  payload?: Record<string, unknown>;
}
