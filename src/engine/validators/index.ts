import type { LaunchInputs, RulesConfig, StageId, ValidationResult } from '@/types';
import type { EngineContext } from '../context';
import { validateControl } from './control.validator';
import { validateDashboards } from './dashboards.validator';
import type { ValidatorEnv } from './helpers';
import { validateInvoice } from '../invoice/rules';
import { validateTelemetry } from './telemetry.validator';

export type StageValidator = (inputs: LaunchInputs, config: RulesConfig, env: ValidatorEnv) => ValidationResult[];

const allSignals = (inputs: LaunchInputs) => inputs.object.assets.flatMap((a) => a.signals);

/** Реестр валидаторов этапов. */
export const STAGE_VALIDATORS: Record<StageId, StageValidator> = {
  METER_HISTORY: (i, c, e) => validateInvoice(i.invoice, i.object, c.meterHistory, e),
  REALTIME_TELEMETRY: (i, c, e) => validateTelemetry(i.telemetry, allSignals(i), c.telemetry, e),
  ASSET_CONTROL: (i, c, e) => validateControl(i.controlTests, c.control, e),
  FINAL_DASHBOARDS: (i, c, e) => validateDashboards(i.dashboards, allSignals(i), c.dashboards, e),
};

/** Запуск всех проверок этапа. Чистая функция. */
export function runStageValidation(
  stageId: StageId,
  inputs: LaunchInputs,
  config: RulesConfig,
  ctx: EngineContext,
): ValidationResult[] {
  return STAGE_VALIDATORS[stageId](inputs, config, { ctx, rulesetVersion: config.version });
}

/** Этап считается прошедшим проверки, если ни одно блокирующее правило не провалено и не пропущено. NOT_APPLICABLE не блокирует. */
export function hasBlockingFailures(results: readonly ValidationResult[]): boolean {
  return results.some((r) => r.blocking && (r.status === 'FAILED' || r.status === 'SKIPPED'));
}

export { validateInvoice, validateTelemetry, validateControl, validateDashboards };
export * from './helpers';
