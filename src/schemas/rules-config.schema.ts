import { z } from 'zod';
import {
  CONTROL_COMMAND_TYPES,
  SIGNAL_KINDS,
  DASHBOARD_BLOCK_TYPES,
  EVIDENCE_TYPES,
  type RulesConfig,
} from '@/types';
import { confirmationRoleSchema, percentSchema, positiveNumberSchema } from './primitives';

const confirmationRequirementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  role: confirmationRoleSchema,
  evidenceTypes: z.array(z.enum(EVIDENCE_TYPES)).min(1),
  minEvidence: z.number().int().min(0),
});

export const rulesConfigSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Версия должна быть в формате SemVer'),
    effectiveFrom: z.iso.date(),
    description: z.string(),
    sourceDocuments: z.array(z.object({ code: z.string(), title: z.string() })),
    provisional: z.boolean(),
    meterHistory: z.object({
      intervalMinutes: positiveNumberSchema,
      periodMonths: z.number().int().positive(),
      minCompletenessPct: percentSchema,
      maxDuplicates: z.number().int().min(0),
      maxInvalidTimestamps: z.number().int().min(0),
      validatedTolerancePct: percentSchema,
      unitRatioThreshold: positiveNumberSchema,
      maxCapacityFactor: positiveNumberSchema.optional(),
      eanLength: z.number().int().positive(),
      fields: z.array(z.object({ field: z.string().min(1), unit: z.string().min(1), sign: z.enum(['NON_NEGATIVE', 'NON_POSITIVE', 'ANY']), required: z.boolean() })).min(1),
      checkPoint: z.iso.datetime({ offset: true }).optional(),
      timezone: z.string().min(1).optional(),
      valuePairs: z.array(z.tuple([z.string(), z.string()])).optional(),
      publicationLagDays: z.number().min(0).optional(),
      infoOnlyEmptyFields: z.array(z.string()).optional(),
    }),
    telemetry: z.object({
      intervalMinutes: positiveNumberSchema,
      windowHours: positiveNumberSchema,
      minCompletenessPct: percentSchema,
      maxAgeMinutes: positiveNumberSchema,
      checkPoint: z.iso.datetime({ offset: true }),
      requiredGrid: z.array(z.string().min(1)),
      requiredPv: z.array(z.string().min(1)),
      requiredBattery: z.array(z.string().min(1)),
      maxAbsPowerKw: positiveNumberSchema,
      maxEnergyKwhPerInterval: positiveNumberSchema,
      maxSocJumpPct: percentSchema,
      setpointToleranceKw: z.number().min(0),
      eventSignals: z.array(z.string().min(1)).optional(),
    }),
    control: z
      .object({
        requiredCommandTypes: z.array(z.enum(CONTROL_COMMAND_TYPES)),
        maxAcknowledgeSec: positiveNumberSchema,
        maxExecutionSec: positiveNumberSchema,
        minIntervalBetweenCommandsSec: z.number().min(0),
        maxIntervalBetweenCommandsSec: positiveNumberSchema,
        setpointTolerancePct: percentSchema,
      })
      .refine((c) => c.minIntervalBetweenCommandsSec <= c.maxIntervalBetweenCommandsSec, {
        message: 'minIntervalBetweenCommandsSec не может превышать maxIntervalBetweenCommandsSec',
      }),
    controlTesting: z
      .object({
        ackTimeoutSec: positiveNumberSchema,
        responseWindowSec: positiveNumberSchema,
        observationSec: positiveNumberSchema,
        toleranceKw: z.number().min(0),
        tolerancePct: percentSchema,
        minStepKw: z.number().min(0),
        requireBatterySetpoint: z.boolean(),
        requirePvCurtailment: z.boolean(),
      })
      .refine((c) => c.observationSec > c.responseWindowSec, { message: 'observationSec должен быть больше responseWindowSec' })
      .optional(),
    dashboardConfig: z
      .object({
        requiredWidgets: z.object({
          METER_HISTORY: z.array(z.string()),
          ASSETS: z.array(z.string()),
          CONTROL: z.array(z.string()),
          QUALITY_STATUS: z.array(z.string()),
        }),
        requireAcceptance: z.boolean(),
      })
      .optional(),
    dashboards: z.object({
      requiredBlockTypes: z.array(z.enum(DASHBOARD_BLOCK_TYPES)),
      requiredSignals: z.array(z.enum(SIGNAL_KINDS)),
      requirePublished: z.boolean(),
    }),
    confirmations: z.object({
      METER_HISTORY: z.array(confirmationRequirementSchema),
      REALTIME_TELEMETRY: z.array(confirmationRequirementSchema),
      ASSET_CONTROL: z.array(confirmationRequirementSchema),
      FINAL_DASHBOARDS: z.array(confirmationRequirementSchema),
    }),
  }) satisfies z.ZodType<RulesConfig>;
