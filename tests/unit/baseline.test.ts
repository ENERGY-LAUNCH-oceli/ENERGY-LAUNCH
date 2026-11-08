import { describe, expect, it } from 'vitest';
import { RULESET_V1_5 } from '@/config/rules';
import { manualChecklistCsv, median, parseMinutes, SCENARIOS, timeReduction } from '@/scenarios';

describe('сравнение с ручным чек-листом (ТЗ 6.1 п. 5)', () => {
  it('медиана: нечётное и чётное число значений', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('пример ТЗ: 10 мин вручную, 6 мин с прототипом – ΔT 40 %', () => {
    expect(timeReduction([{ manualMin: 10, protoMin: 6 }])).toMatchObject({ manualMedianMin: 10, protoMedianMin: 6, deltaPct: 40, passed: true });
  });

  it('ΔT по медианам шести сценариев; меньше 30 % – цель не достигнута', () => {
    const rows = [8, 10, 12, 9, 11, 14].map((m) => ({ manualMin: m, protoMin: m * 0.8 }));
    const r = timeReduction(rows);
    expect(r.manualMedianMin).toBe(10.5);
    expect(r.deltaPct).toBe(20);
    expect(r.passed).toBe(false);
  });

  it('пока ручное время не замерено по всем сценариям – «не измерено», ничего не подставляется', () => {
    const r = timeReduction([{ manualMin: 10, protoMin: 1 }, { protoMin: 1 }]);
    expect(r).toMatchObject({ measured: 1, total: 2, deltaPct: null, passed: null, manualMedianMin: null });
    expect(timeReduction([]).deltaPct).toBeNull();
  });

  it('разбор минут из поля: запятая, пусто, ноль', () => {
    expect(parseMinutes('7,5')).toBe(7.5);
    expect(parseMinutes('')).toBeUndefined();
    expect(parseMinutes('0')).toBeUndefined();
    expect(parseMinutes('abc')).toBeUndefined();
  });

  it('для метрики отмечены ровно 6 оценочных сценариев', () => {
    expect(SCENARIOS.filter((s) => s.evaluation)).toHaveLength(6);
  });

  it('ручной чек-лист – те же правила, что у прототипа, для выбранной версии набора', () => {
    const csv = manualChecklistCsv();
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('набор правил 1.6.0');
    for (const id of ['MH-002', 'TM-004', 'CT-013', 'CT-017', 'DB-015']) expect(csv).toContain(`"${id}"`);
    expect(csv).not.toContain('"CT-004"');
    expect(manualChecklistCsv(RULESET_V1_5.version)).not.toContain('"CT-017"');
  });
});
