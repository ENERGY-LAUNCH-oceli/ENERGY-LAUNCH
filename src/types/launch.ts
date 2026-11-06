import type { ConfirmationRole, Id, IsoDateTime, Severity } from './common';
import type { RuleId, ValidationResult } from './validation';

/** Четыре последовательных этапа запуска. Порядок массива – порядок этапов. */
export const STAGE_IDS = [
  'METER_HISTORY',
  'REALTIME_TELEMETRY',
  'ASSET_CONTROL',
  'FINAL_DASHBOARDS',
] as const;
export type StageId = (typeof STAGE_IDS)[number];

export const STAGE_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** Подтверждение ответственного лица по обязательному требованию этапа. */
export interface StageConfirmation {
  id: Id;
  stageId: StageId;
  /** Ссылка на ConfirmationRequirement.id из конфигурации правил. */
  requirementId: string;
  confirmedBy: string;
  role: ConfirmationRole;
  confirmedAt: IsoDateTime;
  evidenceIds: Id[];
  comment?: string;
  /** Подтверждение устарело: после него изменились проверенные входы (до повторного подтверждения). */
  staleSince?: IsoDateTime;
  staleReason?: string;
}

export interface LaunchStage {
  id: StageId;
  /** Порядковый номер 1..4. */
  order: number;
  status: StageStatus;
  startedAt?: IsoDateTime;
  blockedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  /** Результаты последнего прогона проверок. */
  validationResults: ValidationResult[];
  lastValidatedAt?: IsoDateTime;
  confirmations: StageConfirmation[];
}

export const BLOCKER_STATUSES = ['OPEN', 'RESOLVED', 'WAIVED'] as const;
export type BlockerStatus = (typeof BLOCKER_STATUSES)[number];

export const BLOCKER_SOURCES = ['VALIDATION', 'MANUAL'] as const;
export type BlockerSource = (typeof BLOCKER_SOURCES)[number];

/** Препятствие, не позволяющее завершить этап. */
export interface Blocker {
  id: Id;
  sessionId: Id;
  stageId: StageId;
  title: string;
  description: string;
  severity: Severity;
  status: BlockerStatus;
  source: BlockerSource;
  ruleId?: RuleId;
  createdAt: IsoDateTime;
  createdBy: string;
  resolvedAt?: IsoDateTime;
  resolvedBy?: string;
  resolution?: string;
}

export const EVIDENCE_TYPES = [
  'FILE',
  'VALIDATION_REPORT',
  'SIGNED_ACT',
  'COMMAND_LOG',
  'SCREENSHOT',
  'NOTE',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** Доказательство (артефакт), прикладываемое к этапу. */
export interface Evidence {
  id: Id;
  sessionId: Id;
  stageId: StageId;
  type: EvidenceType;
  title: string;
  description?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  relatedResultIds?: Id[];
  createdBy: string;
  createdAt: IsoDateTime;
}

export const SESSION_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Сессия запуска объекта: состояние конечного автомата и все артефакты. */
export interface LaunchSession {
  id: Id;
  objectId: Id;
  /** Версия набора правил, зафиксированная при создании сессии. */
  rulesetVersion: string;
  status: SessionStatus;
  currentStageId: StageId;
  stages: Record<StageId, LaunchStage>;
  blockers: Blocker[];
  evidence: Evidence[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt?: IsoDateTime;
}
