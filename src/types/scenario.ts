import type { Id } from './common';
import type { ControlTest } from './control';
import type { Dashboard } from './dashboard';
import type { InvoiceDataset, TelemetryDataset } from './dataset';
import type { StageId, StageStatus } from './launch';
import type { EnergyObject } from './object';
import type { RuleId } from './validation';

/** Все входные данные, необходимые для прохождения этапов запуска. */
export interface LaunchInputs {
  object: EnergyObject;
  invoice?: InvoiceDataset;
  telemetry?: TelemetryDataset;
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
