import { z } from 'zod';
import {
  ASSET_TYPES,
  ENERGY_OBJECT_STATUSES,
  ENERGY_OBJECT_TYPES,
  MEASUREMENT_UNITS,
  SIGNAL_DIRECTIONS,
  SIGNAL_KINDS,
  type EnergyObject,
} from '@/types';
import { idSchema, isoDateSchema, isoDateTimeSchema } from './primitives';

export const assetSignalSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  kind: z.enum(SIGNAL_KINDS),
  tag: z.string().min(1),
  unit: z.enum(MEASUREMENT_UNITS),
  direction: z.enum(SIGNAL_DIRECTIONS),
  samplingSec: z.number().positive().optional(),
  meteringPointId: idSchema.optional(),
});

export const assetSchema = z.object({
  id: idSchema,
  objectId: idSchema,
  type: z.enum(ASSET_TYPES),
  name: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  ratedPowerMw: z.number().nonnegative().optional(),
  controllable: z.boolean(),
  signals: z.array(assetSignalSchema),
});

export const gridConnectionSchema = z.object({
  id: idSchema,
  objectId: idSchema,
  gridOperator: z.string().min(1),
  pointOfConnection: z.string().min(1),
  voltageLevelKv: z.number().positive(),
  maxCapacityMw: z.number().positive(),
  meteringPointIds: z.array(idSchema).min(1),
  agreementNumber: z.string().optional(),
  agreementDate: isoDateSchema.optional(),
});

export const objectPassportSchema = z.object({
  objectId: idSchema,
  passportNumber: z.string().min(1),
  owner: z.string().min(1),
  operator: z.string().min(1),
  installedCapacityMw: z.number().positive(),
  timezone: z.string().min(1),
  location: z.object({
    region: z.string().min(1),
    address: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  plannedLaunchDate: isoDateSchema.optional(),
  documents: z.array(
    z.object({
      id: idSchema,
      title: z.string().min(1),
      reference: z.string().min(1),
      issuedAt: isoDateSchema.optional(),
    }),
  ),
});

export const energyObjectSchema = z.object({
  id: idSchema,
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(ENERGY_OBJECT_TYPES),
  status: z.enum(ENERGY_OBJECT_STATUSES),
  passport: objectPassportSchema,
  gridConnection: gridConnectionSchema,
  assets: z.array(assetSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}) satisfies z.ZodType<EnergyObject>;
