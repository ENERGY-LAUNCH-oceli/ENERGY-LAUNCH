import { describe, expect, it } from 'vitest';
import { RULESET_V1 } from '@/config/rules';
import { loadScenario, SCENARIO_LIST } from '@/data/scenarios';
import {
  addConfirmation,
  addEvidence,
  completeStage,
  createFixedContext,
  createLaunchSession,
  startStage,
  validateStage,
  type MachineResult,
} from '@/engine';
import type { LaunchSession } from '@/types';

const cfg = RULESET_V1;
const ctx = createFixedContext('scenario-runner', '2026-11-05T10:00:00.000Z');
const unwrap = (r: MachineResult): LaunchSession => {
  if (!r.ok) throw new Error(r.error.message);
  return r.session;
};

/** Каждый сценарий прогоняется через движок: ожидания из каталога должны выполняться. */
describe.each(SCENARIO_LIST.map((s) => s.id))('сценарий %s', (id) => {
  it('соответствует ожиданиям', () => {
    const scenario = loadScenario(id);
    let s = createLaunchSession(scenario.inputs.object.id, cfg.version, ctx);
    for (const exp of scenario.expectations) {
      s = unwrap(startStage(s, exp.stageId, ctx));
      s = unwrap(validateStage(s, exp.stageId, scenario.inputs, cfg, ctx));
      const stage = s.stages[exp.stageId];
      const failing = stage.validationResults.filter((r) => r.blocking && r.status === 'FAILED').map((r) => r.ruleId).sort();
      expect({ stage: exp.stageId, status: stage.status, failing }).toEqual({
        stage: exp.stageId,
        status: exp.statusAfterValidation,
        failing: [...exp.failingRuleIds].sort(),
      });
      if (stage.status === 'BLOCKED') break;
      for (const req of cfg.confirmations[exp.stageId]) {
        s = unwrap(addEvidence(s, { stageId: exp.stageId, type: req.evidenceTypes[0]!, title: req.id }, ctx));
        s = unwrap(addConfirmation(s, { stageId: exp.stageId, requirementId: req.id, role: req.role, confirmedBy: 'auto', evidenceIds: [s.evidence.at(-1)!.id] }, cfg, ctx));
      }
      s = unwrap(completeStage(s, exp.stageId, cfg, ctx));
    }
  });
});
