import { NextActionCard } from '@/components/launch';
import { Alert } from '@/components/ui/alert';
import { getNextAction } from '@/engine';
import { CheckBlocks } from '@/features/invoice-validation';
import { FixAssistant } from '@/features/fix/FixAssistant';
import { StageActionBar } from '@/features/launch-card';
import { DiagnosisLegend, InputsPanel, PassportCard, QualityHeatmap, SignalMapping, TelemetryIssues, TelemetryRuns } from '@/features/telemetry-validation';
import { ANCHORS } from '@/config/blocker-links';
import { useLaunchStore } from '@/store';

const BLOCKS = [
  { id: 'mapping', title: 'Signals', rules: ['TM-001', 'TM-002', 'TM-003', 'TM-011'] },
  { id: 'mapping', title: 'Binding', rules: ['TM-004'] },
  { id: 'heatmap', title: 'Freshness', rules: ['TM-005'] },
  { id: 'heatmap', title: 'Completeness', rules: ['TM-006'] },
  { id: 'issues', title: 'Plausibility', rules: ['TM-007', 'TM-008', 'TM-010'] },
  { id: 'issues', title: 'Timestamps', rules: ['TM-009'] },
];

/** Этап 2 – проверка телеметрии по паспорту object.json. */
export function TelemetryValidationPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  if (!session || !inputs) return null;
  const rules = ruleset.telemetry;
  const { passport, telemetry: ds } = inputs;
  const r = ds?.report;
  const runs = inputs.telemetryRuns ?? [];
  const last = runs.at(-1);
  const stale = !!last && ((ds?.version ?? 0) !== last.datasetVersion || (passport?.version ?? 0) !== last.passportVersion);
  const stage = session.stages.REALTIME_TELEMETRY;
  const next = getNextAction(session, 'REALTIME_TELEMETRY', ruleset);
  const req = r?.signals.filter((s) => s.required) ?? [];
  const minPct = req.length ? Math.min(...req.map((s) => s.completenessPct)) : null;
  const maxAge = req.some((s) => s.ageMinutes !== null) ? Math.max(...req.map((s) => s.ageMinutes ?? 0)) : null;
  const metrics = {
    Signals: r ? `${req.filter((s) => s.inData && s.received > 0).length} / ${req.length}` : '–',
    Binding: r ? (r.foreignColumns.length ? `${r.foreignColumns.length} чужих` : 'по паспорту') : '–',
    Freshness: !r ? '–' : req.some((s) => !s.lastTimestamp) ? `нет данных: ${req.filter((s) => !s.lastTimestamp).length}` : `${maxAge} мин`,
    Completeness: minPct !== null ? `мин. ${minPct.toLocaleString('ru-RU')} %` : '–',
    Plausibility: r ? `${['OUT_OF_RANGE', 'NEGATIVE_PV', 'SOC_OUT_OF_RANGE', 'SIGN_ERROR', 'UNIT_MISMATCH', 'SOC_JUMP', 'SETPOINT_MISMATCH'].reduce((n, t) => n + (r.issueCounts[t as keyof typeof r.issueCounts] ?? 0), 0)} замечаний` : '–',
    Timestamps: r ? `${(r.issueCounts.NON_UTC_TIMESTAMP ?? 0) + (r.issueCounts.INVALID_TIMESTAMP ?? 0) + (r.issueCounts.DUPLICATE_TIMESTAMP ?? 0)} ошибок` : '–',
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-label text-text-muted">Этап 2 из 4 · Real-time Telemetry Validation</span>
        <h1 className="text-h1">Данные в реальном времени</h1>
        <p className="max-w-3xl text-body-lg text-text-secondary">
          Обязательные сигналы Grid, PV и Battery по паспорту object.json: привязка, актуальность ≤ {rules.maxAgeMinutes} мин, полнота ≥ {rules.minCompletenessPct} % за {rules.windowHours} ч по каждому сигналу, единицы, знаки и диапазоны.
        </p>
      </header>

      <StageActionBar stageId="REALTIME_TELEMETRY" />

      {stale && (
        <Alert tone="warning" title="Результат проверки неактуален">
          Паспорт или телеметрия изменены после последней проверки (сейчас: данные v{ds?.version ?? 0}, паспорт v{passport?.version ?? 0}; проверялись v{last!.datasetVersion} и v{last!.passportVersion}). Зависимые подтверждения не действуют до повторной проверки.
        </Alert>
      )}
      {next && stage.status !== 'COMPLETED' && <NextActionCard stageLabel="Данные в реальном времени" title={next.title} {...(next.reason ? { reason: next.reason } : {})} action={<FixAssistant stageId="REALTIME_TELEMETRY" ruleId={next.ruleId} />} />}

      <div id={ANCHORS.tmInputs} className="scroll-mt-24">
        <InputsPanel passport={passport} dataset={ds} />
      </div>

      <CheckBlocks results={stage.validationResults} stale={stale} blocks={BLOCKS} metrics={metrics} />

      {passport ? (
        <>
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div id={ANCHORS.tmPassport} className="scroll-mt-24">
              <PassportCard passport={passport} />
            </div>
            <DiagnosisLegend />
          </div>
          <div id={ANCHORS.tmSignals} className="scroll-mt-24">
            <SignalMapping passport={passport} report={r} maxAge={rules.maxAgeMinutes} minPct={rules.minCompletenessPct} />
          </div>
          {r && (
            <div id={ANCHORS.tmHeatmap} className="scroll-mt-24">
              <QualityHeatmap report={r} />
            </div>
          )}
          {r && (
            <div id={ANCHORS.tmIssues} className="scroll-mt-24">
              <TelemetryIssues report={r} />
            </div>
          )}
        </>
      ) : (
        <Alert tone="error" title="Паспорт объекта не загружен">Без object.json нельзя определить оборудование и обязательные сигналы. Оборудование не добавляется автоматически.</Alert>
      )}

      <TelemetryRuns runs={runs} dataset={ds} passport={passport} />
    </div>
  );
}
