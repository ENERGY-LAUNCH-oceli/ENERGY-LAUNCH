import type { LaunchInputs, RulesConfig, StageId, ValidationResult } from '@/types';
import type { EngineContext } from '../context';
import { validateControl } from './control.validator';
import { validateDashboards } from './dashboards.validator';
import { makeResult, type ValidatorEnv } from './helpers';
import { getRulesForStage, type KnownRuleId } from '../rules/catalog';
import { validateInvoice } from '../invoice/rules';
import { validateTelemetryReport } from '../telemetry/rules';
import { validateControlTesting } from '../control/rules';
import { validateDashboardConfig } from '../dashboards/rules';

export type StageValidator = (inputs: LaunchInputs, config: RulesConfig, env: ValidatorEnv) => ValidationResult[];

const allSignals = (inputs: LaunchInputs) => inputs.object.assets.flatMap((a) => a.signals);

/**
 * Объект для проверок истории: EAN и data_files – из последней версии паспорта object.json (ТЗ: «коды EAN из паспорта»).
 * Без этого исправленный паспорт (например, верная контрольная цифра EAN) не снимал бы препятствие MH-011.
 */
function objectWithPassport(i: LaunchInputs): LaunchInputs['object'] {
  const p = i.passport;
  if (!p) return i.object;
  return {
    ...i.object,
    gridConnection: { ...i.object.gridConnection, eanOfftake: p.ean.offtake ?? i.object.gridConnection.eanOfftake, eanInjection: p.ean.injection ?? i.object.gridConnection.eanInjection },
    passport: { ...i.object.passport, dataFiles: { invoice: p.dataFiles.invoice ?? i.object.passport.dataFiles?.invoice ?? null, telemetry: p.dataFiles.telemetry ?? i.object.passport.dataFiles?.telemetry ?? null } },
  };
}

/** Реестр валидаторов этапов. */
export const STAGE_VALIDATORS: Record<StageId, StageValidator> = {
  METER_HISTORY: (i, c, e) => validateInvoice(i.invoice, objectWithPassport(i), c.meterHistory, e),
  REALTIME_TELEMETRY: (i, c, e) => validateTelemetryReport(i.telemetry, i.passport, c.telemetry, e),
  // v1.3+: тесты через имитатор; v1.0–1.2: программа испытаний (сессии остаются на своей версии)
  ASSET_CONTROL: (i, c, e) => (c.controlTesting ? validateControlTesting(i.passport, i.controlCommands ?? [], c.controlTesting, e) : validateControl(i.controlTests, c.control, e)),
  // v1.4+: рабочая панель и приёмка; v1.0–1.3: список панелей
  FINAL_DASHBOARDS: (i, c, e) => (c.dashboardConfig ? validateDashboardConfig(i, c.dashboardConfig, e) : validateDashboards(i.dashboards, allSignals(i), c.dashboards, e)),
};

const SOURCE_OF: Partial<Record<StageId, 'invoice' | 'telemetry'>> = { METER_HISTORY: 'invoice', REALTIME_TELEMETRY: 'telemetry' };

/**
 * Источник недоступен (ТЗ 2.2 п. 2): все проверки этапа – SKIPPED с причиной и временем последней успешной
 * проверки. SKIPPED блокирует завершение – недоступность не может дать «завершён».
 */
function unavailableResults(stageId: StageId, inputs: LaunchInputs, config: RulesConfig, env: ValidatorEnv): ValidationResult[] | null {
  const kind = SOURCE_OF[stageId];
  const src = kind ? inputs.sources?.[kind] : undefined;
  if (!src || src.available) return null;
  const last = src.lastSuccessAt ? `последняя успешная проверка ${src.lastSuccessAt.slice(0, 16).replace('T', ' ')} UTC` : 'успешных проверок не было';
  // Первая проверка (наличие данных) – FAILED: открывается одно препятствие «источник недоступен»; остальные – SKIPPED
  return getRulesForStage(stageId, config.version).map((rule, i) => ({
    ...makeResult(rule.id as KnownRuleId, i === 0 ? false : 'SKIPPED', { message: `Источник недоступен: ${src.error ?? kind}; ${last}. Это не успех`, details: { unavailable: true, source: kind, error: src.error ?? null, lastSuccessAt: src.lastSuccessAt ?? null } }, env),
  }));
}

/** Запуск всех проверок этапа. Чистая функция. */
export function runStageValidation(
  stageId: StageId,
  inputs: LaunchInputs,
  config: RulesConfig,
  ctx: EngineContext,
): ValidationResult[] {
  const env = { ctx, rulesetVersion: config.version };
  return unavailableResults(stageId, inputs, config, env) ?? STAGE_VALIDATORS[stageId](inputs, config, env);
}

/** Этап считается прошедшим проверки, если ни одно блокирующее правило не провалено и не пропущено. NOT_APPLICABLE не блокирует. */
export function hasBlockingFailures(results: readonly ValidationResult[]): boolean {
  return results.some((r) => r.blocking && (r.status === 'FAILED' || r.status === 'SKIPPED'));
}

export { validateInvoice, validateTelemetryReport, validateControl, validateDashboards };
export * from './helpers';
