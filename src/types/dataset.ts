import type { Id, IsoDateTime } from './common';
import type { Measurement } from './measurement';

export const DATASET_SOURCES = ['CSV_IMPORT', 'DEMO', 'API'] as const;
export type DatasetSource = (typeof DATASET_SOURCES)[number];

interface DatasetBase {
  id: Id;
  objectId: Id;
  source: DatasetSource;
  fileName?: string;
  importedAt: IsoDateTime;
  periodStart: IsoDateTime;
  /** Конец периода (не включительно). */
  periodEnd: IsoDateTime;
}

/** Строка счёта за электроэнергию по точке поставки. */
export interface InvoiceLine {
  id: Id;
  meteringPointId: Id;
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
  energyKwh: number;
  tariffZone?: string;
}

/** Интервальная история прибора учёта по точке поставки. */
export interface MeterSeries {
  meteringPointId: Id;
  signalId: Id;
  measurements: Measurement[];
}

/** Этап 1 (Meter History): счета + история приборов учёта для сверки. */
export interface InvoiceDataset extends DatasetBase {
  kind: 'INVOICE';
  invoiceNumber: string;
  supplier: string;
  lines: InvoiceLine[];
  meterSeries: MeterSeries[];
}

/** Этап 2 (Real-time Telemetry): поток оперативных измерений. */
export interface TelemetryDataset extends DatasetBase {
  kind: 'TELEMETRY';
  measurements: Measurement[];
}

export type Dataset = InvoiceDataset | TelemetryDataset;
