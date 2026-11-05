import * as React from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader, SectionHeader } from '@/components/common/PageHeader';
import { LaunchProgress, NextActionCard } from '@/components/launch';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { STAGE_META } from '@/config/stages';
import { SCENARIO_LIST } from '@/data/scenarios';
import { getNextAction } from '@/engine';
import { StageCardContainer, StageDetail } from '@/features/launch';
import { useLaunchStore } from '@/store';
import { STAGE_IDS, type StageId } from '@/types';

export function LaunchPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const scenarioId = useLaunchStore((s) => s.scenarioId);
  const loadScenario = useLaunchStore((s) => s.loadScenario);
  const lastError = useLaunchStore((s) => s.lastError);
  const clearError = useLaunchStore((s) => s.clearError);
  const [tab, setTab] = React.useState<StageId | null>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);

  if (!session || !inputs) return <EmptyState title="Сессия запуска не создана" />;

  const activeTab = tab ?? session.currentStageId;
  const next = getNextAction(session, session.currentStageId, ruleset);
  const openStage = (id: StageId) => {
    setTab(id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Карточка запуска"
        title={inputs.object.name}
        description={`${inputs.object.gridConnection.pointOfConnection} · ${inputs.object.passport.installedCapacityMw} МВт`}
        actions={
          <div className="w-64">
            <Select
              aria-label="Демонстрационный сценарий"
              value={scenarioId ?? undefined}
              onValueChange={(v) => {
                setTab(null);
                loadScenario(v);
              }}
              options={SCENARIO_LIST.map((s) => ({ value: s.id, label: s.title }))}
            />
          </div>
        }
      />

      {lastError && (
        <Alert
          tone="warning"
          title="Переход отклонён"
          action={
            <Button size="sm" variant="ghost" onClick={clearError}>
              Скрыть
            </Button>
          }
        >
          {lastError.message}
        </Alert>
      )}

      <LaunchProgress
        objectCode={inputs.object.code}
        currentStageId={session.currentStageId}
        ready={session.status === 'COMPLETED'}
        stages={STAGE_IDS.map((id) => ({ id, title: STAGE_META[id].titleRu, status: session.stages[id].status }))}
      />

      {next && (
        <NextActionCard
          stageLabel={STAGE_META[next.stageId].titleRu}
          title={next.title}
          {...(next.reason ? { reason: next.reason } : {})}
          action={
            <Button variant="accent" onClick={() => openStage(next.stageId)}>
              Перейти к этапу
            </Button>
          }
        />
      )}

      <section>
        <SectionHeader eyebrow="Этапы" title="Четыре последовательных этапа" description="Этап завершается только при выполнении всех обязательных условий." />
        <div className="grid gap-4 md:grid-cols-2">
          {STAGE_IDS.map((id) => (
            <StageCardContainer key={id} stageId={id} onOpen={() => openStage(id)} />
          ))}
        </div>
      </section>

      <section ref={detailRef} className="scroll-mt-24">
        <SectionHeader eyebrow="Детали" title="Проверки, препятствия и подтверждения" />
        <Tabs value={activeTab} onValueChange={(v) => setTab(v as StageId)}>
          <TabsList>
            {STAGE_IDS.map((id) => (
              <TabsTrigger key={id} value={id} count={session.blockers.filter((b) => b.stageId === id && b.status === 'OPEN').length || undefined}>
                {session.stages[id].order}. {STAGE_META[id].titleRu}
              </TabsTrigger>
            ))}
          </TabsList>
          {STAGE_IDS.map((id) => (
            <TabsContent key={id} value={id}>
              <StageDetail stageId={id} />
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
