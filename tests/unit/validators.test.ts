import { describe, expect, it } from 'vitest';
import { RULESET_V1 } from '@/config/rules';
import { generateControlTests } from '@/data/mock';
import { analyzeGrid, createFixedContext, percentile, validateControl } from '@/engine';
import type { Measurement } from '@/types';

const env = { ctx: createFixedContext('t', '2026-11-05T00:00:00.000Z'), rulesetVersion: '1.0.0' };
const statusOf = (results: { ruleId: string; status: string }[], id: string) => results.find((r) => r.ruleId === id)?.status;

describe('helpers', () => {
  it('percentile nearest-rank', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([], 95)).toBeNull();
  });

  it('analyzeGrid считает полноту и серии пропусков', () => {
    const m = (i: number, value: number | null): Measurement => ({
      signalId: 's', timestamp: new Date(i * 60_000).toISOString(), value, unit: 'kW', quality: value === null ? 'MISSING' : 'GOOD',
    });
    const series = [m(0, 1), m(1, null), m(2, null), m(3, 1)];
    expect(analyzeGrid(series, 0, 5 * 60_000, 60_000)).toEqual({ expected: 5, present: 2, completenessPct: 40, maxConsecutiveGaps: 2, longestGap: { from: new Date(60_000).toISOString(), to: new Date(180_000).toISOString() } });
  });
});

describe('Asset Control', () => {
  it('слишком частые команды — CT-004 WARNING (не блокирует)', () => {
    const r = validateControl(generateControlTests({ startAt: '2026-11-03T09:00:00.000Z', intervalSec: 10 }), RULESET_V1.control, env);
    const ct4 = r.find((x) => x.ruleId === 'CT-004')!;
    expect(ct4.status).toBe('WARNING');
    expect(ct4.blocking).toBe(false);
  });

  it('медленное квитирование и отклонение уставки', () => {
    const r = validateControl(generateControlTests({ startAt: '2026-11-03T09:00:00.000Z', intervalSec: 120, ackSec: 10, feedbackErrorPct: 5 }), RULESET_V1.control, env);
    expect(statusOf(r, 'CT-002')).toBe('FAILED');
    expect(statusOf(r, 'CT-005')).toBe('FAILED');
  });
});
