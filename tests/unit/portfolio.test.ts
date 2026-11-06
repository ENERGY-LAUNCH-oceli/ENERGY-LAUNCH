import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET as RULESET_V1 } from '@/config/rules';
import { OBJECT_CATALOG, seedWorkspace } from '@/data/objects';
import { STAGE_IDS } from '@/types';

const statuses = (id: string) => {
  const ws = seedWorkspace(OBJECT_CATALOG.find((o) => o.id === id)!, RULESET_V1);
  return STAGE_IDS.map((s) => ws.session.stages[s].status);
};

describe('демо-портфель', () => {
  it('шесть объектов в заданных состояниях', () => {
    expect(statuses('obj-001')).toEqual(['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED']);
    expect(statuses('obj-002')).toEqual(['BLOCKED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED']);
    expect(statuses('obj-003')).toEqual(['BLOCKED', 'NOT_STARTED', 'NOT_STARTED', 'NOT_STARTED']);
    expect(statuses('obj-004')).toEqual(['COMPLETED', 'BLOCKED', 'NOT_STARTED', 'NOT_STARTED']);
    expect(statuses('obj-005')).toEqual(['COMPLETED', 'BLOCKED', 'NOT_STARTED', 'NOT_STARTED']);
    expect(statuses('obj-006')).toEqual(['COMPLETED', 'COMPLETED', 'BLOCKED', 'NOT_STARTED']);
  });

  it('воспроизводим: два прогона дают одинаковый результат', () => {
    const e = OBJECT_CATALOG[3]!;
    expect(seedWorkspace(e, RULESET_V1)).toEqual(seedWorkspace(e, RULESET_V1));
  });

  it('готовый объект завершил сессию', () => {
    expect(seedWorkspace(OBJECT_CATALOG[0]!, RULESET_V1).session.status).toBe('COMPLETED');
  });
});
