import type { TelemetryRules } from '@/types';

/** Правила этапа 2 по ТЗ «Кейс 4» (ред. 0.4), разделы 2.3, 4.2, 9. Пороги 99 % и 30 минут – настройки демонстрации. */
export const TELEMETRY_TZ: TelemetryRules = {
  intervalMinutes: 15,
  windowHours: 48,
  minCompletenessPct: 99,
  maxAgeMinutes: 30,
  checkPoint: '2026-11-05T10:00:00.000Z',
  requiredGrid: ['Grid.power_kW', 'Grid.energy_kWh.offtake', 'Grid.energy_kWh.injection'],
  requiredPv: ['{asset}.power_kW', '{asset}.energy_kWh.production', '{asset}.power_kW.setpoint_received'],
  requiredBattery: [
    '{asset}.power_kW',
    '{asset}.power_kW.setpoint_sent',
    '{asset}.power_kW.setpoint_received',
    '{asset}.setpoint_sent',
    '{asset}.energy_kWh.charge',
    '{asset}.energy_kWh.discharge',
    '{asset}.SOC_%',
  ],
  maxAbsPowerKw: 5000,
  maxEnergyKwhPerInterval: 1250,
  maxSocJumpPct: 40,
  setpointToleranceKw: 1,
};
