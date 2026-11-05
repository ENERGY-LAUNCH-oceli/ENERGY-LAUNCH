import type { AssetSignal, TelemetryDataset, TelemetryRules, ValidationResult } from '@/types';
import { analyzeGrid, deltas, groupBy, makeResult, median, MS, percentile, round, sortByTime, toMs, type ValidatorEnv } from './helpers';

/** Этап 2: качество потока телеметрии в реальном времени. */
export function validateTelemetry(
  dataset: TelemetryDataset | undefined,
  signals: readonly AssetSignal[],
  rules: TelemetryRules,
  env: ValidatorEnv,
): ValidationResult[] {
  const measurements = dataset?.measurements ?? [];
  const bySignal = groupBy(measurements, (m) => m.signalId);

  // TM-001 — обязательные сигналы: сигнал есть в модели объекта и по нему есть данные
  const coverage = rules.requiredSignals.map((kind) => {
    const candidates = signals.filter((s) => s.kind === kind && s.direction !== 'WRITE');
    const withData = candidates.filter((s) => (bySignal.get(s.id)?.length ?? 0) > 0);
    return { kind, signalIds: withData.map((s) => s.id), covered: withData.length > 0 };
  });
  const missing = coverage.filter((c) => !c.covered).map((c) => c.kind);
  const coverageResult = makeResult(
    'TM-001',
    missing.length === 0,
    {
      message: missing.length ? `Нет данных по сигналам: ${missing.join(', ')}` : 'Все обязательные сигналы поступают',
      actual: rules.requiredSignals.length - missing.length,
      expected: rules.requiredSignals.length,
      details: { missing },
    },
    env,
  );

  if (!dataset || measurements.length === 0) {
    return [
      coverageResult,
      ...(['TM-002', 'TM-003', 'TM-004', 'TM-005'] as const).map((id) =>
        makeResult(id, 'SKIPPED', { message: 'Поток телеметрии не загружен' }, env),
      ),
    ];
  }

  const requiredIds = new Set(coverage.flatMap((c) => c.signalIds));
  const checkedIds = [...requiredIds];
  const startMs = toMs(dataset.periodStart);
  const endMs = toMs(dataset.periodEnd);
  const stepMs = rules.expectedFrequencySec * MS.second;

  // TM-002 — частота
  const freq = checkedIds.map((id) => {
    const m = median(deltas(sortByTime(bySignal.get(id) ?? [])));
    return { signalId: id, medianSec: m === null ? null : round(m / MS.second) };
  });
  const maxAllowedSec = rules.expectedFrequencySec * (1 + rules.frequencyTolerancePct / 100);
  const slow = freq.filter((f) => f.medianSec === null || f.medianSec > maxAllowedSec);
  const worstFreq = Math.max(0, ...freq.map((f) => f.medianSec ?? Infinity));
  const freqResult = makeResult(
    'TM-002',
    slow.length === 0,
    {
      message: `Худший медианный период: ${worstFreq} с (ожидается ${rules.expectedFrequencySec} с ±${rules.frequencyTolerancePct}%)`,
      actual: Number.isFinite(worstFreq) ? worstFreq : null,
      expected: rules.expectedFrequencySec,
      details: { freq },
    },
    env,
  );

  // TM-003 — полнота
  const grids = checkedIds.map((id) => ({ signalId: id, ...analyzeGrid(bySignal.get(id) ?? [], startMs, endMs, stepMs) }));
  const minCompleteness = grids.length ? Math.min(...grids.map((g) => g.completenessPct)) : 0;
  const completenessResult = makeResult(
    'TM-003',
    minCompleteness >= rules.minCompletenessPct,
    {
      message: `Минимальная полнота по сигналам: ${minCompleteness}% (порог ${rules.minCompletenessPct}%)`,
      actual: minCompleteness,
      expected: rules.minCompletenessPct,
      details: { grids },
    },
    env,
  );

  // TM-004 — задержка
  const latencies = measurements
    .filter((m) => m.receivedAt && requiredIds.has(m.signalId))
    .map((m) => (toMs(m.receivedAt!) - toMs(m.timestamp)) / MS.second);
  const pLatency = percentile(latencies, rules.latencyPercentile);
  const latencyResult =
    pLatency === null
      ? makeResult('TM-004', false, { message: 'Нет отметок времени получения (receivedAt) для расчёта задержки', expected: rules.maxLatencySec }, env)
      : makeResult(
          'TM-004',
          pLatency <= rules.maxLatencySec,
          {
            message: `P${rules.latencyPercentile} задержки: ${round(pLatency)} с (максимум ${rules.maxLatencySec} с)`,
            actual: round(pLatency),
            expected: rules.maxLatencySec,
          },
          env,
        );

  // TM-005 — период наблюдения
  const hours = round((endMs - startMs) / MS.hour);
  const periodResult = makeResult(
    'TM-005',
    hours >= rules.observationPeriodHours,
    {
      message: `Период наблюдения ${hours} ч (требуется ${rules.observationPeriodHours} ч)`,
      actual: hours,
      expected: rules.observationPeriodHours,
    },
    env,
  );

  return [coverageResult, freqResult, completenessResult, latencyResult, periodResult];
}
