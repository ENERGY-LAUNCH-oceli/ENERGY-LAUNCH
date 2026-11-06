import type { Severity } from './common';

/** Поле invoice.csv (ТЗ, раздел 9). */
export const INVOICE_FIELDS = [
  'Grid.energy_kWh.offtake_invoice',
  'Grid.energy_kWh.offtake_invoice_validated',
  'Grid.energy_kWh.injection_invoice',
  'Grid.energy_kWh.injection_invoice_validated',
  'Grid.power_kW.invoice',
  'Grid.power_kW.CA_offtake',
  'Grid.power_kW.CA_injection',
] as const;
export type InvoiceField = (typeof INVOICE_FIELDS)[number];

export const INVOICE_ISSUE_TYPES = [
  'MISSING_INTERVAL',
  'DUPLICATE_TIMESTAMP',
  'INVALID_TIMESTAMP',
  'NON_UTC_TIMESTAMP',
  'MISALIGNED_TIMESTAMP',
  'EMPTY_VALUE',
  'INVALID_NUMBER',
  'NEGATIVE_VALUE',
  'POSITIVE_VALUE',
  'SIGN_ERROR',
  'UNIT_MISMATCH',
  'MIXED_UNITS',
  'MISSING_FIELD',
  'VALIDATED_DEVIATION',
] as const;
export type InvoiceIssueType = (typeof INVOICE_ISSUE_TYPES)[number];

/** Одна найденная проблема с точным местом (ТЗ 3.1.3: интервалы и поля). */
export interface InvoiceIssue {
  type: InvoiceIssueType;
  ruleId: string;
  severity: Severity;
  /** Начало интервала (UTC) или null, если ошибка не привязана ко времени. */
  timestamp: string | null;
  /** Конец интервала для пропусков. */
  timestampTo?: string;
  /** Номер строки в файле (1 – заголовок). */
  line?: number;
  field: string;
  value: string;
  expected: string;
  explanation: string;
  action: string;
}

export type MonthCoverageState = 'FULL' | 'PARTIAL' | 'MISSING';

export interface MonthCoverage {
  /** `YYYY-MM` */
  month: string;
  expected: number;
  present: number;
  duplicates: number;
  issues: number;
  state: MonthCoverageState;
  /** Потребление и выдача за месяц по исходным значениям, kWh. */
  offtakeKwh?: number;
  injectionKwh?: number;
}

export interface FieldReport {
  field: string;
  /** Единица из заголовка колонки. */
  unit: string | null;
  expectedUnit: string;
  present: boolean;
  values: number;
  empty: number;
  invalid: number;
  signViolations: number;
  unitSuspect: number;
  min: number | null;
  max: number | null;
}

export interface InvoiceFileMeta {
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  source: 'UPLOAD' | 'DEMO';
  format: { bom: boolean; delimiter: string; decimal: string; encoding: string };
  rows: number;
}

/** Отчёт анализа invoice.csv. Строки файла не хранятся – только агрегаты и проблемы. */
export interface InvoiceReport {
  meta: InvoiceFileMeta;
  period: { first: string | null; last: string | null };
  /** Медианный шаг исходных данных, минуты (исходная детализация сохраняется). */
  detectedStepMinutes: number | null;
  /** Окно проверки. checkPoint/timezone – если окно привязано к точке проверки (набор правил 1.5+). */
  window: { from: string; to: string; months: MonthCoverage[]; checkPoint?: string; timezone?: string } | null;
  /** Строк вне окна проверки (не анализируются). */
  outsideWindow?: number;
  /** Что обработано согласованным правилом пустых значений (набор 1.5+). */
  valuePolicy?: { lagEmpty: number; fallbackUsed: number; infoEmpty: Record<string, number>; publicationLagDays: number; lagFrom: string | null };
  missingMonths: string[];
  completeness: { expected: number; present: number; missing: number; pct: number };
  duplicates: number;
  invalidTimestamps: number;
  fields: FieldReport[];
  /** Коды EAN, найденные в колонках файла (если есть). Сверяются с паспортом при проверке. */
  fileEan: { offtake: string[]; injection: string[] };
  issueCounts: Partial<Record<InvoiceIssueType, number>>;
  issues: InvoiceIssue[];
  /** Сколько проблем не попало в список (ограничение памяти). */
  issuesTruncated: number;
}

/** Запись о прогоне проверок этапа 1 (подтверждение: ТЗ 3.1.2, п. 8 фазы 06). */
export interface InvoiceValidationRun {
  id: string;
  /** Порядковый номер прогона по объекту. */
  run: number;
  datasetVersion: number;
  source: 'UPLOAD' | 'DEMO';
  fileName: string;
  result: 'PASSED' | 'FAILED';
  failedRules: string[];
  at: string;
  rulesetVersion: string;
  params: Record<string, string | number>;
  rowsProcessed: number;
}
