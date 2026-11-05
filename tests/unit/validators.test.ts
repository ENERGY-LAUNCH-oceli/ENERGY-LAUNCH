import { describe, expect, it } from 'vitest';
import { RULESET_V1 } from '@/config/rules';
import { generateControlTests, generateInvoiceDataset } from '@/data/mock';
import { analyzeGrid, createFixedContext, percentile, validateControl, validateMeterHistory, validateTelemetry } from '@/engine';
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
    expect(analyzeGrid(series, 0, 5 * 60_000, 60_000)).toEqual({ expected: 5, present: 2, completenessPct: 40, maxConsecutiveGaps: 2 });
  });
});

describe('Meter History', () => {
  const base = { periodStart: '2026-10-01T00:00:00.000Z', days: 30, intervalMinutes: 30, seed: 3 };

  it('без данных — MH-001 FAILED, остальные SKIPPED', () => {
    const r = validateMeterHistory(undefined, RULESET_V1.meterHistory, env);
    expect(statusOf(r, 'MH-001')).toBe('FAILED');
    expect(r.filter((x) => x.ruleId !== 'MH-001').every((x) => x.status === 'SKIPPED')).toBe(true);
  });

  it('пороги берутся из конфигурации', () => {
    const ds = generateInvoiceDataset({ ...base, invoiceBiasPct: 3 });
    expect(statusOf(validateMeterHistory(ds, RULESET_V1.meterHistory, env), 'MH-005')).toBe('FAILED');
    expect(statusOf(validateMeterHistory(ds, { ...RULESET_V1.meterHistory, invoiceTolerancePct: 5 }, env), 'MH-005')).toBe('PASSED');
  });

  it('неверный шаг интервала — MH-002 FAILED', () => {
    const ds = generateInvoiceDataset({ ...base, intervalMinutes: 60 });
    expect(statusOf(validateMeterHistory(ds, RULESET_V1.meterHistory, env), 'MH-002')).toBe('FAILED');
  });

  it('короткая история — MH-004 FAILED', () => {
    const ds = generateInvoiceDataset({ ...base, days: 10 });
    expect(statusOf(validateMeterHistory(ds, RULESET_V1.meterHistory, env), 'MH-004')).toBe('FAILED');
  });
});

describe('Telemetry', () => {
  it('без датасета — TM-001 FAILED', () => {
    const r = validateTelemetry(undefined, [], RULESET_V1.telemetry, env);
    expect(statusOf(r, 'TM-001')).toBe('FAILED');
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
