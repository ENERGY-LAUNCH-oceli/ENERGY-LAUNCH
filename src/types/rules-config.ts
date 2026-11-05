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

export interface MeterHistoryRules {
  /** Шаг интервального учёта, минуты (частота данных). */
  intervalMinutes: number;
  /** Глубина проверяемой истории, сутки (период проверки). */
  checkPeriodDays: number;
  /** Минимальная полнота интервалов, %. */
  minCompletenessPct: number;
  /** Максимум подряд пропущенных интервалов. */
  maxConsecutiveGaps: number;
  /** Допустимое расхождение счёта и учёта, %. */
  invoiceTolerancePct: number;
}

export interface TelemetryRules {
  /** Ожидаемый период поступления данных, секунды (частота данных). */
  expectedFrequencySec: number;
  /** Допуск на отклонение медианного периода, %. */
  frequencyTolerancePct: number;
  minCompletenessPct: number;
  /** Максимальная задержка доставки, секунды. */
  maxLatencySec: number;
  /** Перцентиль задержки, сравниваемый с maxLatencySec. */
  latencyPercentile: number;
  /** Длительность наблюдения, часы (период проверки). */
  observationPeriodHours: number;
  /** Обязательные сигналы. */
  requiredSignals: SignalKind[];
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
