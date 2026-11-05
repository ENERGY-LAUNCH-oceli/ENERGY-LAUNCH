import { z } from 'zod';
import {
  CONTROL_COMMAND_TYPES,
  DASHBOARD_BLOCK_TYPES,
  EVIDENCE_TYPES,
  SIGNAL_KINDS,
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
      checkPeriodDays: positiveNumberSchema,
      minCompletenessPct: percentSchema,
      maxConsecutiveGaps: z.number().int().min(0),
      invoiceTolerancePct: percentSchema,
    }),
    telemetry: z.object({
      expectedFrequencySec: positiveNumberSchema,
      frequencyTolerancePct: percentSchema,
      minCompletenessPct: percentSchema,
      maxLatencySec: positiveNumberSchema,
      latencyPercentile: z.number().gt(0).max(100),
      observationPeriodHours: positiveNumberSchema,
      requiredSignals: z.array(z.enum(SIGNAL_KINDS)),
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
