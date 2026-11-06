import { Clock, ListChecks, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META } from '@/config/stages';
import type { LaunchSession, StageId } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { stageStats } from './model';

/** Компактная карточка этапа: счётчики проверок и вход в подробности. */
export function StageSummaryCard({ session, stageId, responsible, selected, onOpen }: { session: LaunchSession; stageId: StageId; responsible: string; selected: boolean; onOpen: () => void }) {
  const stage = session.stages[stageId];
  const s = stageStats(session, stageId);
  const blocked = stage.status === 'BLOCKED';
  return (
    <article
      data-testid={`stage-${stageId}`}
      data-stage-status={stage.status}
      className={cn('relative flex flex-col gap-4 overflow-hidden rounded-lg border bg-surface p-5', blocked ? 'border-status-blocked-border' : selected ? 'border-accent/50' : 'border-border')}
    >
      {(blocked || selected) && <span aria-hidden className={cn('absolute inset-x-0 top-0 h-[3px]', blocked ? 'bg-status-blocked-solid' : 'bg-accent')} />}
      <header className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="tabular font-mono text-caption font-medium text-text-muted">0{stage.order}</span>
          <h3 className="text-h3">{STAGE_META[stageId].titleRu}</h3>
        </div>
        <StatusBadge status={stage.status} size="sm" />
      </header>
      <p className="line-clamp-2 text-caption text-text-secondary">{STAGE_META[stageId].description}</p>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-1">
          <span className="tabular text-numeric">{stage.status === 'NOT_STARTED' ? 0 : s.percent}</span>
          <span className="text-body-sm font-medium text-text-secondary">% проверок пройдено</span>
        </div>
        <dl className="grid grid-cols-3 gap-2 rounded-sm bg-surface-secondary px-3 py-2 text-caption">
          <div className="flex flex-col">
            <dt className="text-text-muted">Успешно</dt>
            <dd className="tabular text-body-sm font-medium text-success">{s.passed}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-text-muted">Ошибки</dt>
            <dd className={cn('tabular text-body-sm font-medium', s.failed ? 'text-error' : 'text-text-muted')}>{s.failed}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-text-muted">Предупр.</dt>
            <dd className={cn('tabular text-body-sm font-medium', s.warnings ? 'text-warning' : 'text-text-muted')}>{s.warnings}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-3 text-caption text-text-secondary">
        <span className="flex items-center gap-1.5">
          <UserRound className="size-3.5 text-text-muted" aria-hidden />
          {responsible}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-text-muted" aria-hidden />
          <span className="tabular">{stage.lastValidatedAt ? formatDateTime(stage.lastValidatedAt) : 'Проверки не запускались'}</span>
        </span>
      </div>
      <Button variant={selected ? 'primary' : 'secondary'} size="sm" onClick={onOpen} className="mt-auto">
        <ListChecks aria-hidden />
        Открыть проверки
      </Button>
    </article>
  );
}
