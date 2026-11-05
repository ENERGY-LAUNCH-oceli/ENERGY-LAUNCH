import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { SCENARIO_LIST } from '@/data/scenarios';
import { StageCard } from '@/features/launch';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';

export function LaunchPage() {
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  const scenarioId = useLaunchStore((s) => s.scenarioId);
  const loadScenario = useLaunchStore((s) => s.loadScenario);
  const lastError = useLaunchStore((s) => s.lastError);

  if (!session || !inputs) return <EmptyState title="Сессия запуска не создана" />;

  return (
    <>
      <PageHeader
        title={inputs.object.name}
        description={`Сессия ${session.id.slice(0, 8)} · статус ${session.status}`}
        actions={
          <label className="flex items-center gap-2 text-sm">
            Сценарий
            <select
              className="h-9 rounded-md border bg-background px-2"
              value={scenarioId ?? ''}
              onChange={(e) => loadScenario(e.target.value)}
              aria-label="Демонстрационный сценарий"
            >
              {SCENARIO_LIST.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        }
      />
      {lastError && (
        <div role="alert" className="mb-4 rounded-md border border-status-blocked/40 bg-status-blocked/10 p-3 text-sm">
          {lastError.message}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {STAGE_IDS.map((id) => (
          <StageCard key={id} stageId={id} />
        ))}
      </div>
    </>
  );
}
