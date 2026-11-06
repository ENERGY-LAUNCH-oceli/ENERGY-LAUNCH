import type { Id, IsoDateTime } from './common';
import type { InvoiceReport } from './invoice';
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

/** Этап 1 (Meter History): отчёт анализа официальной выгрузки invoice.csv. */
export interface InvoiceDataset extends DatasetBase {
  kind: 'INVOICE';
  /** Номер загрузки по объекту: повторная загрузка получает новую версию, старая остаётся в истории. */
  version: number;
  report: InvoiceReport;
}

/** Этап 2 (Real-time Telemetry): поток оперативных измерений. */
export interface TelemetryDataset extends DatasetBase {
  kind: 'TELEMETRY';
  measurements: Measurement[];
}

export type Dataset = InvoiceDataset | TelemetryDataset;
