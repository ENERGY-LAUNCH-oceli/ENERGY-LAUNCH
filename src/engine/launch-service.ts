import type { LaunchInputs, LaunchSession, RulesConfig, StageId } from '@/types';
import type { EngineContext } from './context';
import { applyValidationResults, type MachineResult } from './state-machine';
import { runStageValidation } from './validators';

/**
 * Фасад: прогон проверок этапа и применение их результатов к автомату за один шаг.
 */
export function validateStage(
  session: LaunchSession,
  stageId: StageId,
  inputs: LaunchInputs,
  config: RulesConfig,
  ctx: EngineContext,
): MachineResult {
  const results = runStageValidation(stageId, inputs, config, ctx);
  return applyValidationResults(session, stageId, results, config, ctx);
}

