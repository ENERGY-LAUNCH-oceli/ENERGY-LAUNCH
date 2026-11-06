import type { Severity } from './common';

/** Паспорт объекта object.json в формате кейса (ТЗ 5.1). Поля — snake_case, как в исходном файле. */
export interface ObjectJson {
  object_id: string;
  name: string;
  address: { street: string | null; postal_code: string | null; city: string | null; country: string | null } | null;
  coordinates: { lat: number | null; lon: number | null } | null;
  timezone: string;
  grid_connection: { ean_offtake: string | null; ean_injection: string | null };
  assets: { asset_id: string; type: string; signals: string[] }[];
  site_signals: string[];
  data_files: { invoice: string | null; telemetry: string | null };
  csv_format?: { delimiter?: string; decimal?: string; encoding?: string; timestamp_format?: string; step_minutes?: number } | null;
  [extra: string]: unknown;
}

export type PassportAssetType = 'PV' | 'BATTERY';

export interface PassportAsset {
  assetId: string;
  type: PassportAssetType;
  /** Префикс сигналов в telemetry.csv: `PV1`, `Battery2`, `PV` (единственный актив). */
  prefix: string;
  signals: string[];
}

/** Нормализованный паспорт объекта. */
export interface SitePassport {
  version: number;
  source: 'UPLOAD' | 'DEMO';
  fileName: string;
  loadedAt: string;
  objectId: string;
  name: string;
  address: string | null;
  coordinates: { lat: number; lon: number } | null;
  timezone: string;
  ean: { offtake: string | null; injection: string | null };
  assets: PassportAsset[];
  siteSignals: string[];
  dataFiles: { invoice: string | null; telemetry: string | null };
  csvFormat: { delimiter: string; decimal: string; encoding: string; stepMinutes: number };
  /** Замечания к самому паспорту (неизвестный тип актива, пустая карта и т. п.). */
  warnings: string[];
}

export type SignalScope = 'GRID' | 'ASSET' | 'TOTAL' | 'SITE';

/** Обязательный сигнал, выведенный из паспорта. */
export interface RequiredSignal {
  signal: string;
  scope: SignalScope;
  /** `GRID` или asset_id. */
  owner: string;
  assetType: PassportAssetType | 'GRID';
  unit: string;
  /** Есть ли сигнал в карте сигналов паспорта. */
  inPassport: boolean;
}

/** Причина проблемы с сигналом (ТЗ: различать отсутствие сигнала, связи, привязки и неисправность). */
export type SignalDiagnosis =
  | 'OK'
  | 'NOT_IN_MAP'
  | 'NOT_IN_DATA'
  | 'NO_COMMUNICATION'
  | 'STALE'
  | 'INCOMPLETE'
  | 'WRONG_BINDING'
  | 'INVALID_DATA'
  | 'SUSPICIOUS';

/** Состояние ячейки тепловой карты (15-минутный интервал). */
export type HeatState = 'G' | 'M' | 'D' | 'I' | 'S';

export interface SignalReport {
  signal: string;
  owner: string;
  assetType: PassportAssetType | 'GRID';
  scope: SignalScope;
  required: boolean;
  inPassport: boolean;
  inData: boolean;
  unit: string | null;
  expectedUnit: string;
  lastTimestamp: string | null;
  /** Возраст последнего значения относительно точки проверки, минуты. */
  ageMinutes: number | null;
  expected: number;
  received: number;
  missing: number;
  completenessPct: number;
  invalid: number;
  suspicious: number;
  diagnosis: SignalDiagnosis;
  /** Состояние каждого интервала окна (строка из HeatState, длина = expected). */
  heat: string;
}

export const TELEMETRY_ISSUE_TYPES = [
  'SIGNAL_NOT_IN_MAP',
  'SIGNAL_NOT_IN_DATA',
  'NO_COMMUNICATION',
  'STALE_SIGNAL',
  'INCOMPLETE_SIGNAL',
  'FOREIGN_SIGNAL',
  'FOREIGN_OBJECT',
  'UNIT_MISMATCH',
  'OUT_OF_RANGE',
  'NEGATIVE_PV',
  'SOC_OUT_OF_RANGE',
  'SIGN_ERROR',
  'INVALID_NUMBER',
  'INVALID_TIMESTAMP',
  'NON_UTC_TIMESTAMP',
  'DUPLICATE_TIMESTAMP',
  'SETPOINT_MISMATCH',
  'SOC_JUMP',
] as const;
export type TelemetryIssueType = (typeof TELEMETRY_ISSUE_TYPES)[number];

export interface TelemetryIssue {
  type: TelemetryIssueType;
  ruleId: string;
  severity: Severity;
  diagnosis: SignalDiagnosis;
  owner: string;
  signal: string;
  timestamp: string | null;
  line?: number;
  value: string;
  expected: string;
  explanation: string;
  action: string;
}

export interface TelemetryReport {
  meta: { fileName: string; sizeBytes: number; uploadedAt: string; source: 'UPLOAD' | 'DEMO'; rows: number; format: { bom: boolean; delimiter: string; decimal: string; encoding: string } };
  checkPoint: string;
  window: { from: string; to: string; stepMinutes: number; slots: number };
  period: { first: string | null; last: string | null };
  signals: SignalReport[];
  /** Колонки файла, которых нет в паспорте (чужие активы/объекты). */
  foreignColumns: string[];
  objectIdsInFile: string[];
  issueCounts: Partial<Record<TelemetryIssueType, number>>;
  issues: TelemetryIssue[];
  issuesTruncated: number;
}

export interface TelemetryDatasetV2 {
  kind: 'TELEMETRY';
  id: string;
  objectId: string;
  version: number;
  report: TelemetryReport;
}

/** Подтверждение прогона проверок этапа 2. */
export interface TelemetryValidationRun {
  id: string;
  run: number;
  datasetVersion: number;
  passportVersion: number;
  fileName: string;
  passportFile: string;
  result: 'PASSED' | 'FAILED';
  failedRules: string[];
  at: string;
  checkPoint: string;
  rulesetVersion: string;
  params: Record<string, string | number>;
  rowsProcessed: number;
  signalsChecked: number;
}
