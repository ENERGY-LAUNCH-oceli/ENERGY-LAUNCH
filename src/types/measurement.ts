import type { Id, IsoDateTime } from './common';

export const MEASUREMENT_UNITS = [
  'kWh',
  'MWh',
  'kW',
  'MW',
  'kvar',
  'Mvar',
  'V',
  'kV',
  'A',
  'Hz',
  '%',
  'W/m2',
  'state',
] as const;
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];

export const MEASUREMENT_QUALITIES = ['GOOD', 'ESTIMATED', 'SUSPECT', 'MISSING'] as const;
export type MeasurementQuality = (typeof MEASUREMENT_QUALITIES)[number];

/** Единичное измерение сигнала. Для интервального учёта `timestamp` — начало интервала. */
export interface Measurement {
  signalId: Id;
  timestamp: IsoDateTime;
  /** `null` — значение отсутствует (пропуск). */
  value: number | null;
  unit: MeasurementUnit;
  quality: MeasurementQuality;
  /** Время получения платформой — для расчёта задержки телеметрии. */
  receivedAt?: IsoDateTime;
}
