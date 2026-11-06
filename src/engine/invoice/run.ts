import type { InvoiceDataset, InvoiceValidationRun, MeterHistoryRules, ValidationResult } from '@/types';

/** Запись подтверждения прогона: источник, файл, результат, время, версия правил, параметры, строки. */
export function makeInvoiceRun(
  ds: InvoiceDataset | undefined,
  results: readonly ValidationResult[],
  rules: MeterHistoryRules,
  rulesetVersion: string,
  at: string,
  previous: readonly InvoiceValidationRun[],
): InvoiceValidationRun {
  const failed = results.filter((r) => r.blocking && r.status !== 'PASSED' && r.status !== 'NOT_APPLICABLE').map((r) => r.ruleId);
  return {
    id: `run-${previous.length + 1}-${at}`,
    run: previous.length + 1,
    datasetVersion: ds?.version ?? 0,
    source: ds?.report.meta.source ?? 'UPLOAD',
    fileName: ds?.report.meta.fileName ?? '–',
    result: failed.length ? 'FAILED' : 'PASSED',
    failedRules: failed,
    at,
    rulesetVersion,
    params: {
      intervalMinutes: rules.intervalMinutes,
      periodMonths: rules.periodMonths,
      minCompletenessPct: rules.minCompletenessPct,
      maxDuplicates: rules.maxDuplicates,
      validatedTolerancePct: rules.validatedTolerancePct,
    },
    rowsProcessed: ds?.report.meta.rows ?? 0,
  };
}
