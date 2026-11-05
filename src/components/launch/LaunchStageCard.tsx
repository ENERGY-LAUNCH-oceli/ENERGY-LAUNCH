import { ArrowRight, Clock, Link2Off, OctagonAlert, UserRound } from 'lucide-react';
import type * as React from 'react';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import type { StageStatus } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

export interface LaunchStageCardProps {
  order: number;
  title: string;
  description?: string;
  status: StageStatus;
  checks?: { passed: number; total: number };
  blockersCount?: number;
  responsible?: { name: string; role: string };
  nextAction?: string;
  lastCheckedAt?: string;
  /** Незакрытая зависимость (предыдущий этап не завершён). */
  dependency?: string;
  current?: boolean;
  actions?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

/** Карточка этапа запуска: статус, проверки, препятствия, ответственный, следующее действие. */
export function LaunchStageCard({
  order,
  title,
  description,
  status,
  checks,
  blockersCount = 0,
  responsible,
  nextAction,
  lastCheckedAt,
  dependency,
  current,
  actions,
  className,
  ...rest
}: LaunchStageCardProps) {
  const blocked = status === 'BLOCKED';
  const done = status === 'COMPLETED';
  return (
    <article
      data-testid={rest['data-testid']}
      data-stage-status={status}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg border bg-surface',
        blocked ? 'border-status-blocked-border' : current ? 'border-accent/50' : 'border-border',
        className,
      )}
    >
      {(blocked || current) && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-[3px]', blocked ? 'bg-status-blocked-solid' : 'bg-accent')} />}
      <header className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'tabular flex size-9 shrink-0 items-center justify-center rounded-full border text-body-sm font-bold',
              done ? 'border-transparent bg-status-completed-bg text-status-completed' : blocked ? 'border-transparent bg-status-blocked-bg text-status-blocked' : 'border-border bg-surface-secondary text-text-secondary',
            )}
          >
            {order}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-h3">{title}</h3>
            {description && <p className="text-body-sm text-text-secondary">{description}</p>}
          </div>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-4">
        {checks && checks.total > 0 && (
          <Progress
            value={checks.passed}
            max={checks.total}
            tone={blocked ? 'error' : done ? 'success' : 'info'}
            size="sm"
            label={`Проверки: ${checks.passed} из ${checks.total}`}
          />
        )}
        <dl className="grid grid-cols-1 gap-2 text-caption sm:grid-cols-2">
          {responsible && (
            <div className="flex items-center gap-1.5 text-text-secondary">
              <UserRound className="size-3.5 text-text-muted" aria-hidden />
              <dt className="sr-only">Ответственный</dt>
              <dd>
                <span className="font-semibold text-text-primary">{responsible.name}</span> · {responsible.role}
              </dd>
            </div>
          )}
          {lastCheckedAt && (
            <div className="flex items-center gap-1.5 text-text-secondary">
              <Clock className="size-3.5 text-text-muted" aria-hidden />
              <dt className="sr-only">Последняя проверка</dt>
              <dd className="tabular">{formatDateTime(lastCheckedAt)}</dd>
            </div>
          )}
        </dl>
        {blockersCount > 0 && (
          <p className="flex items-center gap-1.5 text-body-sm font-semibold text-status-blocked">
            <OctagonAlert className="size-4" aria-hidden />
            Препятствий: <span className="tabular">{blockersCount}</span>
          </p>
        )}
        {dependency && (
          <p className="flex items-start gap-1.5 rounded-sm bg-surface-secondary px-3 py-2 text-caption text-text-secondary">
            <Link2Off className="mt-px size-3.5 shrink-0 text-text-muted" aria-hidden />
            {dependency}
          </p>
        )}
        {nextAction && !done && (
          <p className="flex items-start gap-1.5 text-body-sm font-semibold text-accent-strong">
            <ArrowRight className="mt-0.5 size-4 shrink-0" aria-hidden />
            {nextAction}
          </p>
        )}
      </div>
      {actions && <footer className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">{actions}</footer>}
    </article>
  );
}
