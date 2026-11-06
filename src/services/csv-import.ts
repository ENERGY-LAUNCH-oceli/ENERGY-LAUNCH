import Papa from 'papaparse';
import type { z } from 'zod';
import { measurementCsvRowSchema } from '@/schemas';
import type { Measurement } from '@/types';

export interface CsvRowError {
  /** Номер строки в файле (1 — заголовок, данные с 2). */
  row: number;
  field?: string;
  message: string;
}

export interface CsvImportResult<T> {
  rows: T[];
  errors: CsvRowError[];
  totalRows: number;
}

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Разбор CSV с проверкой каждой строки схемой Zod. Не бросает исключений на плохих данных. */
export function parseCsv<S extends z.ZodType>(text: string, schema: S): CsvImportResult<z.output<S>> {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
    transform: (v) => v.trim(),
  });

  const errors: CsvRowError[] = parsed.errors.map((e) => ({ row: (e.row ?? 0) + 2, message: e.message }));
  const rows: z.output<S>[] = [];
  parsed.data.forEach((raw, i) => {
    const result = schema.safeParse(raw);
    if (result.success) rows.push(result.data);
    else
      for (const issue of result.error.issues) {
        errors.push({ row: i + 2, field: issue.path.join('.') || undefined, message: issue.message } as CsvRowError);
      }
  });
  return { rows, errors, totalRows: parsed.data.length };
}

/** CSV: timestamp, signal_id, value, unit, quality?, received_at? */
export function parseMeasurementsCsv(text: string): CsvImportResult<Measurement> {
  return parseCsv(text, measurementCsvRowSchema);
}

export const readFileAsText = (file: File): Promise<string> => file.text();
