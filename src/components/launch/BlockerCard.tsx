import { ArrowRight, CircleCheck, OctagonAlert } from 'lucide-react';
import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { Blocker } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

export interface BlockerCardProps {
  blocker: Pick<Blocker, 'id' | 'title' | 'description' | 'severity' | 'status' | 'source' | 'ruleId' | 'createdAt' | 'resolvedAt' | 'resolution'>;
  /** Точное место: интервалы и поля / актив и сигналы / причина (ТЗ 3.1.3). */
  location?: { label: string; value: string }[];
  nextAction?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Препятствие. Выделяется акцентной левой границей, коралловой иконкой и светлой
 * подложкой — без сплошной красной заливки, чтобы список блокеров оставался читаемым.
 */
export function BlockerCard({ blocker: b, location, nextAction, actions, className }: BlockerCardProps) {
  const open = b.status === 'OPEN';
  return (
    <article
      data-blocker-status={b.status}
      className={cn(
        'relative flex gap-3 overflow-hidden rounded-md border bg-surface p-4 pl-5',
        open ? 'border-status-blocked-border' : 'border-border bg-surface-secondary',
        className,
      )}
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', open ? 'bg-status-blocked-solid' : 'bg-status-completed-solid')} />
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', open ? 'bg-status-blocked-bg text-status-blocked' : 'bg-status-completed-bg text-status-completed')}>
        {open ? <OctagonAlert className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className={cn('text-body-sm font-semibold', !open && 'text-text-secondary line-through decoration-text-muted/50')}>{b.title}</h4>
          <div className="flex items-center gap-1.5">
            {b.severity === 'CRITICAL' && open && (
              <Badge tone="error" size="sm">
                Блокирует этап
              </Badge>
            )}
            {b.status === 'WAIVED' && (
              <Badge tone="warning" size="sm">
                Принято по правилу
              </Badge>
            )}
            {b.status === 'RESOLVED' && (
              <Badge tone="success" size="sm">
                Устранено
              </Badge>
            )}
          </div>
        </div>
        <p className="text-body-sm text-text-secondary">{b.description}</p>
        {location && location.length > 0 && (
          <dl className="grid gap-x-4 gap-y-1 rounded-sm bg-surface-secondary p-2.5 text-caption sm:grid-cols-[auto_1fr]">
            {location.map((l) => (
              <div key={l.label} className="contents">
                <dt className="text-text-muted">{l.label}</dt>
                <dd className="font-mono text-text-primary">{l.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {nextAction && open && (
          <p className="flex items-start gap-1.5 text-body-sm font-semibold text-accent-strong">
            <ArrowRight className="mt-0.5 size-4 shrink-0" aria-hidden />
            {nextAction}
          </p>
        )}
        {!open && b.resolution && <p className="text-caption text-text-muted">Решение: {b.resolution}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-caption text-text-muted">
            {b.ruleId && <span className="font-mono">{b.ruleId} · </span>}
            {b.source === 'VALIDATION' ? 'Автоматическая проверка' : 'Добавлено вручную'} · <span className="tabular">{formatDateTime(b.resolvedAt ?? b.createdAt)}</span>
          </span>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      </div>
    </article>
  );
}
