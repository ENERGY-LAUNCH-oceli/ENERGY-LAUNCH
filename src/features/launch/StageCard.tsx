import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { StageStatusBadge } from '@/components/common/StageStatusBadge';
import { STAGE_META } from '@/config/stages';
import { useStage } from '@/hooks/use-stage';
import { useLaunchStore } from '@/store';
import type { StageId } from '@/types';

/** Карточка этапа. Только отображение и вызов действий стора — без бизнес-правил. */
export function StageCard({ stageId }: { stageId: StageId }) {
  const view = useStage(stageId);
  const start = useLaunchStore((s) => s.startStage);
  const validate = useLaunchStore((s) => s.validateStage);
  if (!view) return null;
  const { stage, blockers, unmetConfirmations, prerequisitesMet } = view;
  const meta = STAGE_META[stageId];
  const failed = stage.validationResults.filter((r) => r.status === 'FAILED' || r.status === 'WARNING');

  return (
    <Card data-testid={`stage-${stageId}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>
            {stage.order}. {meta.title}
          </CardTitle>
          <StageStatusBadge status={stage.status} />
        </div>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {stage.lastValidatedAt && (
          <p className="text-muted-foreground">
            Проверок: {stage.validationResults.length}, замечаний: {failed.length}
          </p>
        )}
        {blockers.length > 0 && (
          <ul className="list-inside list-disc text-status-blocked">
            {blockers.map((b) => (
              <li key={b.id}>{b.title}</li>
            ))}
          </ul>
        )}
        {stage.status !== 'NOT_STARTED' && stage.status !== 'COMPLETED' && unmetConfirmations.length > 0 && (
          <p className="text-muted-foreground">Ожидают подтверждения: {unmetConfirmations.map((r) => r.id).join(', ')}</p>
        )}
      </CardContent>
      <CardFooter>
        {stage.status === 'NOT_STARTED' && (
          <Button size="sm" disabled={!prerequisitesMet} onClick={() => start(stageId)}>
            Начать этап
          </Button>
        )}
        {(stage.status === 'IN_PROGRESS' || stage.status === 'BLOCKED') && (
          <Button size="sm" variant="outline" onClick={() => validate(stageId)}>
            Запустить проверки
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
