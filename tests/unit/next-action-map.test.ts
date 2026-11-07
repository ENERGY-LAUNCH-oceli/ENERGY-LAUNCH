import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { NEXT_ACTION_BY_RULE, specificAction } from '@/engine/next-action';
import { getRulesForStage } from '@/engine/rules/catalog';

/** «Следующее действие» соответствует действующим правилам – а не нумерации старых наборов (раньше TM-002 «карта сигналов» подсказывала «настроить шаг передачи»). */
describe('следующее действие по правилам', () => {
  for (const stage of ['METER_HISTORY', 'REALTIME_TELEMETRY'] as const) {
    it(`у каждого правила этапа ${stage} (набор ${ACTIVE_RULESET.version}) есть своя подсказка`, () => {
      const missing = getRulesForStage(stage, ACTIVE_RULESET.version).filter((r) => !NEXT_ACTION_BY_RULE[r.id]).map((r) => r.id);
      expect(missing).toEqual([]);
    });
  }

  it('подсказки телеметрии говорят о том же, что проверяет правило', () => {
    expect(NEXT_ACTION_BY_RULE['TM-002']).toMatch(/карт[уы] сигналов/);
    expect(NEXT_ACTION_BY_RULE['TM-004']).toMatch(/этого объекта/);
    expect(NEXT_ACTION_BY_RULE['TM-008']).toMatch(/знак/);
  });

  it('систематически обратный знак – исправить знак в источнике, а не отдельные значения', () => {
    expect(specificAction('TM-008', { signals: ['Grid.power_kW'], systematic: ['Grid.power_kW'] })).toBe('Исправить знак Grid.power_kW в источнике телеметрии и выгрузить заново');
    expect(specificAction('TM-008', { signals: ['Battery.power_kW'], systematic: [] })).toBe('Исправить знаки и диапазоны в telemetry.csv: Battery.power_kW');
    expect(specificAction('TM-002', { signals: ['Grid.power_kW', 'Grid.energy_kWh.offtake', 'Grid.energy_kWh.injection', 'Demand.power_kW'] })).toBe('Дополнить карту сигналов паспорта object.json: Grid.power_kW, Grid.energy_kWh.offtake, Grid.energy_kWh.injection и ещё 1');
  });

  it('знаки в истории счётчиков: поле и интервалы; много нарушений – с какого и сколько', () => {
    const ex = [{ timestamp: '2025-05-14T12:30:00Z', value: '-750' }, { timestamp: '2025-09-05T14:00:00Z', value: '-200' }];
    expect(specificAction('MH-008', { fields: ['Grid.energy_kWh.injection_invoice_validated'], examples: ex, count: 2 })).toBe('Исправить знак Grid.energy_kWh.injection_invoice_validated в выгрузке: 14.05.2025 12:30 UTC (-750), 05.09.2025 14:00 UTC (-200)');
    expect(specificAction('MH-008', { fields: ['Grid.power_kW.CA_injection'], examples: [{ timestamp: '2025-06-23T12:45:00Z', value: '2750' }], count: 2919 })).toMatch(/^Исправить знак Grid\.power_kW\.CA_injection в выгрузке: с 23\.06\.2025 12:45 UTC, всего 2\s919 интервалов$/);
  });
});
