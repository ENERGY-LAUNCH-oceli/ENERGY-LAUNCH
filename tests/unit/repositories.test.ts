import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RULESET_V1 } from '@/config/rules';
import { loadScenario } from '@/data/scenarios';
import { createFixedContext, createLaunchSession } from '@/engine';
import { auditRepository, EnergyLaunchDB, loadLaunchInputs, saveLaunchInputs, sessionRepository, setDb } from '@/services';

describe('Dexie-репозитории', () => {
  let db: EnergyLaunchDB;
  beforeEach(() => {
    db = new EnergyLaunchDB(`test-${crypto.randomUUID()}`);
    setDb(db);
  });
  afterEach(async () => {
    await db.delete();
    setDb(null);
  });

  it('сохраняет и восстанавливает входные данные и сессию', async () => {
    const { inputs } = loadScenario('happy-path');
    await saveLaunchInputs(inputs);
    const restored = await loadLaunchInputs(inputs.object.id);
    expect(restored?.object.id).toBe(inputs.object.id);
    expect(restored?.invoice?.report.completeness).toEqual(inputs.invoice?.report.completeness);
    expect(restored?.telemetry?.report.signals.length).toBe(inputs.telemetry?.report.signals.length);

    const session = createLaunchSession(inputs.object.id, RULESET_V1.version, createFixedContext('t', '2026-11-05T00:00:00.000Z'));
    await sessionRepository.save(session);
    expect(await sessionRepository.get(session.id)).toEqual(session);
  });

  it('журнал аудита только дополняется: повторная запись с тем же id отклоняется', async () => {
    const event = { id: 'e1', action: 'SESSION_CREATED' as const, actor: 't', timestamp: '2026-11-05T00:00:00.000Z', sessionId: 's1' };
    await auditRepository.append([event]);
    await expect(auditRepository.append([event])).rejects.toThrow();
    expect(await auditRepository.listBySession('s1')).toHaveLength(1);
  });
});
