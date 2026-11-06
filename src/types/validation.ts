import type { Id, IsoDateTime, Severity } from './common';
import type { StageId } from './launch';

/** Код правила, например `MH-003`. */
export type RuleId = string;

/**
 * Измерение проверки (ТЗ п. 2.2.3): наличие данных, их качество и результат
 * функциональной проверки оцениваются раздельно.
 */
export const CHECK_DIMENSIONS = ['PRESENCE', 'QUALITY', 'FUNCTION'] as const;
export type CheckDimension = (typeof CHECK_DIMENSIONS)[number];

/** Описание правила проверки (метаданные; логика — в src/engine/validators). */
export interface ValidationRule {
  id: RuleId;
  stageId: StageId;
  title: string;
  description: string;
  dimension: CheckDimension;
  severity: Severity;
  /** Блокирующее правило: при провале этап переходит в BLOCKED. */
  blocking: boolean;
  /** Путь к порогу в RulesConfig, например `meterHistory.minCompletenessPct`. */
  configRef?: string;
}

export const VALIDATION_STATUSES = ['PASSED', 'FAILED', 'WARNING', 'SKIPPED', 'NOT_APPLICABLE'] as const;
/**
 * NOT_APPLICABLE — только для отдельной проверки при подтверждённом паспортом
 * отсутствии актива или функции (ТЗ 2.1); никогда для этапа целиком.
 */
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
