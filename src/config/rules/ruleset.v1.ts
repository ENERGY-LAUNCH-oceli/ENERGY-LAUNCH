import type { RulesConfig } from '@/types';

/**
 * Набор правил v1.0.0.
 *
 * ВНИМАНИЕ: значения помечены `provisional: true` — они заданы как рабочие
 * значения по умолчанию и подлежат сверке с первоисточниками:
 *   - Техническое задание «Кейс 4. Запуск энергетического объекта на платформе»;
 *   - Паспорт кейса OE-04.
 * При расхождении создаётся новая версия набора (ruleset.vX.ts), а не правка этой.
 */
export const RULESET_V1: RulesConfig = {
  version: '1.0.0',
  effectiveFrom: '2026-11-01',
  description: 'Базовый набор правил запуска энергетического объекта',
  sourceDocuments: [
    { code: 'TZ-CASE-4', title: 'ТЗ «Кейс 4. Запуск энергетического объекта на платформе»' },
    { code: 'OE-04', title: 'Паспорт кейса OE-04' },
  ],
  provisional: true,

  meterHistory: {
    intervalMinutes: 30,
    checkPeriodDays: 30,
    minCompletenessPct: 98,
    maxConsecutiveGaps: 4,
    invoiceTolerancePct: 1,
  },

  telemetry: {
    expectedFrequencySec: 60,
    frequencyTolerancePct: 10,
    minCompletenessPct: 95,
    maxLatencySec: 30,
    latencyPercentile: 95,
    observationPeriodHours: 24,
    requiredSignals: ['ACTIVE_POWER', 'REACTIVE_POWER', 'VOLTAGE', 'FREQUENCY', 'BREAKER_STATE'],
  },

  control: {
    requiredCommandTypes: ['ACTIVE_POWER_SETPOINT', 'REACTIVE_POWER_SETPOINT', 'STOP', 'START'],
    maxAcknowledgeSec: 5,
    maxExecutionSec: 60,
    minIntervalBetweenCommandsSec: 60,
    maxIntervalBetweenCommandsSec: 900,
    setpointTolerancePct: 2,
  },

  dashboards: {
    requiredBlockTypes: ['KPI', 'TIME_SERIES', 'STATUS', 'ALERTS'],
    requiredSignals: ['ACTIVE_POWER', 'REACTIVE_POWER', 'ENERGY_EXPORT', 'BREAKER_STATE'],
    requirePublished: true,
  },

  confirmations: {
    METER_HISTORY: [
      {
        id: 'MH-CONF-OWNER',
        title: 'Владелец подтверждает корректность сверки счетов и истории учёта',
        role: 'OBJECT_OWNER',
        evidenceTypes: ['VALIDATION_REPORT', 'SIGNED_ACT'],
        minEvidence: 1,
      },
    ],
    REALTIME_TELEMETRY: [
      {
        id: 'TM-CONF-ENGINEER',
        title: 'Инженер ПНР подтверждает качество потока телеметрии',
        role: 'COMMISSIONING_ENGINEER',
        evidenceTypes: ['VALIDATION_REPORT', 'SCREENSHOT'],
        minEvidence: 1,
      },
    ],
    ASSET_CONTROL: [
      {
        id: 'CT-CONF-ENGINEER',
        title: 'Инженер ПНР подтверждает результаты испытаний управления',
        role: 'COMMISSIONING_ENGINEER',
        evidenceTypes: ['COMMAND_LOG', 'VALIDATION_REPORT'],
        minEvidence: 1,
      },
      {
        id: 'CT-CONF-DISPATCHER',
        title: 'Диспетчер подтверждает исполнение команд',
        role: 'DISPATCHER',
        evidenceTypes: ['SIGNED_ACT', 'COMMAND_LOG'],
        minEvidence: 1,
      },
    ],
    FINAL_DASHBOARDS: [
      {
        id: 'DB-CONF-OWNER',
        title: 'Владелец принимает итоговые панели мониторинга',
        role: 'OBJECT_OWNER',
        evidenceTypes: ['SIGNED_ACT'],
        minEvidence: 1,
      },
    ],
  },
};
