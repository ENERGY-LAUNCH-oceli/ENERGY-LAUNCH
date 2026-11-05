import type { ControlCommand, ControlRules, ControlTest, ValidationResult } from '@/types';
import { groupBy, makeResult, MS, round, toMs, type ValidatorEnv } from './helpers';

const SETPOINT_TYPES = new Set<ControlCommand['type']>(['ACTIVE_POWER_SETPOINT', 'REACTIVE_POWER_SETPOINT', 'POWER_LIMIT']);

const secondsBetween = (from: string, to: string) => (toMs(to) - toMs(from)) / MS.second;

/** Этап 3: испытания дистанционного управления активами. */
export function validateControl(
  tests: readonly ControlTest[],
  rules: ControlRules,
  env: ValidatorEnv,
): ValidationResult[] {
  const commands = tests.flatMap((t) => t.commands);

  // CT-001 — покрытие обязательных типов (учитываются только исполненные команды)
  const executedTypes = new Set(commands.filter((c) => c.status === 'EXECUTED').map((c) => c.type));
  const missingTypes = rules.requiredCommandTypes.filter((t) => !executedTypes.has(t));
  const coverage = makeResult(
    'CT-001',
    missingTypes.length === 0,
    {
      message: missingTypes.length ? `Не испытаны команды: ${missingTypes.join(', ')}` : 'Все обязательные типы команд испытаны',
      actual: rules.requiredCommandTypes.length - missingTypes.length,
      expected: rules.requiredCommandTypes.length,
      details: { missingTypes },
    },
    env,
  );

  if (commands.length === 0) {
    return [
      coverage,
      ...(['CT-002', 'CT-003', 'CT-004', 'CT-005', 'CT-006'] as const).map((id) =>
        makeResult(id, 'SKIPPED', { message: 'Нет команд для анализа' }, env),
      ),
    ];
  }

  // CT-002 — квитирование
  const ackViolations = commands
    .map((c) => ({ commandId: c.id, ackSec: c.acknowledgedAt ? round(secondsBetween(c.issuedAt, c.acknowledgedAt)) : null }))
    .filter((c) => c.ackSec === null || c.ackSec > rules.maxAcknowledgeSec);
  const ack = makeResult(
    'CT-002',
    ackViolations.length === 0,
    {
      message: ackViolations.length
        ? `${ackViolations.length} команд квитированы позже ${rules.maxAcknowledgeSec} с или не квитированы`
        : `Все команды квитированы за ≤ ${rules.maxAcknowledgeSec} с`,
      expected: rules.maxAcknowledgeSec,
      details: { violations: ackViolations },
    },
    env,
  );

  // CT-003 — исполнение
  const execViolations = commands
    .map((c) => ({ commandId: c.id, execSec: c.executedAt ? round(secondsBetween(c.issuedAt, c.executedAt)) : null }))
    .filter((c) => c.execSec === null || c.execSec > rules.maxExecutionSec);
  const exec = makeResult(
    'CT-003',
    execViolations.length === 0,
    {
      message: execViolations.length
        ? `${execViolations.length} команд исполнены позже ${rules.maxExecutionSec} с или не исполнены`
        : `Все команды исполнены за ≤ ${rules.maxExecutionSec} с`,
      expected: rules.maxExecutionSec,
      details: { violations: execViolations },
    },
    env,
  );

  // CT-004 — интервалы между командами одного актива
  const intervalViolations: Array<{ assetId: string; commandId: string; intervalSec: number }> = [];
  for (const [assetId, list] of groupBy(commands, (c) => c.assetId)) {
    const sorted = [...list].sort((a, b) => toMs(a.issuedAt) - toMs(b.issuedAt));
    for (let i = 1; i < sorted.length; i++) {
      const intervalSec = round(secondsBetween(sorted[i - 1]!.issuedAt, sorted[i]!.issuedAt));
      if (intervalSec < rules.minIntervalBetweenCommandsSec || intervalSec > rules.maxIntervalBetweenCommandsSec) {
        intervalViolations.push({ assetId, commandId: sorted[i]!.id, intervalSec });
      }
    }
  }
  const intervals = makeResult(
    'CT-004',
    intervalViolations.length === 0,
    {
      message: intervalViolations.length
        ? `${intervalViolations.length} интервалов вне диапазона ${rules.minIntervalBetweenCommandsSec}–${rules.maxIntervalBetweenCommandsSec} с`
        : 'Интервалы между командами в допустимом диапазоне',
      details: { violations: intervalViolations },
    },
    env,
  );

  // CT-005 — отработка уставок
  const setpointViolations = commands
    .filter((c) => SETPOINT_TYPES.has(c.type) && c.targetValue !== undefined)
    .map((c) => {
      const target = c.targetValue!;
      const deviationPct =
        c.feedbackValue === undefined ? null : target === 0 ? Math.abs(c.feedbackValue) * 100 : (Math.abs(c.feedbackValue - target) / Math.abs(target)) * 100;
      return { commandId: c.id, target, feedback: c.feedbackValue ?? null, deviationPct: deviationPct === null ? null : round(deviationPct, 3) };
    })
    .filter((c) => c.deviationPct === null || c.deviationPct > rules.setpointTolerancePct);
  const setpoints = makeResult(
    'CT-005',
    setpointViolations.length === 0,
    {
      message: setpointViolations.length
        ? `${setpointViolations.length} уставок отработаны вне допуска ${rules.setpointTolerancePct}%`
        : `Уставки отработаны в пределах ${rules.setpointTolerancePct}%`,
      expected: rules.setpointTolerancePct,
      details: { violations: setpointViolations },
    },
    env,
  );

  // CT-006 — отказы
  const failed = commands.filter((c) => c.status === 'FAILED' || c.status === 'TIMEOUT');
  const failures = makeResult(
    'CT-006',
    failed.length === 0,
    {
      message: failed.length ? `Отказы команд: ${failed.length}` : 'Отказов команд нет',
      actual: failed.length,
      expected: 0,
      details: { commandIds: failed.map((c) => c.id) },
    },
    env,
  );

  return [coverage, ack, exec, intervals, setpoints, failures];
}
