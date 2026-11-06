import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, OBJECT_CATALOG, buildUserObject, findObject, loadStoredObjects, suggestCode, validateDraft, type UserObjectDraft } from '@/data/objects';
import { withCheckDigit } from '@/engine/invoice/format';
import { noopPersistence, useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';

const draft = (over: Partial<UserObjectDraft> = {}): UserObjectDraft => ({
  ...EMPTY_DRAFT,
  name: 'Кампус «Южный»',
  code: 'KAMPUS-YUZHNYY',
  city: 'Намюр',
  street: 'Rue Exemple 1',
  postalCode: '5000',
  responsible: 'Инженер запуска',
  eanOfftake: withCheckDigit('54144880000009901'),
  eanInjection: withCheckDigit('54144880000009902'),
  pvCount: 2,
  batteryCount: 1,
  ...over,
});

describe('добавление объектов', () => {
  beforeEach(() => {
    localStorage.clear();
    const st = useLaunchStore.getState();
    st.setPersistence(noopPersistence);
    for (const o of OBJECT_CATALOG.filter((x) => x.source === 'USER')) st.removeObject(o.id);
    st.initPortfolio(true);
  });

  it('код подставляется из названия латиницей', () => {
    expect(suggestCode('Кампус «Южный» 2')).toBe('KAMPUS-YUZHNYY-2');
  });

  it('форма проверяет обязательные поля, EAN (18 цифр, GS1) и уникальность кода', () => {
    expect(validateDraft(draft())).toEqual({});
    const e = validateDraft({ ...EMPTY_DRAFT, pvCount: 2001 });
    expect(Object.keys(e).sort()).toEqual(['city', 'code', 'eanInjection', 'eanOfftake', 'name', 'pvCount', 'responsible']);
    expect(validateDraft(draft({ eanOfftake: '541448800000099010' })).eanOfftake).toMatch(/контрольная цифра/);
    expect(validateDraft(draft({ eanInjection: draft().eanOfftake })).eanInjection).toMatch(/различаться/);
    expect(validateDraft(draft({ code: OBJECT_CATALOG[0]!.code })).code).toMatch(/уже есть/);
  });

  it('паспорт из формы проходит разбор object.json: оборудование, сигналы, EAN', () => {
    const entry = buildUserObject({ ...draft(), id: 'usr-test', createdAt: '2026-11-06T10:00:00.000Z' });
    expect(entry.source).toBe('USER');
    expect(entry.inputs!.passport!.assets.map((a) => a.prefix)).toEqual(['PV1', 'PV2', 'Battery1']);
    expect(entry.inputs!.passport!.ean).toEqual({ offtake: draft().eanOfftake, injection: draft().eanInjection });
    expect(entry.inputs!.invoice).toBeUndefined();
    expect(entry.inputs!.telemetry).toBeUndefined();
    expect(entry.address).toBe('Rue Exemple 1, 5000 Намюр');
  });

  it('новый объект попадает в портфель с чистой сессией, сохраняется и удаляется', () => {
    const st = useLaunchStore.getState();
    const before = OBJECT_CATALOG.length;
    const entry = st.createObject(draft());
    expect(OBJECT_CATALOG).toHaveLength(before + 1);
    expect(useLaunchStore.getState().currentObjectId).toBe(entry.id);
    const session = useLaunchStore.getState().session!;
    expect(STAGE_IDS.map((id) => session.stages[id].status)).toEqual(['NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED']);
    expect(useLaunchStore.getState().auditLog[0]!.action).toBe('SESSION_CREATED');
    expect(loadStoredObjects().map((o) => o.id)).toEqual([entry.id]);

    // Этап 1 без загруженной истории не завершается: проверки блокируют
    expect(st.startStage('METER_HISTORY')).toBe(true);
    st.validateStage('METER_HISTORY');
    expect(useLaunchStore.getState().session!.stages.METER_HISTORY.status).toBe('BLOCKED');

    // После перезапуска портфеля объект восстанавливается из хранилища
    st.initPortfolio(true);
    expect(findObject(entry.id)?.name).toBe('Кампус «Южный»');

    expect(useLaunchStore.getState().removeObject(entry.id)).toBe(true);
    expect(findObject(entry.id)).toBeUndefined();
    expect(loadStoredObjects()).toEqual([]);
    expect(useLaunchStore.getState().workspaces[entry.id]).toBeUndefined();
  });

  it('объекты портфеля, не добавленные пользователем, не удаляются', () => {
    expect(useLaunchStore.getState().removeObject(OBJECT_CATALOG[0]!.id)).toBe(false);
  });
});

describe('EAN: подсказка контрольной цифры', () => {
  it('дописывает к 17 цифрам и исправляет последнюю у 18', async () => {
    const { eanFix } = await import('@/data/objects');
    expect(eanFix('54144880000009901')).toBe('541448800000099011');
    expect(eanFix('541448800000099010')).toBe('541448800000099011');
    expect(eanFix('541448800000099011')).toBeNull();
    expect(eanFix('5414')).toBeNull();
  });
});
