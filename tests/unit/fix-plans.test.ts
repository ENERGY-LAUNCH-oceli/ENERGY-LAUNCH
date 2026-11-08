import { describe, expect, it } from 'vitest';
import { buildFixPlan } from '@/features/fix/fix-plans';
import type { ControlAsset, SitePassport, ValidationResult } from '@/types';

const passport = (ean: { offtake: string | null; injection: string | null }): SitePassport => ({
  version: 1, source: 'UPLOAD', fileName: 'object.json', loadedAt: '', objectId: 'b5', name: 'Building 5', address: null, coordinates: null, timezone: 'Europe/Brussels', ean,
  assets: [{ assetId: 'PV1', type: 'PV', prefix: 'PV1', signals: ['PV1.power_kW (kW)'] }], siteSignals: ['Grid.power_kW (kW)'], dataFiles: { invoice: 'invoice.csv', telemetry: 'telemetry.csv' },
  csvFormat: { delimiter: ';', decimal: ',', encoding: 'UTF-8', stepMinutes: 15 }, warnings: [],
});
const failed = (ruleId: string, message: string, details: Record<string, unknown> = {}) => ({ id: 'r', ruleId, stageId: 'METER_HISTORY', status: 'FAILED', severity: 'CRITICAL', blocking: true, message, details, evaluatedAt: '', rulesetVersion: '1.5.0' }) as unknown as ValidationResult;

describe('помощник исправления', () => {
  it('EAN: неверная контрольная цифра и 17 цифр – исправление паспорта, верный код не трогается', () => {
    const p = passport({ offtake: '541448899000000073', injection: '541448899000000143' });
    const plan = buildFixPlan(failed('MH-011', 'EAN injection: контрольная цифра'), p)!;
    expect(plan.facts.map((f) => f.tone)).toEqual(['ok', 'bad']);
    expect(plan.options).toHaveLength(1);
    expect(plan.options[0]!.change).toEqual({ from: '541448899000000143', to: '541448899000000141' });
    expect(plan.options[0]!.passport!(p).ean).toEqual({ offtake: '541448899000000073', injection: '541448899000000141' });

    const short = buildFixPlan(failed('MH-011', '17 цифр'), passport({ offtake: '54144889900000007', injection: '541448899000000141' }))!;
    expect(short.options[0]!.change!.to).toHaveLength(18);
    expect(short.options[0]!.change!.to.startsWith('54144889900000007')).toBe(true);
  });

  it('карта сигналов: недостающие сигналы добавляются к активу или объекту с единицами', () => {
    const p = passport({ offtake: null, injection: null });
    const plan = buildFixPlan(failed('TM-002', 'Карта сигналов неполная', { signals: ['PV1.power_kW.setpoint_received', 'Grid.energy_kWh.offtake'] }), p)!;
    const next = plan.options[0]!.passport!(p);
    expect(next.assets[0]!.signals).toContain('PV1.power_kW.setpoint_received (kW)');
    expect(next.siteSignals).toContain('Grid.energy_kWh.offtake (kWh)');
  });

  it('данные счётчиков не правятся – запрос источнику с точными месяцами и тур к загрузке', () => {
    const plan = buildFixPlan(failed('MH-002', 'История покрывает 15 из 24 месяцев', { missingMonths: ['2024-11', '2024-12'] }), passport({ offtake: null, injection: null }))!;
    expect(plan.options).toEqual([]);
    expect(plan.request).toContain('2024-11, 2024-12');
    expect(plan.tour.at(-2)!.target).toBe('#mh-upload');
    // Пройденная проверка и проверки без помощника – кнопки нет
    expect(buildFixPlan({ ...failed('MH-002', ''), status: 'PASSED' } as ValidationResult, undefined)).toBeNull();
    expect(buildFixPlan(failed('DB-016', ''), undefined)).toBeNull();
  });

  it('управление: тест каждому непроверенному активу с допустимым значением, только имитатор', () => {
    const asset = (assetId: string, type: 'PV' | 'BATTERY', currentPowerKw: number) => ({ assetId, type, prefix: assetId, kind: type === 'PV' ? 'PV_CURTAILMENT' : 'BATTERY_SETPOINT', supported: true, signals: {}, link: 'OK', bench: { ratedPowerKw: type === 'PV' ? 60 : 100, currentPowerKw, socPct: 50, controller: 'ONLINE' } }) as unknown as ControlAsset;
    const assets = [asset('PV1', 'PV', 44), asset('PV2', 'PV', 41), asset('Battery1', 'BATTERY', -5)];
    const plan = buildFixPlan(failed('CT-011', 'Нет отправленной тестовой команды: PV2, Battery1', { assets: ['PV2', 'Battery1'] }), undefined, assets)!;
    expect(plan.options[0]!.control!.map((c) => c.assetId)).toEqual(['PV2', 'Battery1']);
    // PV – ниже текущей выработки, батарея – в пределах номинала
    const pv = plan.options[0]!.control!.find((c) => c.assetId === 'PV2')!;
    const bat = plan.options[0]!.control!.find((c) => c.assetId === 'Battery1')!;
    expect(pv.valueKw).toBeLessThanOrEqual(41 - 5);
    expect(Math.abs(bat.valueKw)).toBeLessThanOrEqual(100);
    expect(plan.tour[0]!.target).toBe('#ct-assets');
    // Без описания активов (не страница управления) – помощника нет
    expect(buildFixPlan(failed('CT-011', ''), undefined, [])).toBeNull();
  });
});
