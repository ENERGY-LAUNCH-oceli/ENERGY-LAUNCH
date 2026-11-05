import { Play, FlaskConical, CheckCheck } from 'lucide-react';
import { LaunchStageCard } from '@/components/launch';
import { Button } from '@/components/ui/button';
import { STAGE_META } from '@/config/stages';
import { getNextAction, getPreviousStage } from '@/engine';
import { useStage } from '@/hooks/use-stage';
import { useLaunchStore } from '@/store';
import type { StageId } from '@/types';

const RESPONSIBLE: Record<StageId, { name: string; role: string }> = {
  METER_HISTORY: { name: 'Инженер запуска', role: 'учёт' },
  REALTIME_TELEMETRY: { name: 'Инженер запуска', role: 'интеграции' },
  ASSET_CONTROL: { name: 'Инженер запуска', role: 'управление' },
  FINAL_DASHBOARDS: { name: 'Ответственный', role: 'приёмка' },
};

/** Связка карточки этапа со стором и движком. */
export function StageCardContainer({ stageId, onOpen }: { stageId: StageId; onOpen?: () => void }) {
  const view = useStage(stageId);
  const session = useLaunchStore((s) => s.session);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const start = useLaunchStore((s) => s.startStage);
  const validate = useLaunchStore((s) => s.validateStage);
  const complete = useLaunchStore((s) => s.completeStage);
  if (!view || !session) return null;
  const { stage, blockers, prerequisitesMet } = view;
  const meta = STAGE_META[stageId];
  const next = getNextAction(session, stageId, ruleset);
  const prev = getPreviousStage(stageId);
  const passed = stage.validationResults.filter((r) => r.status === 'PASSED').length;

  return (
    <LaunchStageCard
      data-testid={`stage-${stageId}`}
      order={stage.order}
      title={meta.titleRu}
      description={meta.description}
      status={stage.status}
      current={session.currentStageId === stageId && stage.status !== 'COMPLETED'}
      checks={{ passed, total: stage.validationResults.length }}
      blockersCount={blockers.length}
      responsible={RESPONSIBLE[stageId]}
      {...(stage.lastValidatedAt ? { lastCheckedAt: stage.lastValidatedAt } : {})}
      {...(!prerequisitesMet && prev ? { dependency: `Ожидает завершения этапа «${STAGE_META[prev].titleRu}»` } : {})}
      {...(next && prerequisitesMet ? { nextAction: next.title } : {})}
      actions={
        <>
          {stage.status === 'NOT_STARTED' && (
            <Button size="sm" variant="accent" disabled={!prerequisitesMet} onClick={() => start(stageId)}>
              <Play aria-hidden />
              Начать этап
            </Button>
          )}
          {(stage.status === 'IN_PROGRESS' || stage.status === 'BLOCKED') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => validate(stageId)}>
                <FlaskConical aria-hidden />
                Запустить проверки
              </Button>
              <Button size="sm" variant="accent" disabled={next?.kind !== 'COMPLETE'} onClick={() => complete(stageId)}>
                <CheckCheck aria-hidden />
                Завершить
              </Button>
            </>
          )}
          {onOpen && stage.status !== 'NOT_STARTED' && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onOpen}>
              Подробнее
            </Button>
          )}
        </>
      }
    />
  );
}
