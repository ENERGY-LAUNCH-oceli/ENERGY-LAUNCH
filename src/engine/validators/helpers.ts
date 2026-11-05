import type { Measurement, ValidationResult, ValidationStatus, ValidationValue } from '@/types';
import type { EngineContext } from '../context';
import { getRule, type KnownRuleId } from '../rules/catalog';

export interface ValidatorEnv {
  ctx: EngineContext;
  rulesetVersion: string;
}

export interface ResultParams {
  message: string;
  actual?: ValidationValue;
  expected?: ValidationValue;
  details?: Record<string, unknown>;
}

/** Сборка ValidationResult по правилу из каталога. */
export function makeResult(
  ruleId: KnownRuleId,
  passed: boolean | 'SKIPPED',
  params: ResultParams,
  env: ValidatorEnv,
): ValidationResult {
  const rule = getRule(ruleId);
  let status: ValidationStatus;
  if (passed === 'SKIPPED') status = 'SKIPPED';
  else if (passed) status = 'PASSED';
  else status = rule.severity === 'WARNING' || !rule.blocking ? 'WARNING' : 'FAILED';

  return {
    id: env.ctx.newId(),
    ruleId,
    stageId: rule.stageId,
    status,
    severity: rule.severity,
    blocking: rule.blocking,
    evaluatedAt: env.ctx.now(),
    rulesetVersion: env.rulesetVersion,
    ...params,
  };
}

export const MS = { second: 1_000, minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

export const toMs = (iso: string): number => Date.parse(iso);

export const round = (value: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** Значение считается достоверным, если оно присутствует и не помечено как MISSING. */
export function isUsable(m: Measurement): boolean {
  return m.value !== null && m.quality !== 'MISSING';
}

export function sortByTime(measurements: readonly Measurement[]): Measurement[] {
  return [...measurements].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Перцентиль методом nearest-rank. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * s.length);
  return s[Math.min(Math.max(rank, 1), s.length) - 1]!;
}

/** Интервалы между соседними отметками времени, мс. */
export function deltas(sorted: readonly Measurement[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) out.push(toMs(sorted[i]!.timestamp) - toMs(sorted[i - 1]!.timestamp));
  return out;
}

export function groupBy<T, K extends string>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Анализ регулярного ряда на сетке [start, end) с шагом stepMs:
 * сколько слотов ожидается, сколько заполнено достоверными значениями,
 * максимальная серия подряд пустых слотов.
 */
export function analyzeGrid(
  measurements: readonly Measurement[],
  startMs: number,
  endMs: number,
  stepMs: number,
): { expected: number; present: number; completenessPct: number; maxConsecutiveGaps: number } {
  const expected = Math.max(0, Math.floor((endMs - startMs) / stepMs));
  const filled = new Uint8Array(expected);
  for (const m of measurements) {
    if (!isUsable(m)) continue;
    const slot = Math.round((toMs(m.timestamp) - startMs) / stepMs);
    if (slot >= 0 && slot < expected) filled[slot] = 1;
  }
  let present = 0;
  let run = 0;
  let maxRun = 0;
  for (const f of filled) {
    if (f) {
      present++;
      run = 0;
    } else {
      run++;
      if (run > maxRun) maxRun = run;
    }
  }
  return {
    expected,
    present,
    completenessPct: expected === 0 ? 0 : round((present / expected) * 100),
    maxConsecutiveGaps: maxRun,
  };
}
