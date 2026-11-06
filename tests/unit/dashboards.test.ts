import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { buildDashboardWorkspace } from '@/data/mock';
import { loadScenario } from '@/data/scenarios';
import { OBJECT_CATALOG, seedWorkspace } from '@/data/objects';
import {
  acceptDashboard,
  AccessDeniedError,
  can,
  changeDashboard,
  configShapeErrors,
  createDashboardWorkspace,
  createFixedContext,
  DashboardRuleError,
  objectReadiness,
  publishDashboard,
  validateDashboardConfig,
  type DashboardActor,
} from '@/engine';
import { noopPersistence, useLaunchStore } from '@/store';
import { DASHBOARD_BLOCK_IDS, type DemoRole, type LaunchInputs } from '@/types';

const rules = ACTIVE_RULESET.dashboardConfig!;
const env = { ctx: createFixedContext('t', '2026-11-05T10:00:00.000Z'), rulesetVersion: ACTIVE_RULESET.version };
let n = 0;
const actor = (role: DemoRole, name: string = role): DashboardActor => ({ name, role, now: '2026-11-05T10:00:00.000Z', newId: () => `id-${++n}` });
const allCorrect = DASHBOARD_BLOCK_IDS.map((blockId) => ({ blockId, correct: true }));
const status = (inputs: LaunchInputs, id: string) => validateDashboardConfig(inputs, rules, env).find((r) => r.ruleId === id)?.status;

describe('конструктор рабочей панели', () => {
  it('по умолчанию четыре обязательных блока, только разрешённые значения', () => {
    const ws = createDashboardWorkspace('obj-x', '2026-11-05T10:00:00.000Z', 'eng');
    expect(ws.draft.blocks.map((b) => b.id)).toEqual([...DASHBOARD_BLOCK_IDS]);
    expect(configShapeErrors(ws.draft)).toEqual([]);
    expect(() => changeDashboard(ws, { kind: 'toggleWidget', blockId: 'ASSETS', widgetId: 'weather', enabled: true }, actor('LAUNCH_ENGINEER'))).toThrow(DashboardRuleError);
    expect(() => changeDashboard(ws, { kind: 'setPeriod', blockId: 'METER_HISTORY', period: '99Y' }, actor('LAUNCH_ENGINEER'))).toThrow(DashboardRuleError);
  });

  it('порядок блоков меняется, виджеты включаются и выключаются', () => {
    let ws = createDashboardWorkspace('obj-x', '2026-11-05T10:00:00.000Z', 'eng');
    ws = changeDashboard(ws, { kind: 'moveBlock', blockId: 'CONTROL', direction: -1 }, actor('LAUNCH_ENGINEER'));
    expect(ws.draft.blocks.map((b) => b.id)).toEqual(['METER_HISTORY', 'CONTROL', 'ASSETS', 'QUALITY_STATUS']);
    ws = changeDashboard(ws, { kind: 'toggleWidget', blockId: 'CONTROL', widgetId: 'response_chart', enabled: false }, actor('LAUNCH_ENGINEER'));
    expect(ws.draft.blocks[1]!.widgets.response_chart).toBe(false);
  });

  it('права проверяются в логике: оператор не редактирует, инженер не принимает, ответственный не публикует', () => {
    const ws = createDashboardWorkspace('obj-x', '2026-11-05T10:00:00.000Z', 'eng');
    expect(() => changeDashboard(ws, { kind: 'reset' }, actor('OPERATOR'))).toThrow(AccessDeniedError);
    expect(() => publishDashboard(ws, 'obj-x', actor('ACCEPTANCE_OFFICER'))).toThrow(AccessDeniedError);
    const pub = publishDashboard(ws, 'obj-x', actor('LAUNCH_ENGINEER'));
    expect(() => acceptDashboard(pub, 'obj-x', { result: 'ACCEPTED', blocks: allCorrect }, actor('LAUNCH_ENGINEER'))).toThrow(AccessDeniedError);
    expect(can('OPERATOR', 'dashboard.view')).toBe(true);
    expect(can('OPERATOR', 'launch.manage')).toBe(false);
  });

  it('публикация фиксирует версию; приёмка сохраняет автора, время, версию, object_id и результат', () => {
    const pub = publishDashboard(createDashboardWorkspace('obj-x', '2026-11-05T10:00:00.000Z', 'eng'), 'obj-x', actor('LAUNCH_ENGINEER'));
    expect(pub.published!.version).toBe(1);
    expect(pub.draft.version).toBe(2);
    expect(() => publishDashboard(pub, 'obj-x', actor('LAUNCH_ENGINEER'))).toThrow(/Изменений нет/);
    const { acceptance } = acceptDashboard(pub, 'obj-x', { result: 'ACCEPTED', blocks: allCorrect }, actor('ACCEPTANCE_OFFICER', 'Петрова'));
    expect(acceptance).toMatchObject({ author: 'Петрова', role: 'ACCEPTANCE_OFFICER', configVersion: 1, objectId: 'obj-x', result: 'ACCEPTED', at: '2026-11-05T10:00:00.000Z' });
  });

  it('нельзя принять с некорректным блоком; отказ без замечаний требует комментарий', () => {
    const pub = publishDashboard(createDashboardWorkspace('obj-x', '2026-11-05T10:00:00.000Z', 'eng'), 'obj-x', actor('LAUNCH_ENGINEER'));
    const oneBad = allCorrect.map((b, i) => (i === 0 ? { ...b, correct: false } : b));
    expect(() => acceptDashboard(pub, 'obj-x', { result: 'ACCEPTED', blocks: oneBad }, actor('ACCEPTANCE_OFFICER'))).toThrow(/некорректны блоки/);
    expect(() => acceptDashboard(pub, 'obj-x', { result: 'REJECTED', blocks: allCorrect }, actor('ACCEPTANCE_OFFICER'))).toThrow(/причину/);
    expect(() => acceptDashboard(pub, 'obj-x', { result: 'ACCEPTED', blocks: allCorrect.slice(1) }, actor('ACCEPTANCE_OFFICER'))).toThrow(/Не просмотрены/);
    expect(() => acceptDashboard(pub, 'obj-other', { result: 'ACCEPTED', blocks: allCorrect }, actor('ACCEPTANCE_OFFICER'))).toThrow(/привязана/);
  });
});

describe('правила этапа 4 (v1.4.0)', () => {
  const base = () => loadScenario('happy-path').inputs;

  it('опубликованная и принятая панель проходит все проверки', () => {
    expect(validateDashboardConfig(base(), rules, env).filter((r) => r.status !== 'PASSED')).toEqual([]);
  });

  it('выключенный обязательный виджет делает блок некорректным', () => {
    const i = { ...base(), dashboard: buildDashboardWorkspace({ objectId: base().object.id, at: '2026-11-05T09:00:00.000Z', engineer: 'e', publish: true, review: 'REJECT', disable: [{ blockId: 'ASSETS', widgetId: 'soc' }] }) };
    expect(status(i, 'DB-012')).toBe('FAILED');
    expect(status(i, 'DB-016')).toBe('FAILED');
  });

  it('данные другого объекта не допускаются', () => {
    const b = base();
    const i = { ...b, telemetry: { ...b.telemetry!, objectId: 'obj-foreign' } };
    expect(status(i, 'DB-010')).toBe('FAILED');
  });

  it('новая публикация требует повторной приёмки', () => {
    const b = base();
    let ws = changeDashboard(b.dashboard!, { kind: 'moveBlock', blockId: 'QUALITY_STATUS', direction: -1 }, actor('LAUNCH_ENGINEER'));
    ws = publishDashboard(ws, b.object.id, actor('LAUNCH_ENGINEER'));
    const r = validateDashboardConfig({ ...b, dashboard: ws }, rules, env).find((x) => x.ruleId === 'DB-016')!;
    expect(r.status).toBe('FAILED');
    expect(r.message).toMatch(/повторная приёмка/);
  });

  it('без опубликованной версии блоки не проверяются, этап не проходит', () => {
    const i = { ...base(), dashboard: createDashboardWorkspace(base().object.id, '2026-11-05T09:00:00.000Z', 'e') };
    expect(status(i, 'DB-011')).toBe('SKIPPED');
    expect(status(i, 'DB-015')).toBe('FAILED');
  });
});

describe('итоговая готовность', () => {
  it('готов только объект со всеми этапами и принятой панелью', () => {
    const done = seedWorkspace(OBJECT_CATALOG[0]!, ACTIVE_RULESET);
    expect(objectReadiness(done.session, done.inputs, ACTIVE_RULESET).ready).toBe(true);
    const blocked = seedWorkspace(OBJECT_CATALOG[5]!, ACTIVE_RULESET);
    const r = objectReadiness(blocked.session, blocked.inputs, ACTIVE_RULESET);
    expect(r.ready).toBe(false);
    expect(r.conditions.filter((c) => !c.met).map((c) => c.id)).toEqual(['ASSET_CONTROL', 'FINAL_DASHBOARDS', 'ACCEPTANCE']);
  });

  it('без действующей приёмки статус не присваивается, даже если сессия завершена', () => {
    const done = seedWorkspace(OBJECT_CATALOG[0]!, ACTIVE_RULESET);
    const ws = { ...done.inputs.dashboard!, acceptances: [] };
    expect(objectReadiness(done.session, { ...done.inputs, dashboard: ws }, ACTIVE_RULESET).ready).toBe(false);
  });
});

describe('права в хранилище приложения', () => {
  beforeEach(() => {
    const s = useLaunchStore.getState();
    s.setPersistence(noopPersistence);
    s.initPortfolio(true);
    s.loadScenario('happy-path');
    s.setRole('LAUNCH_ENGINEER');
  });

  it('оператор: изменения отклоняются логикой, отказ записан в журнал', () => {
    const s = useLaunchStore.getState();
    const before = s.inputs!.dashboard;
    s.setRole('OPERATOR');
    expect(useLaunchStore.getState().updateDashboard({ kind: 'moveBlock', blockId: 'CONTROL', direction: -1 })).toBe(false);
    expect(useLaunchStore.getState().publishDashboard()).toBe(false);
    expect(useLaunchStore.getState().startStage('METER_HISTORY')).toBe(false);
    expect(useLaunchStore.getState().inputs!.dashboard).toBe(before);
    expect(useLaunchStore.getState().auditLog.filter((e) => e.action === 'ACCESS_DENIED').length).toBeGreaterThanOrEqual(3);
  });

  it('инженер публикует, ответственный принимает; инженер принять не может', () => {
    expect(useLaunchStore.getState().publishDashboard()).toBe(true);
    expect(useLaunchStore.getState().reviewDashboard({ result: 'ACCEPTED', blocks: allCorrect })).toBe(false);
    useLaunchStore.getState().setRole('ACCEPTANCE_OFFICER');
    expect(useLaunchStore.getState().updateDashboard({ kind: 'reset' })).toBe(false);
    expect(useLaunchStore.getState().reviewDashboard({ result: 'ACCEPTED', blocks: allCorrect })).toBe(true);
    const acc = useLaunchStore.getState().inputs!.dashboard!.acceptances.at(-1)!;
    expect(acc).toMatchObject({ author: 'Ответственный за приёмку', role: 'ACCEPTANCE_OFFICER', configVersion: 1, objectId: useLaunchStore.getState().session!.objectId, result: 'ACCEPTED' });
  });
});
