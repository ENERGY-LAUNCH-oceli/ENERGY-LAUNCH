import { History } from 'lucide-react';
import { NextActionCard } from '@/components/launch';
import { Alert } from '@/components/ui/alert';
import { getNextAction } from '@/engine';
import { StageActionBar } from '@/features/launch-card';
import { CheckBlocks, CompletenessPanel, CoverageTimeline, EanPanel, FieldQualityTable, IssuesTable, RunsHistory, UploadPanel } from '@/features/invoice-validation';
import { coverageMonths } from '@/features/invoice-validation/labels';
import { ANCHORS } from '@/config/blocker-links';
import { useLaunchStore } from '@/store';

/** Этап 1 – проверка официальных данных расчётных счётчиков (invoice.csv). */
export function InvoiceValidationPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  if (!session || !inputs) return null;
  const ds = inputs.invoice;
  const r = ds?.report;
  const stage = session.stages.METER_HISTORY;
  const results = stage.validationResults;
  const runs = inputs.invoiceRuns ?? [];
  const stale = !!ds && !!runs.at(-1) && runs.at(-1)!.datasetVersion !== ds.version;
  const rules = ruleset.meterHistory;
  const next = getNextAction(session, 'METER_HISTORY', ruleset);
  const present = r?.window ? coverageMonths(r.window.months).filter((m) => m.state !== 'MISSING').length : 0;
  const unitIssues = (r?.issueCounts.UNIT_MISMATCH ?? 0) + (r?.issueCounts.MIXED_UNITS ?? 0);
  const qualityIssues = ['INVALID_TIMESTAMP', 'NON_UTC_TIMESTAMP', 'MISALIGNED_TIMESTAMP', 'EMPTY_VALUE', 'INVALID_NUMBER', 'NEGATIVE_VALUE', 'POSITIVE_VALUE', 'SIGN_ERROR'].reduce((n, t) => n + (r?.issueCounts[t as keyof typeof r.issueCounts] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-label text-text-muted">Этап 1 из 4 · Invoice History Validation</span>
        <h1 className="text-h1">История счётчиков</h1>
        <p className="max-w-3xl text-body-lg text-text-secondary">
          Официальные данные расчётного учёта за {rules.periodMonths} последовательных месяца: период, полнота {rules.intervalMinutes}-минутных интервалов, дубли, единицы, знаки и связь с объектом по EAN.
        </p>
      </header>

      <StageActionBar stageId="METER_HISTORY" />

      {stale && (
        <Alert tone="warning" title="Результат проверки неактуален">
          Загружена выгрузка v{ds!.version}, последняя проверка выполнялась на v{runs.at(-1)!.datasetVersion}. Запустите проверку повторно – прежний результат сохранится в истории.
        </Alert>
      )}

      {next && stage.status !== 'COMPLETED' && <NextActionCard stageLabel="История счётчиков" title={next.title} {...(next.reason ? { reason: next.reason } : {})} />}

      <div id={ANCHORS.mhUpload} className="scroll-mt-24">
        <UploadPanel dataset={ds} />
      </div>

      <CheckBlocks
        results={results}
        stale={stale}
        metrics={{
          coverage: r ? `${present} / ${rules.periodMonths} мес` : '–',
          completeness: r ? `${r.completeness.pct.toLocaleString('ru-RU')} %` : '–',
          duplicates: r ? `${r.duplicates}` : '–',
          quality: r ? `${qualityIssues.toLocaleString('ru-RU')} ошибок` : '–',
          units: r ? `${unitIssues} ошибок` : '–',
          ean: inputs.object.gridConnection.eanOfftake ? '2 кода' : 'нет кодов',
        }}
      />

      <div id={ANCHORS.mhCoverage} className="scroll-mt-24">
        <CoverageTimeline report={r} periodMonths={rules.periodMonths} />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div id={ANCHORS.mhCompleteness} className="min-w-0 scroll-mt-24">
          <CompletenessPanel report={r} minPct={rules.minCompletenessPct} stepMinutes={rules.intervalMinutes} />
        </div>
        <div id={ANCHORS.mhEan} className="min-w-0 scroll-mt-24">
          <EanPanel object={inputs.object} report={r} results={results} eanLength={rules.eanLength} />
        </div>
      </div>

      <div id={ANCHORS.mhFields} className="scroll-mt-24">
        <FieldQualityTable report={r} rules={rules.fields} />
      </div>

      <div id={ANCHORS.mhIssues} className="scroll-mt-24">
        <IssuesTable report={r} />
      </div>

      <RunsHistory runs={runs} current={ds} />

      {(inputs.invoiceHistory?.length ?? 0) > 0 && (
        <p className="flex items-center gap-2 text-caption text-text-muted">
          <History className="size-3.5" aria-hidden />
          Предыдущие загрузки сохранены: {inputs.invoiceHistory!.map((d) => `v${d.version} (${d.report.meta.rows.toLocaleString('ru-RU')} строк)`).join(', ')}
        </p>
      )}
    </div>
  );
}
