import { Eye, LayoutDashboard, Stamp, UserRound, Wrench } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { NextActionCard } from '@/components/launch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ACTION_TITLE, compareVersions, currentAcceptance, evaluateBlocks, getNextAction, objectReadiness, ROLE_PERMISSIONS, ROLE_TITLE } from '@/engine';
import { Acceptance, Builder, DashboardView, ReadinessPanel, useDashboardData } from '@/features/dashboards';
import { CheckBlocks } from '@/features/invoice-validation';
import { StageActionBar } from '@/features/launch-card';
import { StagePage } from '@/pages/StagePage';
import { ANCHORS } from '@/config/blocker-links';
import { useLaunchStore } from '@/store';

const BLOCKS = [
  { id: 'panel', title: 'Binding', rules: ['DB-010'] },
  { id: 'panel', title: 'History', rules: ['DB-011'] },
  { id: 'panel', title: 'Assets', rules: ['DB-012'] },
  { id: 'panel', title: 'Control', rules: ['DB-013'] },
  { id: 'panel', title: 'Quality', rules: ['DB-014'] },
  { id: 'panel', title: 'Acceptance', rules: ['DB-015', 'DB-016'] },
];

const TABS = ['panel', 'builder', 'acceptance'] as const;
type Tab = (typeof TABS)[number];

/** Этап 4 – Final Dashboards: рабочая панель объекта, конструктор, приёмка, итоговая готовность. */
export function DashboardsPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const role = useLaunchStore((s) => s.role);
  const data = useDashboardData();
  const [params, setParams] = useSearchParams();
  const rules = ruleset.dashboardConfig;

  if (!session || !inputs || !data) return null;
  // Сессии на наборах правил 1.0–1.3 остаются на прежней проверке панелей
  if (!rules || !inputs.dashboard || compareVersions(session.rulesetVersion, '1.4.0') < 0) return <StagePage stageId="FINAL_DASHBOARDS" />;

  const ws = inputs.dashboard;
  const stage = session.stages.FINAL_DASHBOARDS;
  const readiness = objectReadiness(session, inputs, ruleset);
  const next = getNextAction(session, 'FINAL_DASHBOARDS', ruleset);
  const acc = currentAcceptance(ws, session.objectId);
  const shown = ws.published ?? ws.draft;
  const evaluation = evaluateBlocks(shown, inputs, rules);
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'panel';
  const locked = stage.status === 'COMPLETED' ? 'Этап 4 завершён: конфигурация и приёмка зафиксированы' : session.stages.ASSET_CONTROL.status !== 'COMPLETED' ? 'Сначала завершите этапы 1–3: панель собирается из подтверждённых данных' : null;
  const metrics = {
    Binding: data.objectId,
    History: evaluation.METER_HISTORY.ok ? 'корректен' : 'есть замечания',
    Assets: evaluation.ASSETS.ok ? 'корректен' : 'есть замечания',
    Control: evaluation.CONTROL.ok ? 'корректен' : 'есть замечания',
    Quality: evaluation.QUALITY_STATUS.ok ? 'корректен' : 'есть замечания',
    Acceptance: !ws.published ? 'не опубликована' : acc ? `${acc.result === 'ACCEPTED' ? 'принята' : 'отклонена'} v${acc.configVersion}` : `v${ws.published.version} ждёт приёмки`,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <span className="rounded-sm bg-accent-subtle px-2 py-1 text-caption font-medium text-accent-strong">Этап 4 · Итоговая панель</span>
          <h1 className="text-h1">Рабочая панель объекта</h1>
          <p className="max-w-3xl text-body-sm text-text-secondary">История учёта, активы, управление и качество данных. Объект станет готов к эксплуатации после приёмки панели.</p>
        </div>
        <aside className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3" data-testid="current-role" data-role={role}>
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-text-muted" aria-hidden />
            <span className="text-caption text-text-muted">Текущая роль</span>
          </div>
          <span className="text-body-sm font-semibold">{ROLE_TITLE[role]}</span>
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
            {ROLE_PERMISSIONS[role].map((action) => (
              <span key={action} className="rounded-sm bg-surface-secondary px-2 py-1 text-[11px] text-text-secondary">{ACTION_TITLE[action]}</span>
            ))}
          </div>
        </aside>
      </header>

      <ReadinessPanel readiness={readiness} objectName={data.objectName} objectId={data.objectId} />

      <StageActionBar stageId="FINAL_DASHBOARDS" />

      {next && stage.status !== 'COMPLETED' && (
        <NextActionCard
          stageLabel="Финальные дашборды"
          title={next.title}
          {...(next.reason ? { reason: next.reason } : {})}
          action={
            next.ruleId === 'DB-015' || next.ruleId === 'DB-004' ? (
              <Button variant="accent" onClick={() => setParams({ tab: 'builder' }, { replace: true })}>
                Открыть конструктор
              </Button>
            ) : next.ruleId === 'DB-016' ? (
              <Button variant="accent" onClick={() => setParams({ tab: 'acceptance' }, { replace: true })}>
                Перейти к приёмке
              </Button>
            ) : undefined
          }
        />
      )}

      <CheckBlocks results={stage.validationResults} stale={false} blocks={BLOCKS} metrics={metrics} />

      <Tabs id={ANCHORS.dbTabs} className="scroll-mt-24" value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList variant="pill" aria-label="Режим">
          <TabsTrigger value="panel">
            <LayoutDashboard className="size-4" aria-hidden />
            Панель
          </TabsTrigger>
          <TabsTrigger value="builder">
            <Wrench className="size-4" aria-hidden />
            Конструктор
          </TabsTrigger>
          <TabsTrigger value="acceptance">
            <Stamp className="size-4" aria-hidden />
            Приёмка
          </TabsTrigger>
        </TabsList>
        <TabsContent value="panel" id="panel" className="flex flex-col gap-3">
          <p className="flex items-center gap-1.5 text-caption text-text-muted">
            <Eye className="size-3.5" aria-hidden />
            {ws.published ? `Опубликованная версия v${ws.published.version} · ${ws.published.publishedBy}` : `Черновик v${ws.draft.version} – ещё не опубликован`} · object_id <span className="font-mono">{shown.objectId}</span>
          </p>
          <DashboardView config={shown} data={data} evaluation={evaluation} />
        </TabsContent>
        <TabsContent value="builder">
          <Builder ws={ws} inputs={inputs} rules={rules} data={data} locked={locked} />
        </TabsContent>
        <TabsContent value="acceptance">
          <Acceptance ws={ws} inputs={inputs} rules={rules} data={data} locked={locked} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
