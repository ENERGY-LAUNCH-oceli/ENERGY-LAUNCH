import type { MeterHistoryRules } from '@/types';

/** Правила этапа 1 по ТЗ «Кейс 4» (ред. 0.4), раздел 2.3 и 4.2. */
export const METER_HISTORY_TZ: MeterHistoryRules = {
  intervalMinutes: 15,
  periodMonths: 24,
  minCompletenessPct: 100,
  maxDuplicates: 0,
  maxInvalidTimestamps: 0,
  validatedTolerancePct: 5,
  unitRatioThreshold: 100,
  // Энергия за 15 мин не может превышать договорную мощность × 15 мин; запас 1,5 – на кратковременное превышение и округление
  maxCapacityFactor: 1.5,
  eanLength: 18,
  fields: [
    { field: 'Grid.energy_kWh.offtake_invoice', unit: 'kWh', sign: 'NON_NEGATIVE', required: true },
    { field: 'Grid.energy_kWh.offtake_invoice_validated', unit: 'kWh', sign: 'NON_NEGATIVE', required: true },
    { field: 'Grid.energy_kWh.injection_invoice', unit: 'kWh', sign: 'NON_NEGATIVE', required: true },
    { field: 'Grid.energy_kWh.injection_invoice_validated', unit: 'kWh', sign: 'NON_NEGATIVE', required: true },
    { field: 'Grid.power_kW.invoice', unit: 'kW', sign: 'ANY', required: true },
    { field: 'Grid.power_kW.CA_offtake', unit: 'kW', sign: 'NON_NEGATIVE', required: true },
    { field: 'Grid.power_kW.CA_injection', unit: 'kW', sign: 'NON_POSITIVE', required: true },
  ],
};
