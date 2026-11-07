import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { buildTelemetryDataset, demoObjectJson, demoPassport, telemetryCsvText, type DemoPassportSpec, type TelemetryGenOptions } from '@/data/mock';
import { createFixedContext, isTotalSignal, parseObjectJson, PassportFormatError, requiredSignals, validateTelemetryReport } from '@/engine';
import { importTelemetry } from '@/services/telemetry-import';
import type { ValidationStatus } from '@/types';

const rules = ACTIVE_RULESET.telemetry;
const env = { ctx: createFixedContext('t', '2026-11-05T10:00:00.000Z'), rulesetVersion: ACTIVE_RULESET.version };
const SPEC: DemoPassportSpec = {
  objectId: 'obj-x',
  name: 'Тест',
  ean: { offtake: '541448800000000017', injection: '541448800000000024' },
  assets: [
    { id: 'pv-1', type: 'pv', prefix: 'PV1' },
    { id: 'battery-1', type: 'battery', prefix: 'Battery1' },
    { id: 'battery-2', type: 'battery', prefix: 'Battery2' },
  ],
};
const run = (o: TelemetryGenOptions = {}, spec: DemoPassportSpec = SPEC) => {
  const passport = demoPassport(spec);
  const ds = buildTelemetryDataset(passport, o);
  const results = validateTelemetryReport(ds, passport, rules, env);
  const status = (id: string): ValidationStatus | undefined => results.find((r) => r.ruleId === id)?.status;
  const sig = (name: string) => ds.report.signals.find((s) => s.signal === name)!;
  return { passport, ds, results, status, sig, failed: results.filter((r) => r.status === 'FAILED').map((r) => r.ruleId) };
};

describe('object.json', () => {
  it('читает поля паспорта и активы с номерами', () => {
    const p = parseObjectJson(demoObjectJson(SPEC), { version: 1, source: 'DEMO', fileName: 'object.json', loadedAt: 'x' });
    expect(p.assets.map((a) => [a.assetId, a.type, a.prefix])).toEqual([
      ['pv-1', 'PV', 'PV1'],
      ['battery-1', 'BATTERY', 'Battery1'],
      ['battery-2', 'BATTERY', 'Battery2'],
    ]);
    expect(p.dataFiles).toEqual({ invoice: 'invoice.csv', telemetry: 'telemetry.csv' });
    expect(p.csvFormat.stepMinutes).toBe(15);
  });

  it('неизвестный тип актива не превращается в оборудование', () => {
    const j = demoObjectJson(SPEC);
    j.assets.push({ asset_id: 'ev-1', type: 'ev_charger', signals: [] });
    const p = parseObjectJson(j, { version: 1, source: 'DEMO', fileName: 'object.json', loadedAt: 'x' });
    expect(p.assets).toHaveLength(3);
    expect(p.warnings[0]).toMatch(/ev-1/);
  });

  it('некорректный паспорт отклоняется с понятной причиной', () => {
    expect(() => parseObjectJson({ name: 'x' }, { version: 1, source: 'DEMO', fileName: 'o', loadedAt: 'x' })).toThrow(PassportFormatError);
  });

  it('обязательные сигналы по каждому активу; total – не сигнал оборудования', () => {
    const req = requiredSignals(demoPassport(SPEC), rules).map((r) => r.signal);
    expect(req).toContain('Battery2.SOC_%');
    expect(req).toContain('PV1.power_kW.setpoint_received');
    expect(req.filter((s) => s.startsWith('Grid'))).toHaveLength(3);
    expect(req.some((s) => s.includes('total'))).toBe(false);
    expect(isTotalSignal('PV.power_kW.total')).toBe(true);
    expect(isTotalSignal('Battery.energy_kWh.total_charge')).toBe(true);
    expect(isTotalSignal('Battery1.power_kW')).toBe(false);
  });
});

describe('telemetry.csv – этап 2', () => {
  it('корректный поток проходит все проверки; 192 интервала за 48 ч', () => {
    const { failed, sig } = run();
    expect(failed).toEqual([]);
    expect(sig('Battery2.SOC_%')).toMatchObject({ expected: 192, received: 192, completenessPct: 100, diagnosis: 'OK' });
  });

  it('нет связи с батареей ≠ неисправность: диагноз NO_COMMUNICATION', () => {
    const { sig, failed, results } = run({ silentAssets: ['Battery2'] });
    expect(sig('Battery2.power_kW').diagnosis).toBe('NO_COMMUNICATION');
    expect(sig('Battery1.power_kW').diagnosis).toBe('OK');
    expect(failed).toContain('TM-003');
    expect(results.find((r) => r.ruleId === 'TM-003')!.message).toMatch(/не означает неисправность/);
  });

  it('нет колонки – отсутствие сигнала; нет в карте – неполная карта', () => {
    expect(run({ dropSignals: ['PV1.power_kW.setpoint_received'] }).sig('PV1.power_kW.setpoint_received').diagnosis).toBe('NOT_IN_DATA');
    const r = run({}, { ...SPEC, omitFromMap: ['Battery1.setpoint_sent'] });
    expect(r.status('TM-002')).toBe('FAILED');
    expect(r.sig('Battery1.setpoint_sent').diagnosis).toBe('NOT_IN_MAP');
  });

  it('ошибочная привязка: чужой актив и чужой object_id', () => {
    const r = run({ renamePrefix: { from: 'Battery2', to: 'Battery3' }, objectIdInFile: 'OTHER' });
    expect(r.sig('Battery2.power_kW').diagnosis).toBe('WRONG_BINDING');
    expect(r.ds.report.foreignColumns).toContain('Battery3.power_kW');
    expect(r.status('TM-004')).toBe('FAILED');
  });

  it('актуальность: последнее значение старше 30 минут', () => {
    const r = run({ staleMinutes: 60 });
    expect(r.sig('Grid.power_kW').ageMinutes).toBe(60);
    expect(r.sig('Grid.power_kW').heat.endsWith('DDDD')).toBe(true);
    expect(r.status('TM-005')).toBe('FAILED');
  });

  it('полнота считается отдельно по каждому сигналу', () => {
    const r = run({ staleMinutes: 30, stalePrefixes: ['PV1'] });
    expect(r.sig('PV1.power_kW').missing).toBe(2);
    expect(r.sig('Grid.power_kW').missing).toBe(0);
    expect(r.status('TM-006')).toBe('FAILED');
  });

  it('правдоподобность: отрицательная PV, SoC вне диапазона, знак батареи, неоднозначное время, единицы', () => {
    expect(run({ negativePv: 2 }).ds.report.issueCounts.NEGATIVE_PV).toBe(2);
    expect(run({ socOutOfRange: 1 }).status('TM-008')).toBe('FAILED');
    expect(run({ batterySignErrors: 3 }).ds.report.issueCounts.SIGN_ERROR).toBeGreaterThan(0);
    expect(run({ naiveTimestamps: 2 }).status('TM-009')).toBe('FAILED');
    expect(run({ wrongUnit: { signal: 'Battery1.SOC_%', unit: 'kWh' } }).status('TM-007')).toBe('FAILED');
  });

  it('без паспорта и без данных – не успех', () => {
    const noPassport = validateTelemetryReport(undefined, undefined, rules, env);
    expect(noPassport.find((r) => r.ruleId === 'TM-001')!.status).toBe('FAILED');
    const passport = demoPassport(SPEC);
    expect(validateTelemetryReport(undefined, passport, rules, env).filter((r) => r.blocking).every((r) => r.status !== 'PASSED' || ['TM-001', 'TM-002'].includes(r.ruleId))).toBe(true);
  });

  it('потоковый импорт CSV даёт тот же отчёт, что генератор', async () => {
    const passport = demoPassport(SPEC);
    const o = { staleMinutes: 45, socOutOfRange: 1 };
    const fromCsv = await importTelemetry(telemetryCsvText(passport, o), passport, rules, { fileName: 'telemetry.csv', uploadedAt: '2026-11-05T09:55:00.000Z', source: 'DEMO' });
    const direct = buildTelemetryDataset(passport, o).report;
    expect({ ...fromCsv, meta: { ...fromCsv.meta, sizeBytes: 0 } }).toEqual({ ...direct, meta: { ...direct.meta, sizeBytes: 0 } });
  });
});

describe('учёт замечаний (сверка с набором кейса 4)', () => {
  it('недопустимый SoC (140 %) – одна ошибка TM-008, а не ещё и «скачок» от него к нормальному значению', () => {
    const { ds } = run({ socOutOfRange: 3 });
    // 3 интервала × 2 батареи паспорта
    expect(ds.report.issueCounts.SOC_OUT_OF_RANGE).toBe(6);
    expect(ds.report.issueCounts.SOC_JUMP ?? 0).toBe(0);
  });

  it('редкие ошибки не вытесняются из списка массовыми замечаниями (3 500 расхождений уставок и 1 ошибка знака после трёхтысячной строки)', async () => {
    const passport = demoPassport({ ...SPEC, assets: [{ id: 'battery-1', type: 'battery', prefix: 'Battery1' }] });
    const head = 'timestamp (UTC);object_id;Battery1.power_kW (kW);Battery1.energy_kWh.charge (kWh);Battery1.energy_kWh.discharge (kWh);Battery1.power_kW.setpoint_sent (kW);Battery1.power_kW.setpoint_received (kW)';
    const t0 = Date.parse('2026-11-05T10:00:00Z') - 3500 * 15 * 60_000;
    const rows = Array.from({ length: 3500 }, (_, i) => `${new Date(t0 + i * 15 * 60_000).toISOString().replace('.000Z', 'Z')};obj-x;${i === 3400 ? '-10' : '10'};2,5;0;10;5`);
    const report = await importTelemetry([head, ...rows].join('\n'), passport, rules, { fileName: 'telemetry.csv', uploadedAt: '2026-11-05T09:55:00.000Z', source: 'DEMO' });
    expect(report.issueCounts.SETPOINT_MISMATCH).toBe(3500);
    expect(report.issueCounts.SIGN_ERROR).toBe(1);
    expect(report.issues.filter((i) => i.type === 'SIGN_ERROR').map((i) => i.signal)).toEqual(['Battery1.power_kW']);
  });
});
