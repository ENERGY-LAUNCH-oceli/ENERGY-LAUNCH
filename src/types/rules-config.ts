import type { ConfirmationRole } from './common';
import type { ControlCommandType } from './control';
import type { DashboardBlockType } from './dashboard';
import type { EvidenceType, StageId } from './launch';
import type { SignalKind } from './object';

export interface SourceDocumentRef {
  code: string;
  title: string;
}

/** Обязательное подтверждение для завершения этапа. */
export interface ConfirmationRequirement {
  id: string;
  title: string;
  role: ConfirmationRole;
  /** Допустимые типы доказательств. */
  evidenceTypes: EvidenceType[];
  /** Минимальное количество приложенных доказательств допустимых типов. */
  minEvidence: number;
}

export type SignRule = 'NON_NEGATIVE' | 'NON_POSITIVE' | 'ANY';

export interface InvoiceFieldRule {
  field: string;
  unit: string;
  sign: SignRule;
  required: boolean;
}

export interface MeterHistoryRules {
  /** Заявленная частота официальных данных, минуты (ТЗ: 15). */
  intervalMinutes: number;
  /** Требуемая история, последовательных месяцев (ТЗ: 24). */
  periodMonths: number;
  /** Минимальная полнота интервалов в окне, %. */
  minCompletenessPct: number;
  maxDuplicates: number;
  maxInvalidTimestamps: number;
  /** Допуск расхождения исходных и валидированных значений, % (предупреждение). */
  validatedTolerancePct: number;
  /** Отношение E / (P·Δt), выше которого значение считается в других единицах (Wh вместо kWh). */
  unitRatioThreshold: number;
  fields: InvoiceFieldRule[];
  /** Длина кода EAN. */
  eanLength: number;
}

export interface TelemetryRules {
  /** Шаг потока, минуты (ТЗ: 15). */
  intervalMinutes: number;
  /** Окно проверки полноты, часы (ТЗ: 48). */
  windowHours: number;
  /** Минимальная полнота по каждому обязательному сигналу, % (демо: 99). */
  minCompletenessPct: number;
  /** Максимальный возраст последнего значения относительно точки проверки, минуты (демо: 30). */
  maxAgeMinutes: number;
  /** Точка проверки — фиксированный момент оценки актуальности (ТЗ, глоссарий). */
  checkPoint: string;
  /** Обязательные сигналы: шаблон `{asset}` заменяется префиксом актива (PV1, Battery2). */
  requiredGrid: string[];
  requiredPv: string[];
  requiredBattery: string[];
  /** Физически допустимые диапазоны. */
  maxAbsPowerKw: number;
  maxEnergyKwhPerInterval: number;
  /** Скачок SoC за интервал, выше которого значение подозрительно, п. п. */
  maxSocJumpPct: number;
  /** Допуск расхождения отправленной и принятой уставки, кВт. */
  setpointToleranceKw: number;
}

export interface ControlRules {
  requiredCommandTypes: ControlCommandType[];
  /** Максимальное время квитирования команды, секунды. */
  maxAcknowledgeSec: number;
  /** Максимальное время исполнения команды, секунды. */
  maxExecutionSec: number;
  /** Допустимый интервал между последовательными командами, секунды. */
  minIntervalBetweenCommandsSec: number;
  maxIntervalBetweenCommandsSec: number;
  /** Допуск обратной связи по уставке, % от целевого значения. */
  setpointTolerancePct: number;
}

export interface DashboardRules {
  requiredBlockTypes: DashboardBlockType[];
  requiredSignals: SignalKind[];
  requirePublished: boolean;
}

/** Версионируемый набор правил запуска. Все пороги — только здесь. */
export interface RulesConfig {
  version: string;
  effectiveFrom: string;
  description: string;
  sourceDocuments: SourceDocumentRef[];
  /**
   * `true` — значения ещё не сверены с первоисточниками (ТЗ, паспорт кейса)
   * и должны быть подтверждены до промышленной эксплуатации.
   */
  provisional: boolean;
  meterHistory: MeterHistoryRules;
  telemetry: TelemetryRules;
  control: ControlRules;
  dashboards: DashboardRules;
  confirmations: Record<StageId, ConfirmationRequirement[]>;
}
