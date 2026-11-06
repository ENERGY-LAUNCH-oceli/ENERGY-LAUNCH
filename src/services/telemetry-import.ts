import Papa from 'papaparse';
import { parseObjectJson, TelemetryAnalyzer } from '@/engine/telemetry';
import type { SitePassport, TelemetryReport, TelemetryRules } from '@/types';
import { InvoiceFormatError, type InvoiceImportProgress } from './invoice-import';

/** Чтение object.json. Текст внутри файла — только данные: он не влияет на правила и переходы. */
export async function importPassport(source: File | string, opts: { fileName?: string; source?: 'UPLOAD' | 'DEMO' } = {}): Promise<SitePassport> {
  const text = typeof source === 'string' ? source : await source.text();
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new InvoiceFormatError('object.json не является корректным JSON');
  }
  return parseObjectJson(json, { version: 0, source: opts.source ?? 'UPLOAD', fileName: opts.fileName ?? (typeof source === 'string' ? 'object.json' : source.name), loadedAt: new Date().toISOString() });
}

/** Потоковый импорт telemetry.csv (PapaParse chunk → TelemetryAnalyzer). */
export async function importTelemetry(
  source: File | string,
  passport: SitePassport,
  rules: TelemetryRules,
  opts: { fileName?: string; uploadedAt?: string; source?: 'UPLOAD' | 'DEMO'; checkPoint?: string; onProgress?: (p: InvoiceImportProgress) => void } = {},
): Promise<TelemetryReport> {
  const bom = typeof source === 'string' ? source.charCodeAt(0) === 0xfeff : new Uint8Array(await source.slice(0, 3).arrayBuffer())[0] === 0xef;
  const analyzer = new TelemetryAnalyzer(rules, passport, opts.checkPoint);
  const totalBytes = typeof source === 'string' ? source.length : source.size;
  let line = 0;
  let header = false;
  let delimiter = ';';
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(source as File, {
      delimiter: ';',
      skipEmptyLines: true,
      chunkSize: 1024 * 512,
      chunk: (res, parser) => {
        try {
          for (const cells of res.data) {
            line++;
            if (!header) {
              delimiter = res.meta.delimiter;
              if (cells.length < 2 || !/timestamp/i.test(cells[0] ?? '')) throw new InvoiceFormatError('Файл не похож на telemetry.csv: первая колонка — timestamp, разделитель «;»');
              analyzer.header(cells);
              header = true;
            } else analyzer.row(cells, line);
          }
          opts.onProgress?.({ rows: Math.max(0, line - 1), bytes: res.meta.cursor, totalBytes });
        } catch (e) {
          parser.abort();
          reject(e);
        }
      },
      complete: () => {
        if (!header) return reject(new InvoiceFormatError('Пустой файл телеметрии'));
        resolve(analyzer.finish({ fileName: opts.fileName ?? (typeof source === 'string' ? 'telemetry.csv' : source.name), sizeBytes: totalBytes, uploadedAt: opts.uploadedAt ?? new Date().toISOString(), source: opts.source ?? 'UPLOAD', rows: 0, format: { bom, delimiter, decimal: ',', encoding: 'UTF-8' } }));
      },
      error: (err: Error) => reject(err),
    });
  });
}
