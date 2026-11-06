import { beforeAll, describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, OBJECT_CATALOG } from '@/data/objects';
import { passportToObjectJson, TEST_FILE_VARIANTS, variantsFor } from '@/data/test-files';
import { parseObjectJson } from '@/engine/telemetry/passport';
import { withCheckDigit } from '@/engine/invoice/format';
import { importInvoice } from '@/services/invoice-import';
import { importTelemetry } from '@/services/telemetry-import';
import { noopPersistence, useLaunchStore } from '@/store';

/** Каждый вариант тестовых файлов проходит настоящий импорт и проверки этапа – на малом и на крупном объекте. */
for (const cfg of [{ pv: 3, bat: 2 }, { pv: 154, bat: 90 }])
describe(`тестовые файлы: ${cfg.pv} PV, ${cfg.bat} батарей`, () => {
  beforeAll(() => {
    localStorage.clear();
    const st = useLaunchStore.getState();
    st.setPersistence(noopPersistence);
    for (const o of OBJECT_CATALOG.filter((x) => x.source === 'USER')) st.removeObject(o.id);
    st.initPortfolio(true);
  });

  const fresh = () => {
    const st = useLaunchStore.getState();
    for (const o of OBJECT_CATALOG.filter((x) => x.source === 'USER')) st.removeObject(o.id);
    st.createObject({ ...EMPTY_DRAFT, name: 'Тестовое название', code: 'TESTOVOE-NAZVANIE', city: 'Swansea', responsible: 'Инженер запуска', eanOfftake: withCheckDigit('54143000000000008'), eanInjection: withCheckDigit('54144568746856858'), pvCount: cfg.pv, batteryCount: cfg.bat });
    return useLaunchStore.getState();
  };

  it('варианты применимы к объекту с PV и батареями', () => {
    const p = fresh().inputs!.passport!;
    expect(variantsFor(p)).toHaveLength(TEST_FILE_VARIANTS.length);
  });

  it('object.json из паспорта разбирается обратно в тот же паспорт', () => {
    const p = fresh().inputs!.passport!;
    const back = parseObjectJson(JSON.parse(JSON.stringify(passportToObjectJson(p))), { version: 1, source: 'UPLOAD', fileName: 'object.json', loadedAt: p.loadedAt });
    expect({ ...back, warnings: [] }).toEqual({ ...p, warnings: [] });
  });

  for (const v of TEST_FILE_VARIANTS) {
    it(`${v.stageId === 'METER_HISTORY' ? 'история' : 'телеметрия'}: ${v.title} → ${v.expectFail.join(', ') || 'этап проходит'}`, async () => {
      const st = fresh();
      const passport = st.inputs!.passport!;
      const file = v.build(passport);
      if (v.stageId === 'METER_HISTORY') {
        st.importInvoiceReport(await importInvoice(file.text, st.ruleset.meterHistory, { fileName: file.fileName }));
      } else {
        // Этап 2 начинается после этапа 1: корректная история + подтверждения
        const ok = TEST_FILE_VARIANTS.find((x) => x.id === 'mh-ok')!.build(passport);
        st.importInvoiceReport(await importInvoice(ok.text, st.ruleset.meterHistory, { fileName: ok.fileName }));
        st.startStage('METER_HISTORY');
        st.validateStage('METER_HISTORY');
        for (const req of st.ruleset.confirmations.METER_HISTORY) {
          useLaunchStore.getState().addEvidence({ stageId: 'METER_HISTORY', type: req.evidenceTypes[0]!, title: 'тест' });
          const ev = useLaunchStore.getState().session!.evidence.at(-1)!;
          useLaunchStore.getState().addConfirmation({ stageId: 'METER_HISTORY', requirementId: req.id, role: req.role, confirmedBy: 'тест', evidenceIds: [ev.id] });
        }
        expect(useLaunchStore.getState().completeStage('METER_HISTORY')).toBe(true);
        useLaunchStore.getState().importTelemetryReport(await importTelemetry(file.text, passport, st.ruleset.telemetry, { fileName: file.fileName }));
      }
      const s = useLaunchStore.getState();
      s.startStage(v.stageId);
      s.validateStage(v.stageId);
      const results = useLaunchStore.getState().session!.stages[v.stageId].validationResults;
      const failed = results.filter((r) => r.blocking && r.status !== 'PASSED').map((r) => r.ruleId);
      // Ровно ожидаемые правила: вариант проверяет одну проблему и не задевает остальные
      expect([...new Set(failed)].sort()).toEqual([...v.expectFail].sort());
    });
  }
});
