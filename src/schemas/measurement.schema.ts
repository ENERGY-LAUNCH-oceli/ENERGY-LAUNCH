import { z } from 'zod';
import { MEASUREMENT_QUALITIES, MEASUREMENT_UNITS, type Measurement } from '@/types';
import { idSchema, isoDateTimeSchema } from './primitives';

export const measurementSchema = z.object({
  signalId: idSchema,
  timestamp: isoDateTimeSchema,
  value: z.number().finite().nullable(),
  unit: z.enum(MEASUREMENT_UNITS),
  quality: z.enum(MEASUREMENT_QUALITIES),
  receivedAt: isoDateTimeSchema.optional(),
}) satisfies z.ZodType<Measurement>;

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/**
 * Строка CSV телеметрии / интервального учёта.
 * Колонки: timestamp, signal_id, value, unit, quality?, received_at?
 */
export const measurementCsvRowSchema = z
  .object({
    timestamp: isoDateTimeSchema,
    signal_id: idSchema,
    value: z.preprocess(emptyToUndefined, z.coerce.number().finite().optional()),
    unit: z.enum(MEASUREMENT_UNITS),
    quality: z.preprocess(emptyToUndefined, z.enum(MEASUREMENT_QUALITIES).optional()),
    received_at: z.preprocess(emptyToUndefined, isoDateTimeSchema.optional()),
  })
  .transform(
    (row): Measurement => ({
      signalId: row.signal_id,
      timestamp: row.timestamp,
      value: row.value ?? null,
      unit: row.unit,
      quality: row.quality ?? (row.value === undefined ? 'MISSING' : 'GOOD'),
      ...(row.received_at ? { receivedAt: row.received_at } : {}),
    }),
  );

/**
 * Строка CSV счёта.
 * Колонки: metering_point_id, period_start, period_end, energy_kwh, tariff_zone?
 */
export const invoiceCsvRowSchema = z
  .object({
    metering_point_id: idSchema,
    period_start: isoDateTimeSchema,
    period_end: isoDateTimeSchema,
    energy_kwh: z.coerce.number().finite().min(0),
    tariff_zone: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .refine((r) => Date.parse(r.period_end) > Date.parse(r.period_start), {
    message: 'period_end должен быть позже period_start',
    path: ['period_end'],
  });

export type InvoiceCsvRow = z.infer<typeof invoiceCsvRowSchema>;
