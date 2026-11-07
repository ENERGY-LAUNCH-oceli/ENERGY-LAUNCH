import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { buildTelemetryDataset, demoPassport } from '@/data/mock';
import { createFixedContext } from '@/engine';
import { validateControlTesting } from '@/engine/control/rules';
import { createDashboardWorkspace } from '@/engine/dashboards';
import { evaluateBlocks } from '@/engine/dashboards/evaluate';
import { specificAction } from '@/engine/next-action';
import { importInvoice } from '@/services/invoice-import';
import type { LaunchInputs } from '@/types';

const env = { ctx: createFixedContext('t', '2026-11-05T10:00:00.000Z'), rulesetVersion: ACTIVE_RULESET.version };
const noAssets = demoPassport({ objectId: 'obj-na', name: 'Без активов', ean: { offtake: '541448800000000017', injection: '541448800000000024' }, assets: [] });

/** Объект без PV и батарей (как Building1 и Building5 кейса 4): «Не применимо» при подтверждённом отсутствии актива (ТЗ). */
describe('объект без управляемых активов', () => {
  it('проверки управления не применимы, а не заблокированы', () => {
    const r = validateControlTesting(noAssets, [], ACTIVE_RULESET.controlTesting!, env);
    for (const id of ['CT-011', 'CT-012', 'CT-013', 'CT-014', 'CT-015']) expect(r.find((x) => x.ruleId === id)?.status, id).toBe('NOT_APPLICABLE');
    expect(r.filter((x) => x.blocking && x.status === 'FAILED')).toEqual([]);
  });

  it('активы есть, но тестов нет – этап по-прежнему не проходит', () => {
    const withPv = demoPassport({ objectId: 'obj-pv', name: 'PV', ean: { offtake: '541448800000000017', injection: '541448800000000024' }, assets: [{ id: 'pv-1', type: 'pv', prefix: 'PV1' }] });
    const r = validateControlTesting(withPv, [], ACTIVE_RULESET.controlTesting!, env);
    expect(r.find((x) => x.ruleId === 'CT-011')?.status).toBe('FAILED');
  });

  it('блоки дашборда «Текущие активы» и «Управление» показывают отсутствие активов, а не ошибку', () => {
    const ws = createDashboardWorkspace('obj-na', '2026-11-05T10:00:00.000Z', 'тест');
    const inputs = { object: { id: 'obj-na' }, passport: noAssets, telemetry: buildTelemetryDataset(noAssets), controlCommands: [] } as unknown as LaunchInputs;
    const ev = evaluateBlocks(ws.draft, inputs, ACTIVE_RULESET.dashboardConfig!);
    expect(ev.ASSETS.ok).toBe(true);
    expect(ev.CONTROL.ok).toBe(true);
    expect(ev.CONTROL.notApplicable.join(' ')).toMatch(/нет управляемых активов/);
  });

  it('подсказка блока: проблема данных – добавить данные, а не «включить виджеты»', () => {
    expect(specificAction('DB-012', { dataIssues: ['Нет телеметрии объекта (telemetry.csv)'], fields: [] })).toBe('Добавить данные для блока: Нет телеметрии объекта (telemetry.csv)');
    expect(specificAction('DB-012', { dataIssues: [], fields: ['Мощность PV'] })).toBe('Включить обязательные виджеты: Мощность PV');
  });
});

/** Выбросы: энергия за 15 мин больше договорной мощности × 15 мин × 1,5 физически невозможна (Building4 кейса 4). */
describe('выбросы в истории счётчиков', () => {
  const head = 'timestamp (UTC);Grid.energy_kWh.offtake_invoice (kWh);Grid.energy_kWh.offtake_invoice_validated (kWh);Grid.energy_kWh.injection_invoice (kWh);Grid.energy_kWh.injection_invoice_validated (kWh);Grid.power_kW.invoice (kW);Grid.power_kW.CA_offtake (kW);Grid.power_kW.CA_injection (kW)';
  const row = (t: string, off: string, offV: string, ca: string) => `${t};${off};${offV};0;0;;${ca};${ca ? '-160' : ''}`;

  it('значение больше предела – MH-008; в строках до первой известной CA предел – по первой CA', async () => {
    const csv = [head, row('2025-01-01T00:00:00Z', '25,25', '1515', ''), row('2025-01-01T00:15:00Z', '20', '20', ''), row('2025-01-01T00:30:00Z', '18,75', '1125', '300'), row('2025-01-01T00:45:00Z', '10', '10', '300')].join('\n');
    const r = await importInvoice(csv, ACTIVE_RULESET.meterHistory, { fileName: 'invoice.csv' });
    const over = r.issues.filter((i) => i.type === 'OVER_CAPACITY');
    expect(over.map((i) => [i.timestamp?.slice(0, 16), i.value])).toEqual(
      expect.arrayContaining([
        ['2025-01-01T00:30', '1125'],
        ['2025-01-01T00:00', '1515'],
      ]),
    );
    expect(over).toHaveLength(2);
    expect(over[0]!.ruleId).toBe('MH-008');
  });
});
