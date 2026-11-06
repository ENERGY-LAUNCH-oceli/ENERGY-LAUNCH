import type { InvoiceDataset, MeterHistoryRules, ValidationResult } from '@/types';
import { analyzeGrid, deltas, isUsable, makeResult, median, MS, round, sortByTime, toMs, type ValidatorEnv } from './helpers';

const STAGE_RULES = ['MH-002', 'MH-003', 'MH-004', 'MH-005', 'MH-006'] as const;

/** Этап 1: сверка счетов с историей приборов учёта. */
export function validateMeterHistory(
  dataset: InvoiceDataset | undefined,
  rules: MeterHistoryRules,
  env: ValidatorEnv,
): ValidationResult[] {
  const hasData = !!dataset && dataset.lines.length > 0 && dataset.meterSeries.length > 0;
  const linePoints = new Set(dataset?.lines.map((l) => l.meteringPointId) ?? []);
  const seriesPoints = new Set(dataset?.meterSeries.map((s) => s.meteringPointId) ?? []);
  const missingSeries = [...linePoints].filter((p) => !seriesPoints.has(p));

  const presence = makeResult(
    'MH-001',
    hasData && missingSeries.length === 0,
    {
      message: !hasData
        ? 'Счёт или история учёта не загружены'
        : missingSeries.length
          ? `Нет истории учёта для точек: ${missingSeries.join(', ')}`
          : 'Счёт и история учёта загружены',
      details: { missingSeries },
    },
    env,
  );
  if (!dataset || !hasData) {
    return [
      presence,
      ...STAGE_RULES.map((id) => makeResult(id, 'SKIPPED', { message: 'Нет данных для проверки' }, env)),
    ];
  }

  const stepMs = rules.intervalMinutes * MS.minute;
  const startMs = toMs(dataset.periodStart);
  const endMs = toMs(dataset.periodEnd);

  // MH-002 — шаг интервала
  const stepBySeries = dataset.meterSeries.map((s) => {
    const m = median(deltas(sortByTime(s.measurements)));
    return { meteringPointId: s.meteringPointId, stepMinutes: m === null ? null : m / MS.minute };
  });
  const wrongStep = stepBySeries.filter((s) => s.stepMinutes !== rules.intervalMinutes);
  const intervalResult = makeResult(
    'MH-002',
    wrongStep.length === 0,
    {
      message: wrongStep.length
        ? `Шаг интервала не соответствует ${rules.intervalMinutes} мин для ${wrongStep.length} точек`
        : `Шаг интервала ${rules.intervalMinutes} мин`,
      actual: wrongStep[0]?.stepMinutes ?? rules.intervalMinutes,
      expected: rules.intervalMinutes,
      details: { stepBySeries },
    },
    env,
  );

  // MH-003 / MH-006 — полнота и непрерывность
  const grids = dataset.meterSeries.map((s) => ({
    meteringPointId: s.meteringPointId,
    ...analyzeGrid(s.measurements, startMs, endMs, stepMs),
  }));
  const minCompleteness = Math.min(...grids.map((g) => g.completenessPct));
  const maxGaps = Math.max(...grids.map((g) => g.maxConsecutiveGaps));
  const completenessResult = makeResult(
    'MH-003',
    minCompleteness >= rules.minCompletenessPct,
    {
      message: `Минимальная полнота по точкам: ${minCompleteness}% (порог ${rules.minCompletenessPct}%)`,
      actual: minCompleteness,
      expected: rules.minCompletenessPct,
      details: {
        grids,
        interval: grids.map((g) => g.longestGap).find((x) => x) ?? null,
        fields: grids.filter((g) => g.completenessPct < rules.minCompletenessPct).map((g) => `${g.meteringPointId}`),
      },
    },
    env,
  );
  const gapsResult = makeResult(
    'MH-006',
    maxGaps <= rules.maxConsecutiveGaps,
    {
      message: `Максимум подряд пропущенных интервалов: ${maxGaps} (предел ${rules.maxConsecutiveGaps})`,
      actual: maxGaps,
      expected: rules.maxConsecutiveGaps,
      details: { interval: grids.map((g) => g.longestGap).find((x) => x) ?? null },
    },
    env,
  );

  // MH-004 — глубина истории
  const periodDays = round((endMs - startMs) / MS.day);
  const periodResult = makeResult(
    'MH-004',
    periodDays >= rules.checkPeriodDays,
    {
      message: `Период истории ${periodDays} сут (требуется ${rules.checkPeriodDays})`,
      actual: periodDays,
      expected: rules.checkPeriodDays,
      details: { interval: { from: dataset.periodStart, to: dataset.periodEnd }, missingDays: Math.max(0, round(rules.checkPeriodDays - periodDays)) },
    },
    env,
  );

  // MH-005 — сверка счёта и учёта
  const seriesByPoint = new Map(dataset.meterSeries.map((s) => [s.meteringPointId, s]));
  const lineChecks = dataset.lines.map((line) => {
    const series = seriesByPoint.get(line.meteringPointId);
    const from = toMs(line.periodStart);
    const to = toMs(line.periodEnd);
    const meteredKwh = (series?.measurements ?? [])
      .filter((m) => isUsable(m) && toMs(m.timestamp) >= from && toMs(m.timestamp) < to)
      .reduce((sum, m) => sum + (m.unit === 'MWh' ? m.value! * 1000 : m.value!), 0);
    const deviationPct =
      line.energyKwh === 0 ? (meteredKwh === 0 ? 0 : 100) : (Math.abs(line.energyKwh - meteredKwh) / line.energyKwh) * 100;
    return { lineId: line.id, meteringPointId: line.meteringPointId, invoicedKwh: line.energyKwh, meteredKwh: round(meteredKwh, 3), deviationPct: round(deviationPct, 3) };
  });
  const worst = Math.max(...lineChecks.map((c) => c.deviationPct));
  const invoiceResult = makeResult(
    'MH-005',
    worst <= rules.invoiceTolerancePct,
    {
      message: `Максимальное расхождение счёт/учёт: ${worst}% (допуск ${rules.invoiceTolerancePct}%)`,
      actual: worst,
      expected: rules.invoiceTolerancePct,
      details: { lineChecks },
    },
    env,
  );

  return [presence, intervalResult, completenessResult, periodResult, invoiceResult, gapsResult];
}
