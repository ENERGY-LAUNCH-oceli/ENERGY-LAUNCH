import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvent, createFixedContext, staleValidationReason } from '@/engine';
import { noopPersistence, useLaunchStore, type LaunchPersistence } from '@/store';
import type { AuditEvent, LaunchInputs } from '@/types';

describe('фабрика событий аудита', () => {
  const ctx = createFixedContext('Инженер', '2026-11-05T10:00:00.000Z');
  const session = { id: 's1', objectId: 'obj-1', rulesetVersion: '1.6.0' };

  it('сессия, этап и данные; время – «сейчас» или переданное', () => {
    expect(auditEvent(ctx, session, 'DATASET_IMPORTED', { stageId: 'METER_HISTORY', payload: { version: 2 } })).toEqual({
      id: 'id-1', action: 'DATASET_IMPORTED', actor: 'Инженер', timestamp: '2026-11-05T10:00:00.000Z', sessionId: 's1', objectId: 'obj-1', rulesetVersion: '1.6.0', stageId: 'METER_HISTORY', payload: { version: 2 },
    });
    expect(auditEvent(ctx, session, 'CONTROL_COMMAND', { timestamp: '2026-11-05T09:00:00.000Z' }).timestamp).toBe('2026-11-05T09:00:00.000Z');
  });

  it('без сессии – только действие, автор и время', () => {
    expect(auditEvent(ctx, null, 'ACCESS_DENIED')).toEqual({ id: 'id-3', action: 'ACCESS_DENIED', actor: 'Инженер', timestamp: '2026-11-05T10:00:00.000Z' });
  });
});

describe('устаревший результат проверки (ТЗ 2.2 п. 4)', () => {
  const inputs = (over: Partial<LaunchInputs>) => ({ ...over }) as LaunchInputs;

  it('нет входов или проверка соответствует текущим данным – null', () => {
    expect(staleValidationReason('METER_HISTORY', null)).toBeNull();
    expect(staleValidationReason('METER_HISTORY', inputs({ invoice: { version: 2 } as LaunchInputs['invoice'], invoiceRuns: [{ datasetVersion: 2 }] as LaunchInputs['invoiceRuns'] }))).toBeNull();
    expect(staleValidationReason('FINAL_DASHBOARDS', inputs({}))).toBeNull();
  });

  it('история: загружена новая версия после проверки', () => {
    const r = staleValidationReason('METER_HISTORY', inputs({ invoice: { version: 3 } as LaunchInputs['invoice'], invoiceRuns: [{ datasetVersion: 2 }] as LaunchInputs['invoiceRuns'] }));
    expect(r).toBe('Загружена версия v3, а проверялась v2: повторите проверку');
  });

  it('телеметрия: изменён паспорт после проверки', () => {
    const r = staleValidationReason('REALTIME_TELEMETRY', inputs({ telemetry: { version: 1 } as LaunchInputs['telemetry'], passport: { version: 2 } as LaunchInputs['passport'], telemetryRuns: [{ datasetVersion: 1, passportVersion: 1 }] as LaunchInputs['telemetryRuns'] }));
    expect(r).toMatch(/паспорт v2/);
  });

  it('управление: новые тесты после проверки', () => {
    const r = staleValidationReason('ASSET_CONTROL', inputs({ controlCommands: [{}, {}, {}] as LaunchInputs['controlCommands'], controlRuns: [{ commandsCount: 1 }] as LaunchInputs['controlRuns'] }));
    expect(r).toBe('После проверки выполнены новые тесты управления (2): повторите проверку');
  });
});

describe('журнал хранилища запуска', () => {
  let appended: AuditEvent[];
  const spy: LaunchPersistence = { ...noopPersistence, appendAudit: async (events) => void appended.push(...events) };

  beforeEach(() => {
    appended = [];
    const st = useLaunchStore.getState();
    st.setPersistence(noopPersistence);
    st.initPortfolio(true);
    st.setRole('LAUNCH_ENGINEER');
    st.setPersistence(spy);
  });

  it('отказ в правах попадает и в журнал, и в хранилище', () => {
    useLaunchStore.getState().setRole('OPERATOR');
    expect(useLaunchStore.getState().startStage('METER_HISTORY')).toBe(false);
    const last = useLaunchStore.getState().auditLog.at(-1)!;
    expect(last).toMatchObject({ action: 'ACCESS_DENIED', payload: { role: 'OPERATOR', action: 'launch.manage' } });
    expect(appended).toContainEqual(last);
  });

  it('загрузка паспорта – событие с этапом и версией уходит в хранилище (раньше оставалось только в памяти)', () => {
    const st = useLaunchStore.getState();
    const passport = st.inputs!.passport!;
    st.importPassport(passport);
    const ev = appended.find((e) => e.action === 'DATASET_IMPORTED');
    expect(ev).toMatchObject({ stageId: 'REALTIME_TELEMETRY', payload: { kind: 'object.json', version: passport.version + 1 } });
    expect(useLaunchStore.getState().auditLog).toContainEqual(ev);
  });
});
