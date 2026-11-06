import type { Id } from './common';
import type { ControlTest } from './control';
import type { ControlTestCommand, ControlValidationRun } from './control-testing';
import type { Dashboard } from './dashboard';
import type { DashboardWorkspace } from './dashboard-config';
import type { SourceStatus, StaleMark, ValidationSnapshot } from './trail';
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
  /** Программа испытаний (наборы правил 1.0–1.2). */
  controlTests: ControlTest[];
  /** Тесты управления через имитатор (набор правил 1.3+): журнал команд, старые не удаляются. */
  controlCommands?: ControlTestCommand[];
  controlRuns?: ControlValidationRun[];
  /** Панели наборов правил 1.0–1.3. */
  dashboards: Dashboard[];
  /** Рабочая панель объекта и приёмка (набор правил 1.4+). */
  dashboard?: DashboardWorkspace;
  /** Все прогоны проверок с входами и статусами (не удаляются). */
  validationHistory?: ValidationSnapshot[];
  /** Отметки устаревания подтверждений после изменения входов. */
  staleMarks?: StaleMark[];
  /** Доступность источников: недоступный источник не даёт успеха, сохранённые результаты остаются в истории. */
  sources?: Partial<Record<'invoice' | 'telemetry', SourceStatus>>;
}

/** Ожидаемый исход этапа после прогона проверок. */
export interface ScenarioExpectation {
  stageId: StageId;
  /** Статус этапа после START + прогона проверок. */
  statusAfterValidation: Extract<StageStatus, 'IN_PROGRESS' | 'BLOCKED'>;
  /** Блокирующие правила, которые должны получить статус FAILED (пусто – все проходят). */
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
