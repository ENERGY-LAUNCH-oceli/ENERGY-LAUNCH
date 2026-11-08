import { ArrowRight } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AuditTimeline, NextActionCard } from '@/components/launch';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { STAGE_META } from '@/config/stages';
import { SCENARIO_LIST } from '@/data/scenarios';
import { findObject } from '@/data/objects';
import { getNextAction, objectReadiness } from '@/engine';
import { FixAssistant } from '@/features/fix/FixAssistant';
import { LaunchStepper, ObjectHeader, StageSummaryCard, StageWorkspace } from '@/features/launch-card';
import { sessionStatus } from '@/hooks/use-portfolio';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type StageId } from '@/types';

/** Карточка запуска объекта – центральный экран продукта. */
export function LaunchPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const audit = useLaunchStore((s) => s.auditLog);
  const scenarioId = useLaunchStore((s) => s.scenarioId);
  const loadScenario = useLaunchStore((s) => s.loadScenario);
  const [params, setParams] = useSearchParams();
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  if (!session || !inputs) return null;
  const entry = findObject(session.objectId)!;

  const param = params.get('stage') as StageId | null;
  const selected: StageId = param && STAGE_IDS.includes(param) ? param : session.currentStageId;
  const select = (id: StageId, scroll = false) => {
    setParams({ stage: id }, { replace: true });
    if (scroll) requestAnimationFrame(() => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const next = getNextAction(session, session.currentStageId, ruleset);
  const readiness = objectReadiness(session, inputs, ruleset);

  return (
    <div className="flex flex-col gap-6">
      <ObjectHeader
        entry={entry}
        inputs={inputs}
        status={sessionStatus(session)}
        startedAt={session.stages.METER_HISTORY.startedAt ?? session.createdAt}
        actions={
          // Демо-сценарии подменяют входы – только для синтетических объектов, не для набора кейса и песочниц
          SCENARIO_LIST.some((s) => s.id === scenarioId) &&
          (entry.source ?? 'SYNTHETIC') === 'SYNTHETIC' && (
            <div className="w-60">
              <Select
                aria-label="Демонстрационный сценарий"
                value={scenarioId ?? undefined}
                onValueChange={(v) => {
                  setParams({}, { replace: true });
                  loadScenario(v);
                }}
                options={SCENARIO_LIST.map((s) => ({ value: s.id, label: s.title }))}
              />
            </div>
          )
        }
      />

      <LaunchStepper session={session} selected={selected} onSelect={(id) => select(id, true)} />

      {next ? (
        <NextActionCard
          stageLabel={STAGE_META[next.stageId].titleRu}
          title={next.title}
          {...(next.reason ? { reason: next.reason } : {})}
          action={
            <div className="flex flex-wrap gap-2">
              <FixAssistant stageId={next.stageId} ruleId={next.ruleId} variant="secondary" size="lg" />
              <Button variant="accent" size="lg" onClick={() => select(next.stageId, true)}>
                Открыть этап
                <ArrowRight aria-hidden />
              </Button>
            </div>
          }
        />
      ) : readiness.ready ? (
        <NextActionCard title="Запуск завершён: объект готов к эксплуатации" description="Все четыре этапа завершены, дашборды приняты ответственным." />
      ) : (
        <NextActionCard
          title="Готовность не присвоена"
          description={`Не выполнено: ${readiness.conditions
            .filter((c) => !c.met)
            .map((c) => c.label)
            .join('; ')}`}
        />
      )}

      <div data-tour="launch-stages" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {STAGE_IDS.map((id) => (
          <StageSummaryCard key={id} session={session} stageId={id} responsible={entry.responsible} selected={id === selected} onOpen={() => select(id, true)} />
        ))}
      </div>

      <div ref={workspaceRef} data-tour="stage-workspace" className="scroll-mt-24">
        <StageWorkspace key={selected} stageId={selected} />
      </div>

      <section aria-label="Журнал" className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label text-text-muted">Журнал</span>
            <h2 className="text-h3">Последние действия и проверки</h2>
          </div>
          <Link to={ROUTES.objectSection(entry.id, 'audit')} className="text-body-sm font-medium text-accent-strong hover:underline">
            Весь журнал ({audit.length})
          </Link>
        </div>
        <AuditTimeline events={audit} limit={6} />
      </section>
    </div>
  );
}
