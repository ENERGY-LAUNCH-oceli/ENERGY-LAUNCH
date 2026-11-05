import type { Id, IsoDateTime, Severity } from './common';
import type { StageId } from './launch';

/** Код правила, например `MH-003`. */
export type RuleId = string;

/** Описание правила проверки (метаданные; логика — в src/engine/validators). */
export interface ValidationRule {
  id: RuleId;
  stageId: StageId;
  title: string;
  description: string;
  severity: Severity;
  /** Блокирующее правило: при провале этап переходит в BLOCKED. */
  blocking: boolean;
  /** Путь к порогу в RulesConfig, например `meterHistory.minCompletenessPct`. */
  configRef?: string;
}

export const VALIDATION_STATUSES = ['PASSED', 'FAILED', 'WARNING', 'SKIPPED'] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export type ValidationValue = number | string | boolean | null;

export interface ValidationResult {
  id: Id;
  ruleId: RuleId;
  stageId: StageId;
  status: ValidationStatus;
  severity: Severity;
  blocking: boolean;
  message: string;
  actual?: ValidationValue;
  expected?: ValidationValue;
  details?: Record<string, unknown>;
  evaluatedAt: IsoDateTime;
  rulesetVersion: string;
}
