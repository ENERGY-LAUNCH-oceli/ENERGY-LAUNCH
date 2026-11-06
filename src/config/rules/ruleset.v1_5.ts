import type { RulesConfig } from '@/types';
import { RULESET_V1_4 } from './ruleset.v1_4';

/** Точка проверки набора кейса 4: конец телеметрии всех объектов (ТЗ, глоссарий «Точка проверки»). */
export const CASE4_CHECK_POINT = '2026-11-05T10:00:00.000Z';

/**
 * v1.5.0 – сверка с реальным набором кейса 4 (Building1–6):
 * - история: окно 24 месяца до местной полуночи дня точки проверки (Europe/Brussels), а не по календарным месяцам
 *   последней метки; строки вне окна не анализируются;
 * - согласованное правило пустых значений: энергия = исходное или валидированное значение; пустые значения
 *   в последние 5 суток – задержка публикации; пустые мощность и CA – информация (ПОДТВЕРДИТЬ у кейсодержателей);
 * - телеметрия: сигналы управления (setpoint) – событийные: проверяется наличие, но не полнота и актуальность.
 */
export const RULESET_V1_5: RulesConfig = {
  ...RULESET_V1_4,
  version: '1.5.0',
  effectiveFrom: '2026-11-06',
  description: 'Сверено с набором кейса 4: окно истории от точки проверки, событийные сигналы управления',
  meterHistory: {
    ...RULESET_V1_4.meterHistory,
    checkPoint: CASE4_CHECK_POINT,
    timezone: 'Europe/Brussels',
    valuePairs: [
      ['Grid.energy_kWh.offtake_invoice', 'Grid.energy_kWh.offtake_invoice_validated'],
      ['Grid.energy_kWh.injection_invoice', 'Grid.energy_kWh.injection_invoice_validated'],
    ],
    publicationLagDays: 5,
    infoOnlyEmptyFields: ['Grid.power_kW.invoice', 'Grid.power_kW.CA_offtake', 'Grid.power_kW.CA_injection'],
  },
  telemetry: {
    ...RULESET_V1_4.telemetry,
    checkPoint: CASE4_CHECK_POINT,
    eventSignals: ['{asset}.power_kW.setpoint_sent', '{asset}.power_kW.setpoint_received', '{asset}.setpoint_sent'],
  },
};
