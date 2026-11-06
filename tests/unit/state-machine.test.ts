import { describe, expect, it } from 'vitest';
import { RULESET_V1 } from '@/config/rules';
import { loadScenario } from '@/data/scenarios';
import {
  addConfirmation,
  addEvidence,
  addManualBlocker,
  canTransition,
  completeStage,
  createFixedContext,
  createLaunchSession,
  resolveBlocker,
  startStage,
  validateStage,
  type MachineResult,
} from '@/engine';
import type { LaunchInputs, LaunchSession, StageId } from '@/types';

const ctx = createFixedContext('tester', '2026-11-05T10:00:00.000Z');
const cfg = RULESET_V1;

function unwrap(r: MachineResult): LaunchSession {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.session;
}

/** Подтверждает все требования этапа, прикладывая доказательство первого допустимого типа. */
function confirmAll(session: LaunchSession, stageId: StageId): LaunchSession {
  let s = session;
  for (const req of cfg.confirmations[stageId]) {
    s = unwrap(addEvidence(s, { stageId, type: req.evidenceTypes[0]!, title: `Доказательство ${req.id}` }, ctx));
    const evidenceId = s.evidence.at(-1)!.id;
    s = unwrap(addConfirmation(s, { stageId, requirementId: req.id, role: req.role, confirmedBy: 'Иванов', evidenceIds: [evidenceId] }, cfg, ctx));
  }
  return s;
}

function passStage(session: LaunchSession, stageId: StageId, inputs: LaunchInputs): LaunchSession {
  let s = unwrap(startStage(session, stageId, ctx));
  s = unwrap(validateStage(s, stageId, inputs, cfg, ctx));
  s = confirmAll(s, stageId);
  return unwrap(completeStage(s, stageId, cfg, ctx));
}

describe('таблица переходов', () => {
  it('COMPLETED — терминальный', () => {
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('NOT_STARTED', 'COMPLETED')).toBe(false);
    expect(canTransition('BLOCKED', 'COMPLETED')).toBe(false);
  });
});

describe('конечный автомат запуска', () => {
  const { inputs } = loadScenario('happy-path');
  const fresh = () => createLaunchSession(inputs.object.id, cfg.version, ctx);

  it('создаёт сессию с четырьмя этапами NOT_STARTED', () => {
    const s = fresh();
    expect(Object.values(s.stages).map((st) => st.status)).toEqual(['NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED']);
    expect(s.currentStageId).toBe('METER_HISTORY');
  });

  it('не позволяет начать этап, пока предыдущий не завершён', () => {
    const r = startStage(fresh(), 'REALTIME_TELEMETRY', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PREVIOUS_STAGE_NOT_COMPLETED');
    expect(r.events[0]?.action).toBe('TRANSITION_REJECTED');
  });

  it('не позволяет завершить последующий этап, если предыдущий не завершён', () => {
    const r = completeStage(fresh(), 'ASSET_CONTROL', cfg, ctx);
    expect(!r.ok && r.error.code).toBe('PREVIOUS_STAGE_NOT_COMPLETED');
  });

  it('не позволяет завершить этап без запуска проверок', () => {
    const s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    const r = completeStage(s, 'METER_HISTORY', cfg, ctx);
    expect(!r.ok && r.error.code).toBe('VALIDATION_NOT_RUN');
  });

  it('не позволяет завершить этап без обязательных подтверждений', () => {
    let s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    s = unwrap(validateStage(s, 'METER_HISTORY', inputs, cfg, ctx));
    const r = completeStage(s, 'METER_HISTORY', cfg, ctx);
    expect(!r.ok && r.error.code).toBe('MISSING_CONFIRMATIONS');
  });

  it('не засчитывает подтверждение с доказательством недопустимого типа', () => {
    let s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    s = unwrap(validateStage(s, 'METER_HISTORY', inputs, cfg, ctx));
    s = unwrap(addEvidence(s, { stageId: 'METER_HISTORY', type: 'NOTE', title: 'Заметка' }, ctx));
    const req = cfg.confirmations.METER_HISTORY[0]!;
    s = unwrap(addConfirmation(s, { stageId: 'METER_HISTORY', requirementId: req.id, role: req.role, confirmedBy: 'X', evidenceIds: [s.evidence[0]!.id] }, cfg, ctx));
    expect(!completeStage(s, 'METER_HISTORY', cfg, ctx).ok).toBe(true);
  });

  it('отклоняет подтверждение с чужой ролью', () => {
    const s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    const r = addConfirmation(s, { stageId: 'METER_HISTORY', requirementId: 'MH-CONF-OWNER', role: 'DISPATCHER', confirmedBy: 'X', evidenceIds: [] }, cfg, ctx);
    expect(r.ok).toBe(false);
  });

  it('проходит все четыре этапа последовательно и завершает сессию', () => {
    let s = fresh();
    for (const id of ['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS'] as const) s = passStage(s, id, inputs);
    expect(Object.values(s.stages).every((st) => st.status === 'COMPLETED')).toBe(true);
    expect(s.status).toBe('COMPLETED');
    expect(startStage(s, 'METER_HISTORY', ctx).ok).toBe(false);
  });

  it('не мутирует исходную сессию', () => {
    const s = fresh();
    const snapshot = structuredClone(s);
    startStage(s, 'METER_HISTORY', ctx);
    expect(s).toEqual(snapshot);
  });

  it('ручной блокер переводит этап в BLOCKED и снимается с обоснованием', () => {
    let s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    s = unwrap(addManualBlocker(s, 'METER_HISTORY', { title: 'Замечание СО', description: '…', severity: 'CRITICAL' }, ctx));
    expect(s.stages.METER_HISTORY.status).toBe('BLOCKED');
    expect(completeStage(s, 'METER_HISTORY', cfg, ctx).ok).toBe(false);
    const blockerId = s.blockers[0]!.id;
    expect(resolveBlocker(s, blockerId, { resolution: '  ' }, ctx).ok).toBe(false);
    s = unwrap(resolveBlocker(s, blockerId, { resolution: 'Устранено' }, ctx));
    expect(s.stages.METER_HISTORY.status).toBe('IN_PROGRESS');
  });

  it('блокер проверки нельзя закрыть вручную как RESOLVED; повторная успешная проверка снимает его', () => {
    const bad = loadScenario('invoice-mismatch').inputs;
    let s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    s = unwrap(validateStage(s, 'METER_HISTORY', bad, cfg, ctx));
    expect(s.stages.METER_HISTORY.status).toBe('BLOCKED');
    const blocker = s.blockers.find((b) => b.ruleId === 'MH-005')!;
    expect(resolveBlocker(s, blocker.id, { resolution: 'ok' }, ctx).ok).toBe(false);

    // Повторная проверка тем же набором не дублирует блокер
    s = unwrap(validateStage(s, 'METER_HISTORY', bad, cfg, ctx));
    expect(s.blockers.filter((b) => b.status === 'OPEN')).toHaveLength(1);

    // Исправленные данные снимают блокер автоматически
    s = unwrap(validateStage(s, 'METER_HISTORY', inputs, cfg, ctx));
    expect(s.stages.METER_HISTORY.status).toBe('IN_PROGRESS');
    expect(s.blockers.every((b) => b.status === 'RESOLVED')).toBe(true);
  });

  it('отклоняет применение набора правил другой версии', () => {
    const s = unwrap(startStage(fresh(), 'METER_HISTORY', ctx));
    const r = validateStage(s, 'METER_HISTORY', inputs, { ...cfg, version: '9.9.9' }, ctx);
    expect(!r.ok && r.error.code).toBe('RULESET_MISMATCH');
  });
});

describe('требования фазы 05', () => {
  const { inputs } = loadScenario('happy-path');
  it('отказ завершить этап 3 перечисляет все незакрытые зависимости и сохраняет материалы', () => {
    let s = createLaunchSession(inputs.object.id, cfg.version, ctx);
    s = unwrap(addEvidence(s, { stageId: 'ASSET_CONTROL', type: 'COMMAND_LOG', title: 'Журнал заранее' }, ctx));
    const r = completeStage(s, 'ASSET_CONTROL', cfg, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('PREVIOUS_STAGE_NOT_COMPLETED');
      expect((r.error.details?.dependencies as { stageId: string }[]).map((d) => d.stageId)).toEqual(['METER_HISTORY', 'REALTIME_TELEMETRY']);
    }
    expect(s.evidence).toHaveLength(1);
  });

  it('SoC батареи — Not Applicable без батареи и не блокирует этап', () => {
    let s = unwrap(startStage(createLaunchSession(inputs.object.id, cfg.version, ctx), 'METER_HISTORY', ctx));
    s = unwrap(validateStage(s, 'METER_HISTORY', inputs, cfg, ctx));
    s = confirmAll(s, 'METER_HISTORY');
    s = unwrap(completeStage(s, 'METER_HISTORY', cfg, ctx));
    s = unwrap(startStage(s, 'REALTIME_TELEMETRY', ctx));
    s = unwrap(validateStage(s, 'REALTIME_TELEMETRY', inputs, cfg, ctx));
    expect(s.stages.REALTIME_TELEMETRY.validationResults.find((r) => r.ruleId === 'TM-006')?.status).toBe('NOT_APPLICABLE');
    expect(s.stages.REALTIME_TELEMETRY.status).toBe('IN_PROGRESS');
  });
});
