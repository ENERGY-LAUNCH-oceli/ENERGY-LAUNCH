import * as React from 'react';
import { Check as CheckIcon, Play, RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { BaselineComparison } from '@/features/scenarios/BaselineComparison';
import { STAGE_SHORT, Stat } from '@/features/trail/shared';
import { qualityMetrics, runScenario, sandboxId, SCENARIO_RULESET, SCENARIOS, type ScenarioDef, type ScenarioRun } from '@/scenarios';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';
import { cn } from '@/utils/cn';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–');

/** Demo Scenarios: 11 сценариев ТЗ, каждый – в своей песочнице на собственном воспроизводимом наборе. */
export function ScenariosPage() {
  const [runs, setRuns] = React.useState<Record<number, ScenarioRun>>({});
  const [busy, setBusy] = React.useState<number | 'all' | null>(null);
  const [open, setOpen] = React.useState<number | null>(null);
  const navigate = useNavigate();

  const run = (def: ScenarioDef) =>
    new Promise<void>((resolve) => {
      setBusy((b) => (b === 'all' ? b : def.n));
      // Отдать кадр интерфейсу до синхронного прогона
      setTimeout(() => {
        const r = runScenario(def);
        setRuns((s) => ({ ...s, [def.n]: r }));
        setOpen(def.n);
        setBusy((b) => (b === 'all' ? b : null));
        resolve();
      }, 30);
    });
  const runAll = async () => {
    setBusy('all');
    for (const def of SCENARIOS) await run(def);
    setBusy(null);
    setOpen(null);
  };
  const reset = (n: number) => {
    const id = sandboxId(n);
    useLaunchStore.setState((s) => {
      const { [id]: _drop, ...rest } = s.workspaces;
      return { workspaces: rest };
    });
    setRuns(({ [n]: _r, ...rest }) => rest);
  };
  const done = Object.values(runs);
  const evalRuns = done.filter((r) => r.def.evaluation);
  const m = qualityMetrics(done);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1">Демо-сценарии</h1>
          <p className="max-w-3xl text-body text-text-muted">
            11 сценариев ТЗ. Каждый запускается в отдельной песочнице с собственным воспроизводимым набором данных и проходит через настоящие проверки, переходы и роли приложения. Ожидаемое поведение используется только для сравнения – статусы
            считает приложение.
          </p>
        </div>
        <Button onClick={runAll} loading={busy === 'all'} disabled={busy !== null} data-testid="run-all">
          <Play /> Запустить все
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5" data-testid="scenario-metrics">
        <Stat label="Пройдено сценариев" value={`${done.filter((r) => r.passed).length} / ${SCENARIOS.length}`} tone={done.length && done.every((r) => r.passed) ? 'ok' : undefined} />
        <Stat label="Верность статусов" value={pct(m.statusAccuracy.matched, m.statusAccuracy.total)} />
        <Stat label="Найдено препятствий" value={pct(m.blockerRecall.found, m.blockerRecall.total)} />
        <Stat label="Ложных завершений" value={done.length ? m.falseCompletions : '–'} tone={done.length ? (m.falseCompletions ? 'bad' : 'ok') : undefined} />
        <Stat label="Покрытие подтверждениями" value={pct(m.evidence.covered, m.evidence.total)} />
      </div>
      {evalRuns.length > 0 && (
        <p className="text-caption text-text-muted">
          Оценочные сценарии (ТЗ 6.1): пройдено {evalRuns.filter((r) => r.passed).length} из {SCENARIOS.filter((s) => s.evaluation).length} запущенных {evalRuns.length}.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {SCENARIOS.map((def) => {
          const r = runs[def.n];
          const expanded = open === def.n;
          return (
            <li key={def.n} className="rounded-lg border border-border bg-surface" data-scenario={def.n} data-pass={r ? String(r.passed) : undefined}>
              <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="tabular w-7 font-mono text-body-sm text-text-muted">{String(def.n).padStart(2, '0')}</span>
                <button type="button" className="flex min-w-[220px] flex-1 flex-col items-start gap-0.5 text-left" onClick={() => setOpen(expanded ? null : def.n)} aria-expanded={expanded}>
                  <span className="text-body font-medium">
                    {def.title}
                    {def.evaluation && <span className="ml-2 text-label text-text-muted">оценочный</span>}
                  </span>
                  <span className="text-body-sm text-text-muted">{def.description}</span>
                </button>
                <span className={cn('min-w-[110px] text-body-sm font-medium', !r && 'text-text-muted', r?.passed && 'text-status-completed', r && !r.passed && 'text-status-blocked')} data-testid="scenario-result">
                  {!r ? 'Не запускался' : r.passed ? 'Пройден' : 'Не пройден'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => run(def)} loading={busy === def.n} disabled={busy !== null} data-testid="run-scenario">
                    <Play /> Запустить сценарий
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reset(def.n)} disabled={!r || busy !== null} aria-label="Сбросить сценарий" title="Reset Scenario">
                    <RotateCcw />
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="grid gap-6 border-t border-border px-5 py-5 lg:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <List title="Входные данные" items={def.input} />
                    <List title="Ожидаемое поведение (ТЗ)" items={def.expected} />
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-label text-text-muted">Ожидаемые статусы этапов</h3>
                      <StageRow statuses={def.expectedStatuses} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    {!r ? (
                      <p className="text-body-sm text-text-muted">Фактический результат появится после запуска.</p>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <h3 className="text-label text-text-muted">Фактические статусы</h3>
                          <StageRow statuses={r.outcome.statuses} expected={def.expectedStatuses} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <h3 className="text-label text-text-muted">Проверки результата</h3>
                          <ul className="flex flex-col gap-2" data-testid="scenario-checks">
                            {r.checks.map((c) => (
                              <li key={c.label} className="flex gap-2 text-body-sm">
                                {c.pass ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-status-completed" /> : <X className="mt-0.5 size-4 shrink-0 text-status-blocked" />}
                                <span className="min-w-0">
                                  {c.label}
                                  <span className="block break-words text-caption text-text-muted">{c.actual}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="text-caption text-text-muted">
                          Открытые препятствия: {r.outcome.blockers.join(', ') || 'нет'} · отказов переходов: {r.outcome.workspace.rejections.length} · событий журнала: {r.outcome.workspace.auditLog.length} · время прогона{' '}
                          {r.outcome.workspace.durationMs} мс
                        </p>
                        <div>
                          <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.objectSection(sandboxId(def.n), 'launch'))}>
                            Открыть объект сценария
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <BaselineComparison runs={runs} rulesetVersion={SCENARIO_RULESET.version} />
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-label text-text-muted">{title}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm">
        {items.map((i) => (
          <li key={i} className="break-words">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageRow({ statuses, expected }: { statuses: ScenarioRun['outcome']['statuses']; expected?: ScenarioRun['outcome']['statuses'] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STAGE_IDS.map((id) => (
        <li key={id} className={cn('flex flex-col gap-1 rounded-md border border-border px-3 py-2', expected && expected[id] !== statuses[id] && 'border-error-border bg-error-subtle')}>
          <span className="text-caption text-text-muted">{STAGE_SHORT[id]}</span>
          <StatusBadge status={statuses[id]} size="sm" />
        </li>
      ))}
    </ul>
  );
}
