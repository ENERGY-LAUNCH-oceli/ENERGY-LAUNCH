import { beforeEach, describe, expect, it } from 'vitest';
import { noopPersistence, useLaunchStore } from '@/store';
import { qualityMetrics, runScenario, SCENARIOS } from '@/scenarios';

describe('Scenario Engine: 11 сценариев ТЗ', () => {
  beforeEach(() => {
    const st = useLaunchStore.getState();
    st.setPersistence(noopPersistence);
    st.initPortfolio(true);
  });

  it('каталог содержит 11 сценариев, 6 оценочных', () => {
    expect(SCENARIOS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(SCENARIOS.filter((s) => s.evaluation)).toHaveLength(6);
  });

  for (const def of SCENARIOS) {
    it(`${def.n}. ${def.title}`, () => {
      const run = runScenario(def);
      const failed = run.checks.filter((c) => !c.pass).map((c) => `${c.label} → ${c.actual}`);
      expect(failed).toEqual([]);
      expect(run.falseCompletions).toBe(0);
      expect(run.passed).toBe(true);
    });
  }

  it('прогон воспроизводим и не меняет состояние пользователя', () => {
    const before = useLaunchStore.getState();
    const objId = before.currentObjectId;
    const a = runScenario(SCENARIOS[1]!);
    const b = runScenario(SCENARIOS[1]!);
    expect(a.outcome.statuses).toEqual(b.outcome.statuses);
    expect(a.outcome.blockers).toEqual(b.outcome.blockers);
    expect(useLaunchStore.getState().currentObjectId).toBe(objId);
    expect(useLaunchStore.getState().session).toBe(before.session);
  });

  it('метрики качества ТЗ 6.1 на оценочных сценариях', () => {
    const m = qualityMetrics(SCENARIOS.filter((s) => s.evaluation).map(runScenario));
    expect(m.statusAccuracy.matched).toBe(m.statusAccuracy.total);
    expect(m.blockerRecall.found).toBe(m.blockerRecall.total);
    expect(m.falseCompletions).toBe(0);
    expect(m.evidence.covered).toBe(m.evidence.total);
  });
});
