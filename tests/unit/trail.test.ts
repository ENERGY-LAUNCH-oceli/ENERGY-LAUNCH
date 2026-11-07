import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { buildInvoiceDataset, DEMO_OBJECT_ID } from '@/data/mock';
import { loadScenario } from '@/data/scenarios';
import {
  addConfirmation,
  addEvidence,
  auditRecords,
  blockerRecord,
  completeStage,
  createFixedContext,
  createLaunchSession,
  evidenceRecords,
  getUnmetConfirmations,
  markConfirmationsStale,
  startStage,
  stateAt,
  validateStage,
  type MachineResult,
} from '@/engine';
import { noopPersistence, useLaunchStore } from '@/store';
import type { LaunchSession } from '@/types';

const cfg = ACTIVE_RULESET;
const ctx = createFixedContext('t', '2026-11-05T10:00:00.000Z');
const unwrap = (r: MachineResult): LaunchSession => {
  if (!r.ok) throw new Error(r.error.message);
  return r.session;
};

describe('устаревание подтверждений', () => {
  it('изменение входов делает подтверждения неактуальными: они не засчитываются, но остаются в истории', () => {
    const inputs = loadScenario('happy-path').inputs;
    let s = createLaunchSession(inputs.object.id, cfg.version, ctx);
    s = unwrap(startStage(s, 'METER_HISTORY', ctx));
    s = unwrap(validateStage(s, 'METER_HISTORY', inputs, cfg, ctx));
    for (const req of cfg.confirmations.METER_HISTORY) {
      s = unwrap(addEvidence(s, { stageId: 'METER_HISTORY', type: req.evidenceTypes[0]!, title: req.id }, ctx));
      s = unwrap(addConfirmation(s, { stageId: 'METER_HISTORY', requirementId: req.id, role: req.role, confirmedBy: 'Иванов', evidenceIds: [s.evidence.at(-1)!.id] }, cfg, ctx));
    }
    expect(getUnmetConfirmations(s, 'METER_HISTORY', cfg)).toEqual([]);
    const r = markConfirmationsStale(s, ['METER_HISTORY'], 'загружена invoice.csv v2', ctx);
    s = unwrap(r);
    expect(r.events.map((e) => e.action)).toEqual(['CONFIRMATIONS_STALE']);
    expect(s.stages.METER_HISTORY.confirmations.every((c) => c.staleSince && c.staleReason === 'загружена invoice.csv v2')).toBe(true);
    expect(getUnmetConfirmations(s, 'METER_HISTORY', cfg)).toHaveLength(cfg.confirmations.METER_HISTORY.length);
    const done = completeStage(s, 'METER_HISTORY', cfg, ctx);
    expect(done.ok).toBe(false);
    if (!done.ok) expect(done.error.code).toBe('MISSING_CONFIRMATIONS');
  });
});

describe('повторная проверка и след в хранилище', () => {
  beforeEach(() => {
    const st = useLaunchStore.getState();
    st.setPersistence(noopPersistence);
    st.initPortfolio(true);
    st.selectObject('obj-002');
    st.setRole('LAUNCH_ENGINEER');
  });

  it('новая выгрузка: затронутые проверки перезапускаются, предыдущий результат сохраняется, статус пересчитан', () => {
    const before = useLaunchStore.getState();
    expect(before.session!.stages.METER_HISTORY.status).toBe('BLOCKED');
    const historyBefore = before.inputs!.validationHistory!.length;
    useLaunchStore.getState().importInvoiceReport(buildInvoiceDataset({ objectId: 'obj-002' }).report);
    const after = useLaunchStore.getState();
    expect(after.session!.stages.METER_HISTORY.status).toBe('IN_PROGRESS');
    const snaps = after.inputs!.validationHistory!.filter((h) => h.stageId === 'METER_HISTORY');
    expect(after.inputs!.validationHistory!.length).toBe(historyBefore + 1);
    expect(snaps.at(-1)).toMatchObject({ trigger: 'RECHECK', statusBefore: 'BLOCKED', statusAfter: 'IN_PROGRESS' });
    expect(snaps.at(-1)!.inputs.find((i) => i.kind === 'invoice')!.version).toBe(2);
    // Препятствие закрыто повторной проверкой и осталось в истории
    expect(after.session!.blockers.some((b) => b.ruleId === 'MH-002' && b.status === 'RESOLVED')).toBe(true);
    // Предыдущий результат – «заменено», текущий – «актуально»
    const ev = evidenceRecords(after.session!, after.inputs!, after.ruleset).filter((e) => e.kind === 'CHECK' && e.stageId === 'METER_HISTORY');
    expect(ev.some((e) => e.state === 'SUPERSEDED')).toBe(true);
    expect(ev.filter((e) => e.state === 'CURRENT')).toHaveLength(snaps.at(-1)!.results.length);
  });

  it('журнал аудита: было → стало и воспроизведение статуса на момент времени', () => {
    const st0 = useLaunchStore.getState();
    const blockedAt = st0.auditLog.find((e) => e.action === 'STAGE_BLOCKED')!.timestamp;
    useLaunchStore.getState().importInvoiceReport(buildInvoiceDataset({ objectId: 'obj-002' }).report);
    const st = useLaunchStore.getState();
    const recs = auditRecords(st.auditLog, st.inputs!.validationHistory);
    const unblock = recs.find((r) => r.action === 'STAGE_UNBLOCKED')!;
    expect(unblock).toMatchObject({ previousValue: 'BLOCKED', newValue: 'IN_PROGRESS', objectId: 'obj-002' });
    expect(recs.find((r) => r.action === 'DATASET_IMPORTED')).toMatchObject({ category: 'FILE', previousValue: 'v1', newValue: expect.stringContaining('v2') });
    expect(recs.some((r) => r.category === 'RECHECK')).toBe(true);
    const then = stateAt(st.auditLog, st.inputs!.validationHistory!, 'obj-002', blockedAt);
    expect(then.statuses.METER_HISTORY).toBe('BLOCKED');
    expect(then.lastRuns[0]!.failed).toContain('MH-002');
    const now = stateAt(st.auditLog, st.inputs!.validationHistory!, 'obj-002', '9999-12-31T00:00:00.000Z');
    expect(now.statuses.METER_HISTORY).toBe('IN_PROGRESS');
  });

  it('карточка препятствия: точная причина, данные, правило с параметром, действие и повторная проверка', () => {
    const st = useLaunchStore.getState();
    const b = st.session!.blockers.find((x) => x.ruleId === 'MH-002')!;
    const r = blockerRecord(b, st.session!, st.inputs!, st.ruleset);
    expect(r.category).toBe('PRESENCE');
    expect(r.detail.happened).toMatch(/нет данных: 2024-11/);
    expect(r.signals).toContain('месяц 2024-11');
    expect(r.detail.rule).toMatchObject({ id: 'MH-002', configRef: 'meterHistory.periodMonths', configValue: 24 });
    expect(r.detail.dataUsed.map((i) => i.kind)).toEqual(['invoice', 'passport']);
    expect(r.nextAction).toMatch(/Получить полную выгрузку за недостающие месяцы/);
    expect(r.detail.recheck).toMatch(/MH-002/);
  });
});

describe('точные сообщения вместо абстрактных', () => {
  it('EAN: указан конкретный код и причина', () => {
    const i = loadScenario('happy-path').inputs;
    // EAN берётся из паспорта object.json (ТЗ) – ошибка в паспорте видна в MH-011
    const object = { ...i.object, gridConnection: { ...i.object.gridConnection, eanOfftake: '54144886001127394' } };
    const passport = i.passport ? { ...i.passport, ean: { ...i.passport.ean, offtake: '54144886001127394' } } : undefined;
    const s0 = unwrap(startStage(createLaunchSession(DEMO_OBJECT_ID, cfg.version, ctx), 'METER_HISTORY', ctx));
    const s = unwrap(validateStage(s0, 'METER_HISTORY', { ...i, object, ...(passport ? { passport } : {}) }, cfg, ctx));
    expect(s.stages.METER_HISTORY.validationResults.find((r) => r.ruleId === 'MH-011')!.message).toBe('EAN offtake 54144886001127394: 17 цифр вместо 18');
  });
});

describe('исправленный паспорт снимает препятствие EAN', () => {
  it('EAN описания объекта неверный, а в загруженном паспорте – верный: MH-011 проходит', () => {
    const i = loadScenario('happy-path').inputs;
    const object = { ...i.object, gridConnection: { ...i.object.gridConnection, eanInjection: '541448860011140653' } };
    const s0 = unwrap(startStage(createLaunchSession(DEMO_OBJECT_ID, cfg.version, ctx), 'METER_HISTORY', ctx));
    const s = unwrap(validateStage(s0, 'METER_HISTORY', { ...i, object }, cfg, ctx));
    expect(s.stages.METER_HISTORY.validationResults.find((r) => r.ruleId === 'MH-011')!.status).toBe('PASSED');
  });
});
