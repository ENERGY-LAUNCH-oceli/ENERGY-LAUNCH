import Papa from 'papaparse';
import type { z } from 'zod';
import { invoiceCsvRowSchema, measurementCsvRowSchema, type InvoiceCsvRow } from '@/schemas';
import type { InvoiceLine, Measurement } from '@/types';

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

/** CSV: metering_point_id, period_start, period_end, energy_kwh, tariff_zone? */
export function parseInvoiceCsv(text: string, newId: () => string = () => crypto.randomUUID()): CsvImportResult<InvoiceLine> {
  const result = parseCsv(text, invoiceCsvRowSchema);
  return {
    ...result,
    rows: result.rows.map((r: InvoiceCsvRow) => ({
      id: newId(),
      meteringPointId: r.metering_point_id,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      energyKwh: r.energy_kwh,
      ...(r.tariff_zone ? { tariffZone: r.tariff_zone } : {}),
    })),
  };
}

export const readFileAsText = (file: File): Promise<string> => file.text();
