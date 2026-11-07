import * as React from 'react';
import { NextActionCard } from '@/components/launch';
import { Alert } from '@/components/ui/alert';
import { compareVersions, controlAssets, getNextAction, latestByAsset, requiredTargets } from '@/engine';
import { CheckBlocks } from '@/features/invoice-validation';
import { StageActionBar } from '@/features/launch-card';
import { AssetsTable, CommandDetail, CommandTimeline, ControlRuns, TestForm } from '@/features/control-testing';
import { StagePage } from '@/pages/StagePage';
import { createSimulatorTransport } from '@/simulator/control';
import { ANCHORS } from '@/config/blocker-links';
import { useLaunchStore } from '@/store';

const BLOCKS = [
  { id: 'assets', title: 'Isolation', rules: ['CT-010'] },
  { id: 'timeline', title: 'Sent', rules: ['CT-011', 'CT-016'] },
  { id: 'timeline', title: 'Received', rules: ['CT-012'] },
  { id: 'timeline', title: 'Responded', rules: ['CT-013'] },
  { id: 'assets', title: 'Battery', rules: ['CT-014'] },
  { id: 'assets', title: 'PV', rules: ['CT-015'] },
];

/** Транспорт – только локальный имитатор (описание стенда для таблицы активов). */
const transport = createSimulatorTransport();

/** Этап 3 – Control Testing: тесты управления через локальный имитатор. */
export function ControlTestingPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const runControlTest = useLaunchStore((s) => s.runControlTest);
  const commands = React.useMemo(() => inputs?.controlCommands ?? [], [inputs?.controlCommands]);
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);
  const rules = ruleset.controlTesting;

  // Сессии на наборах правил 1.0–1.2 остаются на программе испытаний
  if (!session || !inputs) return null;
  if (!rules || compareVersions(session.rulesetVersion, '1.3.0') < 0) return <StagePage stageId="ASSET_CONTROL" />;

  const assets = controlAssets(inputs.passport, inputs.telemetry?.report, transport.describe);
  const latest = latestByAsset(commands);
  const required = requiredTargets(inputs.passport, rules);
  const stage = session.stages.ASSET_CONTROL;
  const next = getNextAction(session, 'ASSET_CONTROL', ruleset);
  const runs = inputs.controlRuns ?? [];
  const lastRun = runs.at(-1);
  const stale = !!lastRun && lastRun.commandsCount !== commands.length;
  const selected = commands.find((c) => c.commandId === selectedId) ?? commands.at(-1);

  const disabledReason =
    stage.status === 'COMPLETED'
      ? 'Этап завершён – новые тесты не требуются'
      : session.stages.REALTIME_TELEMETRY.status !== 'COMPLETED'
        ? 'Сначала завершите этап 2 «Данные в реальном времени»: без подтверждённой телеметрии отклик не проверить'
        : stage.status === 'NOT_STARTED'
          ? 'Начните этап, чтобы отправлять тестовые команды'
          : null;

  const lat = required.map((t) => latest.get(t.assetId));
  const count = (pred: (c: NonNullable<(typeof lat)[number]>) => boolean) => `${lat.filter((c) => c && pred(c)).length} / ${required.length}`;
  const kindStatus = (kind: 'BATTERY' | 'PV') => {
    const all = assets.filter((a) => a.type === kind && a.supported);
    if (!assets.some((a) => a.type === kind)) return 'нет в паспорте';
    return `${all.filter((a) => latest.get(a.assetId)?.state === 'PASSED').length} / ${all.length} пройдено`;
  };
  const metrics = {
    Isolation: commands.every((c) => c.transport === 'SIMULATOR') ? 'только имитатор' : 'вне контура!',
    Sent: count((c) => !!c.sentAt),
    Received: count((c) => !!c.receivedAt),
    Responded: count((c) => c.state === 'PASSED'),
    Battery: kindStatus('BATTERY'),
    PV: kindStatus('PV'),
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-label text-text-muted">Этап 3 из 4 · Asset Control Testing</span>
        <h1 className="text-h1">Управление активами</h1>
        <p className="max-w-3xl text-body-lg text-text-secondary">
          Тест подтверждает три отдельных события: команда отправлена, принята контроллером, и актив изменил фактическую мощность за ≤ {rules.responseWindowSec} с. Отправка сама по себе – не успех.
        </p>
      </header>

      <Alert tone="info" title="Только тестовый контур" data-tour="control-sandbox">
        Команды отправляются в локальный имитатор контроллера (отдельный модуль без сети). Реальное оборудование не управляется, интеграций с энергетическими API нет. Результаты воспроизводимы: одинаковые входы дают одинаковый отклик.
      </Alert>

      <StageActionBar stageId="ASSET_CONTROL" />

      {stale && (
        <Alert tone="warning" title="Результат проверки неактуален">
          После последней проверки выполнено новых тестов: {commands.length - lastRun!.commandsCount}. Запустите проверки этапа повторно.
        </Alert>
      )}
      {next && stage.status !== 'COMPLETED' && <NextActionCard stageLabel="Управление" title={next.title} {...(next.reason ? { reason: next.reason } : {})} />}

      <CheckBlocks results={stage.validationResults} stale={stale} blocks={BLOCKS} metrics={metrics} />

      <div id={ANCHORS.ctAssets} className="scroll-mt-24">
        <AssetsTable assets={assets} latest={latest} onSelect={setSelectedId} />
      </div>

      <div id={ANCHORS.ctTest} className="scroll-mt-24">
      {assets.some((a) => a.supported) ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <TestForm
            key={session.objectId}
            assets={assets}
            rules={rules}
            disabledReason={disabledReason}
            onRun={(input) => {
              const cmd = runControlTest(input);
              if (cmd) setSelectedId(cmd.commandId);
            }}
          />
          <CommandDetail command={selected} />
        </div>
      ) : (
        <TestForm key={session.objectId} assets={assets} rules={rules} disabledReason={disabledReason} onRun={() => undefined} />
      )}
      </div>

      <div id={ANCHORS.ctCommands} className="scroll-mt-24">
        <CommandTimeline commands={commands} selectedId={selected?.commandId} onSelect={setSelectedId} observationSec={rules.observationSec} />
      </div>

      <ControlRuns runs={runs} commandsCount={commands.length} />
    </div>
  );
}
