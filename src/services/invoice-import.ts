import Papa from 'papaparse';
import { InvoiceAnalyzer } from '@/engine/invoice';
import type { InvoiceReport, MeterHistoryRules } from '@/types';

export interface InvoiceImportProgress {
  rows: number;
  bytes: number;
  totalBytes: number;
}

export class InvoiceFormatError extends Error {}

/**
 * Потоковый импорт invoice.csv: PapaParse читает файл частями (chunk), каждая строка сразу уходит
 * в анализатор. Строки в состояние React не попадают – сохраняется только отчёт,
 * поэтому большие выгрузки не перегружают интерфейс.
 */
/** BOM определяется по первым байтам: PapaParse удаляет его при разборе. */
async function hasBom(source: File | string): Promise<boolean> {
  if (typeof source === 'string') return source.charCodeAt(0) === 0xfeff;
  const b = new Uint8Array(await source.slice(0, 3).arrayBuffer());
  return b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
}

export async function importInvoice(
  source: File | string,
  rules: MeterHistoryRules,
  opts: { fileName?: string; uploadedAt?: string; source?: 'UPLOAD' | 'DEMO'; onProgress?: (p: InvoiceImportProgress) => void } = {},
): Promise<InvoiceReport> {
  const bom = await hasBom(source);
  const analyzer = new InvoiceAnalyzer(rules);
  const totalBytes = typeof source === 'string' ? source.length : source.size;
  const fileName = opts.fileName ?? (typeof source === 'string' ? 'invoice.csv' : source.name);
  let line = 0;
  let headerDone = false;
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
            if (!headerDone) {
              delimiter = res.meta.delimiter;
              if (cells.length < 2) throw new InvoiceFormatError('Файл не похож на invoice.csv: ожидается разделитель «;» и колонки Grid.*');
              analyzer.header(cells);
              headerDone = true;
            } else analyzer.row(cells, line);
          }
          opts.onProgress?.({ rows: Math.max(0, line - 1), bytes: res.meta.cursor, totalBytes });
        } catch (e) {
          parser.abort();
          reject(e);
        }
      },
      complete: () => {
        if (!headerDone) return reject(new InvoiceFormatError('Пустой файл: нет заголовка и данных'));
        resolve(
          analyzer.finish({
            fileName,
            sizeBytes: totalBytes,
            uploadedAt: opts.uploadedAt ?? new Date().toISOString(),
            source: opts.source ?? 'UPLOAD',
            format: { bom, delimiter, decimal: ',', encoding: 'UTF-8' },
            rows: 0,
          }),
        );
      },
      error: (err: Error) => reject(err),
    });
  });
}
