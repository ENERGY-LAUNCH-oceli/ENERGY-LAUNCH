import type { ControlTestCommand, ControlTestingRules, ControlValidationRun, ValidationResult } from '@/types';

/** Подтверждение прогона этапа 3: какие команды проверялись, параметры, результат. */
export function makeControlRun(commands: readonly ControlTestCommand[], results: readonly ValidationResult[], rules: ControlTestingRules, rulesetVersion: string, at: string, previous: readonly ControlValidationRun[]): ControlValidationRun {
  const failed = results.filter((r) => r.blocking && r.status !== 'PASSED' && r.status !== 'NOT_APPLICABLE').map((r) => r.ruleId);
  return {
    id: `crun-${previous.length + 1}-${at}`,
    run: previous.length + 1,
    at,
    rulesetVersion,
    commandsCount: commands.length,
    commandIds: commands.map((c) => c.commandId),
    result: failed.length ? 'FAILED' : 'PASSED',
    failedRules: failed,
    params: { ackTimeoutSec: rules.ackTimeoutSec, responseWindowSec: rules.responseWindowSec, toleranceKw: rules.toleranceKw, tolerancePct: rules.tolerancePct, minStepKw: rules.minStepKw },
  };
}
