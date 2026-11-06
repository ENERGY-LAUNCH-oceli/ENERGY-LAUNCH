import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_RULESET } from '@/config/rules';
import { createFixedContext, validateInvoice, validateTelemetryReport } from '@/engine';
import { importInvoice } from '@/services/invoice-import';
import { importPassport, importTelemetry } from '@/services/telemetry-import';
import type { EnergyObject } from '@/types';

/**
 * Набор кейса 4 (public/case4) – только локально, в репозиторий не входит.
 * Без набора тесты пропускаются.
 */
const ROOT = 'public/case4';
const has = existsSync(join(ROOT, 'manifest.json'));
const env = { ctx: createFixedContext('t', '2026-11-05T10:00:00.000Z'), rulesetVersion: ACTIVE_RULESET.version };
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

describe.skipIf(!has)('набор кейса 4: разбор реальных файлов', () => {
  for (const b of [1, 2, 3, 4, 5, 6]) {
    it(`Building${b}`, { timeout: 60_000 }, async () => {
      const passport = await importPassport(read(`Building${b}/object.json`), { fileName: 'object.json' });
      const invoice = await importInvoice(read(`Building${b}/invoice.csv`), ACTIVE_RULESET.meterHistory, { fileName: 'invoice.csv' });
      const object = { id: passport.objectId, passport: { objectId: passport.objectId, dataFiles: passport.dataFiles }, gridConnection: { eanOfftake: passport.ean.offtake, eanInjection: passport.ean.injection } } as unknown as EnergyObject;
      const mh = validateInvoice({ kind: 'INVOICE', id: 'x', objectId: passport.objectId, source: 'CSV_IMPORT', fileName: 'invoice.csv', importedAt: '', periodStart: '', periodEnd: '', version: 1, report: invoice }, object, ACTIVE_RULESET.meterHistory, env);
      const telPath = `Building${b}/telemetry.csv`;
      const tel = existsSync(join(ROOT, telPath)) ? await importTelemetry(read(telPath), passport, ACTIVE_RULESET.telemetry, { fileName: 'telemetry.csv' }) : undefined;
      const tm = validateTelemetryReport(tel ? { kind: 'TELEMETRY', id: 'y', objectId: passport.objectId, version: 1, report: tel } : undefined, passport, ACTIVE_RULESET.telemetry, env);
      const fmt = (rs: typeof mh) => rs.map((r) => `${r.ruleId}:${r.status}${r.status !== 'PASSED' ? ` – ${r.message.slice(0, 140)}` : ''}`).join('\n    ');
      console.log(
        `\n=== Building${b} (${passport.objectId}) assets=[${passport.assets.map((a) => `${a.assetId}/${a.type}/${a.prefix}:${a.signals.length}`).join(', ')}] warnings=${passport.warnings.join(' | ')}` +
          `\n  invoice rows=${invoice.meta.rows} window=${invoice.window?.from}..${invoice.window?.to} missing=${invoice.missingMonths.join(',')} completeness=${invoice.completeness.pct}% dup=${invoice.duplicates}` +
          `\n  MH:\n    ${fmt(mh)}` +
          (tel ? `\n  telemetry rows=${tel.meta.rows} signals=${tel.signals.length} foreign=${tel.foreignColumns.length}` : '\n  telemetry: нет файла') +
          `\n  TM:\n    ${fmt(tm)}`,
      );
      expect(passport.objectId).toBe(`building_${b}`);
    });
  }
});
