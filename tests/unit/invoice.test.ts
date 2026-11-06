import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { buildInvoiceDataset, DEMO_OBJECT, invoiceCsvText, type InvoiceGenOptions } from '@/data/mock';
import { createFixedContext, isValidEan, validateInvoice } from '@/engine';
import { importInvoice } from '@/services/invoice-import';
import type { EnergyObject, ValidationStatus } from '@/types';

const rules = ACTIVE_RULESET.meterHistory;
const env = { ctx: createFixedContext('t', '2026-11-05T00:00:00.000Z'), rulesetVersion: ACTIVE_RULESET.version };
const run = (o: Partial<InvoiceGenOptions>, object: EnergyObject = DEMO_OBJECT) => {
  const ds = buildInvoiceDataset({ objectId: object.id, ...o });
  const results = validateInvoice(ds, object, rules, env);
  const status = (id: string): ValidationStatus | undefined => results.find((r) => r.ruleId === id)?.status;
  return { ds, results, status, failed: results.filter((r) => r.status === 'FAILED').map((r) => r.ruleId) };
};

describe('invoice.csv — этап 1', () => {
  it('полная корректная история проходит все обязательные проверки', () => {
    const { failed, ds } = run({});
    expect(failed).toEqual([]);
    expect(ds.report.window!.months).toHaveLength(24);
    expect(ds.report.completeness.pct).toBe(100);
    expect(ds.report.detectedStepMinutes).toBe(15);
  });

  it('19 из 24 месяцев: перечислены 5 недостающих месяцев, покрытие и полнота не пройдены', () => {
    const { ds, failed } = run({ missingFirstMonths: 5 });
    expect(ds.report.missingMonths).toEqual(['2024-11', '2024-12', '2025-01', '2025-02', '2025-03']);
    expect(failed).toEqual(['MH-002', 'MH-004']);
  });

  it('пропуски указаны интервалом; начальная и конечная даты не подменяют полноту', () => {
    const { ds, status } = run({ gaps: [['2025-06-10T00:00:00Z', 96]] });
    expect(status('MH-002')).toBe('PASSED');
    expect(status('MH-004')).toBe('FAILED');
    const gap = ds.report.issues.find((i) => i.type === 'MISSING_INTERVAL')!;
    expect(gap).toMatchObject({ timestamp: '2025-06-10T00:00:00.000Z', timestampTo: '2025-06-11T00:00:00.000Z', value: '96 интервалов' });
  });

  it('дубли не повышают полноту', () => {
    const { ds, status } = run({ duplicates: 3 });
    expect(ds.report.duplicates).toBe(3);
    expect(status('MH-005')).toBe('FAILED');
    expect(ds.report.completeness.pct).toBe(100);
  });

  it('часовая история хранится в исходной детализации и не считается полной', () => {
    const { ds, status } = run({ stepMinutes: 60 });
    expect(ds.report.detectedStepMinutes).toBe(60);
    expect(ds.report.completeness.pct).toBe(25);
    expect(status('MH-003')).toBe('FAILED');
    expect(status('MH-004')).toBe('FAILED');
  });

  it('единицы, знаки, пустые значения, время не в UTC', () => {
    expect(run({ wrongUnit: { field: 'Grid.energy_kWh.injection_invoice', unit: 'Wh' } }).status('MH-007')).toBe('FAILED');
    expect(run({ mixedUnitRows: 5 }).ds.report.issueCounts.MIXED_UNITS).toBeGreaterThan(0);
    expect(run({ signErrors: 4 }).status('MH-008')).toBe('FAILED');
    expect(run({ emptyCells: 2 }).status('MH-009')).toBe('FAILED');
    expect(run({ invalidTimestamps: 2 }).status('MH-006')).toBe('FAILED');
  });

  it('EAN: паспорт, контрольная цифра, совпадение с файлом, привязка через data_files', () => {
    expect(isValidEan('541448800000000017', 18)).toBe(true);
    expect(isValidEan('541448800000000018', 18)).toBe(false);
    const badPassport = { ...DEMO_OBJECT, gridConnection: { ...DEMO_OBJECT.gridConnection, eanInjection: null } };
    expect(run({}, badPassport).status('MH-011')).toBe('FAILED');
    expect(run({ ean: { offtake: '541448800000000017', injection: '541448800000000024' } }).status('MH-012')).toBe('PASSED');
    expect(run({ ean: { offtake: '541448800000099999', injection: '541448800000000024' } }).status('MH-012')).toBe('FAILED');
    const unregistered = { ...DEMO_OBJECT, passport: { ...DEMO_OBJECT.passport, dataFiles: { invoice: null, telemetry: null } } };
    expect(run({}, unregistered).status('MH-012')).toBe('FAILED');
  });

  it('без данных — не успех', () => {
    const results = validateInvoice(undefined, DEMO_OBJECT, rules, env);
    expect(results.find((r) => r.ruleId === 'MH-001')?.status).toBe('FAILED');
    expect(results.filter((r) => r.ruleId !== 'MH-001' && r.ruleId !== 'MH-011').every((r) => r.status === 'SKIPPED')).toBe(true);
  });

  it('потоковый импорт CSV (PapaParse, BOM, «;», запятая) даёт тот же отчёт, что генератор', async () => {
    const o: InvoiceGenOptions = { objectId: 'x', missingFirstMonths: 2, duplicates: 2, signErrors: 2 };
    const fromCsv = await importInvoice(invoiceCsvText(o), rules, { fileName: 'invoice.csv', uploadedAt: '2026-11-01T06:00:00.000Z', source: 'DEMO' });
    const direct = buildInvoiceDataset(o).report;
    expect(fromCsv.meta.format).toEqual({ bom: true, delimiter: ';', decimal: ',', encoding: 'UTF-8' });
    expect({ ...fromCsv, meta: { ...fromCsv.meta, sizeBytes: 0 } }).toEqual({ ...direct, meta: { ...direct.meta, sizeBytes: 0 } });
  });

  it('воспроизводимость: одинаковые входы — одинаковый отчёт', () => {
    expect(run({ duplicates: 3, seed: 5 }).ds).toEqual(run({ duplicates: 3, seed: 5 }).ds);
  });
});
