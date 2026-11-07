import { CheckCheck, FlaskConical, Link2Off, Play } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META, STAGE_STATUS_LABEL } from '@/config/stages';
import { getUnmetConfirmations } from '@/engine';
import { ConfirmDialog, RenewDialog } from '@/features/launch';
import { useLaunchStore } from '@/store';
import type { StageId, StageStatus } from '@/types';
import { stageStats } from './model';

/** Заголовок этапа с действиями и отказом перехода (список незакрытых зависимостей). */
export function StageActionBar({ stageId }: { stageId: StageId }) {
  const session = useLaunchStore((s) => s.session)!;
  const ruleset = useLaunchStore((s) => s.ruleset);
  const lastError = useLaunchStore((s) => s.lastError);
  const clearError = useLaunchStore((s) => s.clearError);
  const start = useLaunchStore((s) => s.startStage);
  const validate = useLaunchStore((s) => s.validateStage);
  const complete = useLaunchStore((s) => s.completeStage);
  const stage = session.stages[stageId];
  const stats = stageStats(session, stageId);
  const unmet = getUnmetConfirmations(session, stageId, ruleset);
  const evidence = session.evidence.filter((e) => e.stageId === stageId);
  const error = lastError && lastError.stageId === stageId ? lastError : null;
  const deps = (error?.details?.dependencies as { stageId: StageId; status: StageStatus }[] | undefined) ?? [];
  const stale = stage.status === 'COMPLETED' ? stage.confirmations.filter((c) => c.staleSince) : [];

  return (
    <>
      <div data-tour="stage-bar" className="flex flex-col gap-4 rounded-lg border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 shrink-0 font-mono text-caption font-medium tabular text-text-muted">0{stage.order}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <div data-testid={`stage-heading-${stageId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-h2">{STAGE_META[stageId].titleRu}</h2>
              <span data-testid={`stage-status-${stageId}`} data-status={stage.status}>
                <StatusBadge status={stage.status} />
              </span>
            </div>
            <span className="flex flex-wrap gap-x-1.5 text-caption text-text-muted">
              {/* Сумма сходится: предупреждения и неприменимые проверки показываются, когда они есть */}
              Проверок: <b className="tabular">{stats.checks.length}</b> · пройдено <b className="tabular">{stats.passed}</b> · ошибок <b className="tabular">{stats.failed}</b>
              {stats.warnings > 0 && (
                <>
                  {' '}
                  · предупреждений <b className="tabular">{stats.warnings}</b>
                </>
              )}{' '}
              · ожидают <b className="tabular">{stats.pending}</b>
              {stats.checks.length - stats.passed - stats.failed - stats.warnings - stats.pending > 0 && (
                <>
                  {' '}
                  · не применимо <b className="tabular">{stats.checks.length - stats.passed - stats.failed - stats.warnings - stats.pending}</b>
                </>
              )}
            </span>
          </div>
        </div>
        <div data-tour="stage-actions" className="flex flex-wrap gap-2 sm:shrink-0">
          {stage.status === 'NOT_STARTED' && (
            <Button variant="accent" onClick={() => start(stageId)}>
              <Play aria-hidden />
              Начать этап
            </Button>
          )}
          {(stage.status === 'IN_PROGRESS' || stage.status === 'BLOCKED') && (
            <>
              <Button variant="secondary" onClick={() => validate(stageId)}>
                <FlaskConical aria-hidden />
                {stage.lastValidatedAt ? 'Повторить проверки' : 'Запустить проверки'}
              </Button>
              {unmet.length > 0 && <ConfirmDialog stageId={stageId} />}
            </>
          )}
          {stage.status !== 'COMPLETED' && (
            <Button variant="primary" onClick={() => complete(stageId)}>
              <CheckCheck aria-hidden />
              Завершить этап
            </Button>
          )}
        </div>
      </div>

      {stale.length > 0 && (
        <Alert tone="warning" title="Подтверждения этапа устарели" action={<RenewDialog stageId={stageId} />}>
          Данные изменились после подтверждения ({stale[0]!.staleReason ?? 'входы изменились'}). Этап остаётся завершённым, но готовность объекта не присваивается, пока подтверждения не обновлены.
        </Alert>
      )}

      {error && (
        <Alert
          tone="error"
          title="Переход отклонён"
          action={
            <Button size="sm" variant="ghost" onClick={clearError}>
              Понятно
            </Button>
          }
        >
          {deps.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span>Этап «{STAGE_META[stageId].titleRu}» нельзя завершить, пока не закрыты зависимости:</span>
              <ul className="flex flex-col gap-1" data-testid="transition-dependencies">
                {deps.map((d) => (
                  <li key={d.stageId} className="flex items-center gap-2">
                    <Link2Off className="size-3.5 text-error" aria-hidden />
                    <b className="text-text-primary">{STAGE_META[d.stageId].titleRu}</b> – {STAGE_STATUS_LABEL[d.status].toLowerCase()}
                  </li>
                ))}
              </ul>
              <span className="text-caption">
                Загруженные материалы этапа сохранены: <b className="tabular">{evidence.length}</b>.
              </span>
            </div>
          ) : (
            error.message
          )}
        </Alert>
      )}

    </>
  );
}
