import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET, RULESET_V1_2, RULESET_V1_5 } from '@/config/rules';
import { buildControlCommands, demoPassport, type DemoPassportSpec } from '@/data/mock';
import {
  checkCommandValue,
  controlAssets,
  createFixedContext,
  executeControlTest,
  getRulesForStage,
  UnsafeTransportError,
  validateControlTesting,
  type ControlTestRequest,
} from '@/engine';
import { createSimulatorTransport, type ControlTransport } from '@/simulator/control';
import type { ControlAsset, SimScenario } from '@/types';

const rules = ACTIVE_RULESET.controlTesting!;
const env = { ctx: createFixedContext('t', '2026-11-05T10:00:00.000Z'), rulesetVersion: ACTIVE_RULESET.version };
const transport = createSimulatorTransport();
const SPEC: DemoPassportSpec = {
  objectId: 'obj-x',
  name: 'Тест',
  ean: { offtake: '541448800000000017', injection: '541448800000000024' },
  assets: [
    { id: 'pv-1', type: 'pv', prefix: 'PV1' },
    { id: 'battery-1', type: 'battery', prefix: 'Battery1' },
  ],
};
const passport = demoPassport(SPEC);
const assets = controlAssets(passport, undefined, transport.describe);
const asset = (id: string) => assets.find((a) => a.assetId === id)!;

const req = (a: ControlAsset, valueKw: number, scenario: SimScenario, n = 1): ControlTestRequest => ({
  objectId: 'obj-x',
  asset: a,
  valueKw,
  scenario,
  commandId: `CMD-X-${String(n).padStart(3, '0')}`,
  createdAt: '2026-11-05T09:00:00.000Z',
  actor: 'test',
  rulesetVersion: ACTIVE_RULESET.version,
});
const states = (c: { history: { state: string }[] }) => c.history.map((h) => h.state);

describe('имитатор и тест управления', () => {
  it('управляемые активы и сигналы берутся из паспорта', () => {
    expect(asset('battery-1')).toMatchObject({ kind: 'BATTERY_SETPOINT', supported: true, signals: { sent: 'Battery1.power_kW.setpoint_sent', received: 'Battery1.power_kW.setpoint_received', actual: 'Battery1.power_kW' } });
    expect(asset('pv-1')).toMatchObject({ kind: 'PV_CURTAILMENT', supported: true, signals: { sent: null, received: 'PV1.power_kW.setpoint_received' } });
  });

  it('успешная отправка и отклик: Created → Sent → Received → Responded → Passed', () => {
    const c = executeControlTest(req(asset('battery-1'), 50, 'NOMINAL'), rules, transport);
    expect(states(c)).toEqual(['CREATED', 'SENT', 'RECEIVED', 'RESPONDED', 'PASSED']);
    expect(c.state).toBe('PASSED');
    expect(c.receivedValueKw).toBe(50);
    expect(c.responseSec!).toBeLessThanOrEqual(rules.responseWindowSec);
    expect(Math.abs(c.actualKw! - 50)).toBeLessThanOrEqual(c.expected.toleranceKw);
  });

  it('отправка без подтверждения – Timeout, отправка сама по себе не успех', () => {
    const c = executeControlTest(req(asset('battery-1'), 50, 'NO_ACK'), rules, transport);
    expect(states(c)).toEqual(['CREATED', 'SENT', 'TIMEOUT']);
    expect(c.sentAt).not.toBeNull();
    expect(c.receivedAt).toBeNull();
  });

  it('подтверждение без отклика – Failed', () => {
    const c = executeControlTest(req(asset('battery-1'), 50, 'NO_RESPONSE'), rules, transport);
    expect(states(c)).toEqual(['CREATED', 'SENT', 'RECEIVED', 'FAILED']);
    expect(c.respondedAt).toBeNull();
  });

  it('отклик позже ожидаемого интервала – Timeout, момент отклика сохранён', () => {
    const c = executeControlTest(req(asset('battery-1'), 50, 'SLOW_RESPONSE'), rules, transport);
    expect(states(c)).toEqual(['CREATED', 'SENT', 'RECEIVED', 'TIMEOUT']);
    expect(c.responseSec!).toBeGreaterThan(rules.responseWindowSec);
  });

  it('некорректное значение не отправляется даже в имитатор', () => {
    const c = executeControlTest(req(asset('battery-1'), 150, 'INVALID_VALUE'), rules, transport);
    expect(states(c)).toEqual(['CREATED', 'FAILED']);
    expect(c.sentAt).toBeNull();
    expect(c.samples).toEqual([]);
    expect(c.reason).toMatch(/не отправлена/);
    expect(checkCommandValue(asset('battery-1'), asset('battery-1').bench.currentPowerKw + 1, rules)).toMatch(/отклик не наблюдаем/);
  });

  it('PV: ограничение выработки проверяет принятый setpoint и снижение фактической мощности', () => {
    const pv = asset('pv-1');
    const c = executeControlTest(req(pv, 20, 'NOMINAL'), rules, transport);
    expect(c.state).toBe('PASSED');
    expect(c.receivedValueKw).toBe(20);
    expect(c.actualKw!).toBeLessThanOrEqual(c.expected.upperKw);
    expect(checkCommandValue(pv, pv.bench.currentPowerKw + 5, rules)).toMatch(/ниже текущей выработки/);
  });

  it('воспроизводимость: одинаковые входы – одинаковый результат', () => {
    for (const s of ['NOMINAL', 'NO_ACK', 'NO_RESPONSE', 'SLOW_RESPONSE'] as const) {
      expect(executeControlTest(req(asset('battery-1'), -40, s), rules, transport)).toEqual(executeControlTest(req(asset('battery-1'), -40, s), rules, transport));
    }
  });

  it('движок отклоняет любой транспорт, кроме имитатора', () => {
    const real = { ...transport, kind: 'MODBUS' } as unknown as ControlTransport;
    expect(() => executeControlTest(req(asset('battery-1'), 50, 'NOMINAL'), rules, real)).toThrow(UnsafeTransportError);
  });

  it('имитатор и логика управления не используют сеть', () => {
    const forbidden = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\b|from ['"](node:)?(http|https|net|dgram)['"]/;
    for (const dir of ['src/simulator/control', 'src/engine/control']) {
      for (const f of readdirSync(dir)) {
        const text = readFileSync(join(dir, f), 'utf-8');
        expect(forbidden.test(text), `${dir}/${f}`).toBe(false);
      }
    }
  });
});

describe('правила этапа 3 (v1.3.0)', () => {
  const build = (plan: Parameters<typeof buildControlCommands>[0]['plan'], spec = SPEC) =>
    buildControlCommands({ passport: demoPassport(spec), objectCode: 'X', plan, startAt: '2026-11-05T09:00:00.000Z', actor: 'test' });
  const statusOf = (results: ReturnType<typeof validateControlTesting>, id: string) => results.find((r) => r.ruleId === id)?.status;

  it('все обязательные тесты пройдены – этап проходит', () => {
    const r = validateControlTesting(passport, build([{ assetId: 'battery-1', scenario: 'NOMINAL' }, { assetId: 'pv-1', scenario: 'NOMINAL' }]), rules, env);
    expect(r.filter((x) => x.blocking && x.status !== 'PASSED')).toEqual([]);
  });

  it('без тестов этап не проходит: отправки нет', () => {
    const r = validateControlTesting(passport, [], rules, env);
    expect(statusOf(r, 'CT-011')).toBe('FAILED');
    expect(statusOf(r, 'CT-012')).toBe('SKIPPED');
  });

  it('команда отправлена, но отклика нет – этап остаётся незавершённым', () => {
    const r = validateControlTesting(passport, build([{ assetId: 'battery-1', scenario: 'NO_RESPONSE' }, { assetId: 'pv-1', scenario: 'NOMINAL' }]), rules, env);
    expect(statusOf(r, 'CT-011')).toBe('PASSED');
    expect(statusOf(r, 'CT-012')).toBe('PASSED');
    expect(statusOf(r, 'CT-013')).toBe('FAILED');
    expect(statusOf(r, 'CT-014')).toBe('FAILED');
  });

  it('решает последний тест актива; отклонённое значение – предупреждение, не блокер', () => {
    const r = validateControlTesting(
      passport,
      build([{ assetId: 'battery-1', scenario: 'INVALID_VALUE' }, { assetId: 'battery-1', scenario: 'NOMINAL' }, { assetId: 'pv-1', scenario: 'NOMINAL' }]),
      rules,
      env,
    );
    expect(statusOf(r, 'CT-014')).toBe('PASSED');
    expect(statusOf(r, 'CT-016')).toBe('WARNING');
    expect(r.filter((x) => x.blocking && x.status !== 'PASSED')).toEqual([]);
  });

  it('нет PV в паспорте – тест PV Not Applicable', () => {
    const spec: DemoPassportSpec = { ...SPEC, assets: [{ id: 'battery-1', type: 'battery', prefix: 'Battery1' }] };
    const r = validateControlTesting(demoPassport(spec), build([{ assetId: 'battery-1', scenario: 'NOMINAL' }], spec), rules, env);
    expect(statusOf(r, 'CT-015')).toBe('NOT_APPLICABLE');
    expect(statusOf(r, 'CT-014')).toBe('PASSED');
  });

  it('правила зависят от версии набора: сессии v1.2 остаются на программе испытаний', () => {
    expect(getRulesForStage('ASSET_CONTROL', RULESET_V1_2.version).map((r) => r.id)).toEqual(['CT-001', 'CT-002', 'CT-003', 'CT-004', 'CT-005', 'CT-006']);
    expect(getRulesForStage('ASSET_CONTROL', RULESET_V1_5.version).map((r) => r.id)).toEqual(['CT-010', 'CT-011', 'CT-012', 'CT-013', 'CT-014', 'CT-015', 'CT-016']);
    expect(getRulesForStage('ASSET_CONTROL', ACTIVE_RULESET.version).map((r) => r.id)).toEqual(['CT-010', 'CT-011', 'CT-012', 'CT-013', 'CT-014', 'CT-015', 'CT-016', 'CT-017']);
  });
});

describe('интервалы команд (CT-017, v1.6.0)', () => {
  const battery = asset('battery-1');
  const at = (sec: number) => new Date(Date.parse('2026-11-05T09:00:00.000Z') + sec * 1000).toISOString();
  const cmd = (n: number, startSec: number, value = n % 2 ? 50 : -50) => executeControlTest({ ...req(battery, value, 'NOMINAL', n), createdAt: at(startSec) }, rules, transport);
  const ct17 = (commands: ReturnType<typeof cmd>[], r = rules) => validateControlTesting(passport, commands, r, env).find((x) => x.ruleId === 'CT-017');

  it('пауза задана в действующем наборе, в 1.5.0 правила нет', () => {
    expect(rules.minCommandIntervalSec).toBe(10);
    expect(ct17([cmd(1, 0), cmd(2, 1)], RULESET_V1_5.controlTesting!)).toBeUndefined();
  });

  it('одна команда или команды разным активам – нарушений нет', () => {
    expect(ct17([cmd(1, 0)])).toMatchObject({ status: 'PASSED', message: 'Повторных команд одному активу нет' });
    const pv = executeControlTest({ ...req(asset('pv-1'), 10, 'NOMINAL', 2), createdAt: at(1) }, rules, transport);
    expect(ct17([cmd(1, 0), pv])?.status).toBe('PASSED');
  });

  it('следующая команда до результата предыдущей – предупреждение с активом и командами, этап не блокируется', () => {
    const first = cmd(1, 0);
    const r = ct17([first, cmd(2, 1)])!;
    expect(r).toMatchObject({ status: 'WARNING', blocking: false, actual: 1 });
    expect(r.details).toMatchObject({ assets: ['battery-1'], commands: ['CMD-X-002'] });
    expect(r.message).toContain('отправлена до результата CMD-X-001');
  });

  it('пауза после результата не меньше заданной – проходит; меньше – предупреждение с числом секунд', () => {
    const first = cmd(1, 0);
    const settled = (Date.parse(first.history.at(-1)!.at) - Date.parse(at(0))) / 1000;
    // Отправка через 0,1 с после создания
    expect(ct17([first, cmd(2, settled + 10)])?.status).toBe('PASSED');
    const r = ct17([first, cmd(2, settled + 4.9)])!;
    expect(r.status).toBe('WARNING');
    expect(r.message).toContain('через 5 с после результата CMD-X-001');
  });

  it('отклонённые до отправки команды в интервалах не участвуют', () => {
    const invalid = executeControlTest({ ...req(battery, 1000, 'INVALID_VALUE', 2), createdAt: at(1) }, rules, transport);
    expect(invalid.sentAt).toBeNull();
    expect(ct17([cmd(1, 0), invalid])?.status).toBe('PASSED');
  });
});
