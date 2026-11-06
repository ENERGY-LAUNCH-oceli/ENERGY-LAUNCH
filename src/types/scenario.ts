import type { Id } from './common';
import type { ControlTest } from './control';
import type { Dashboard } from './dashboard';
import type { InvoiceDataset } from './dataset';
import type { InvoiceValidationRun } from './invoice';
import type { SitePassport, TelemetryDatasetV2, TelemetryValidationRun } from './telemetry';
import type { StageId, StageStatus } from './launch';
import type { EnergyObject } from './object';
import type { RuleId } from './validation';

/** Все входные данные, необходимые для прохождения этапов запуска. */
export interface LaunchInputs {
  object: EnergyObject;
  invoice?: InvoiceDataset;
  /** Предыдущие загрузки истории счётчиков (повторная проверка не стирает историю). */
  invoiceHistory?: InvoiceDataset[];
  /** История прогонов проверок этапа 1; старые результаты не удаляются. */
  invoiceRuns?: InvoiceValidationRun[];
  /** Паспорт объекта object.json (нормализованный). */
  passport?: SitePassport;
  passportHistory?: SitePassport[];
  telemetry?: TelemetryDatasetV2;
  telemetryHistory?: TelemetryDatasetV2[];
  telemetryRuns?: TelemetryValidationRun[];
  controlTests: ControlTest[];
  dashboards: Dashboard[];
}

/** Ожидаемый исход этапа после прогона проверок. */
export interface ScenarioExpectation {
  stageId: StageId;
  /** Статус этапа после START + прогона проверок. */
  statusAfterValidation: Extract<StageStatus, 'IN_PROGRESS' | 'BLOCKED'>;
  /** Блокирующие правила, которые должны получить статус FAILED (пусто — все проходят). */
  failingRuleIds: RuleId[];
}

/** Демонстрационный / тестовый сценарий запуска. */
export interface TestScenario {
  id: Id;
  title: string;
  description: string;
  tags: string[];
  inputs: LaunchInputs;
  expectations: ScenarioExpectation[];
}
