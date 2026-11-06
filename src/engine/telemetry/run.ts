import type { SitePassport, TelemetryDatasetV2, TelemetryRules, TelemetryValidationRun, ValidationResult } from '@/types';

/** Подтверждение прогона этапа 2: входы (версии паспорта и данных), параметры, результат. */
export function makeTelemetryRun(ds: TelemetryDatasetV2 | undefined, passport: SitePassport | undefined, results: readonly ValidationResult[], rules: TelemetryRules, rulesetVersion: string, at: string, previous: readonly TelemetryValidationRun[]): TelemetryValidationRun {
  const failed = results.filter((r) => r.blocking && r.status !== 'PASSED' && r.status !== 'NOT_APPLICABLE').map((r) => r.ruleId);
  return {
    id: `trun-${previous.length + 1}-${at}`,
    run: previous.length + 1,
    datasetVersion: ds?.version ?? 0,
    passportVersion: passport?.version ?? 0,
    fileName: ds?.report.meta.fileName ?? '–',
    passportFile: passport?.fileName ?? '–',
    result: failed.length ? 'FAILED' : 'PASSED',
    failedRules: failed,
    at,
    checkPoint: ds?.report.checkPoint ?? rules.checkPoint,
    rulesetVersion,
    params: { intervalMinutes: rules.intervalMinutes, windowHours: rules.windowHours, minCompletenessPct: rules.minCompletenessPct, maxAgeMinutes: rules.maxAgeMinutes },
    rowsProcessed: ds?.report.meta.rows ?? 0,
    signalsChecked: ds?.report.signals.filter((s) => s.required).length ?? 0,
  };
}
