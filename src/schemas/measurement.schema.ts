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

