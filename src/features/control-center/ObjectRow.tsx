import { ChevronRight, Clock, MapPin, OctagonAlert, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META } from '@/config/stages';
import type { PortfolioRow } from '@/hooks/use-portfolio-rows';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { StageSequence } from './StageSequence';

/** Строка объекта: всё нужное для оценки за один взгляд, без декоративных элементов. */
export function ObjectRow({ row, search }: { row: PortfolioRow; search: string }) {
  const { entry, session, status, progress, blockers, lastCheck } = row;
  const blocked = status === 'BLOCKED';
  return (
    <li>
      <Link
        to={`${ROUTES.objectSection(entry.id, 'launch')}`}
        state={{ from: `${ROUTES.overview}${search}` }}
        data-testid={`object-row-${entry.id}`}
        className={cn(
          'group relative grid gap-x-5 gap-y-3 rounded-md border bg-surface px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface-secondary/60',
          'md:grid-cols-2 2xl:grid-cols-[minmax(220px,1.2fr)_minmax(236px,auto)_140px_88px_72px_minmax(130px,0.7fr)_16px] 2xl:items-center',
          blocked ? 'border-status-blocked-border' : 'border-border',
        )}
      >
        {blocked && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-pill bg-status-blocked-solid" />}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-body font-bold" title={entry.name}>{entry.name}</span>
            <span className="shrink-0 whitespace-nowrap font-mono text-caption text-text-muted">{entry.code}</span>
          </div>
          <span className="flex min-w-0 items-center gap-1 text-caption text-text-secondary">
            <MapPin className="size-3 shrink-0 text-text-muted" aria-hidden />
            <span className="truncate">{entry.address}</span>
          </span>
          <span className="text-caption text-text-muted">
            {entry.kind} · {entry.assets} · <span className="tabular">{entry.assetCount}</span> актива
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <StageSequence session={session} />
          <span className="text-caption text-text-muted">
            Текущий: <b className="font-semibold text-text-secondary">{STAGE_META[session?.currentStageId ?? 'METER_HISTORY'].titleRu}</b>
          </span>
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <StatusBadge status={status} />
        </div>

        <div className="flex flex-col gap-1.5" aria-label={`Готовность ${progress} %`}>
          <span className="tabular text-numeric-sm">{progress} %</span>
          <span className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken">
            <span className={cn('block h-full rounded-pill', status === 'COMPLETED' ? 'bg-status-completed-solid' : blocked ? 'bg-status-blocked-solid' : 'bg-accent')} style={{ width: `${progress}%` }} />
          </span>
        </div>

        <div className={cn('flex items-center gap-1.5 text-body-sm font-semibold', blockers.length ? 'text-status-blocked' : 'text-text-muted')}>
          <OctagonAlert className="size-4" aria-hidden />
          <span className="tabular">{blockers.length}</span>
          <span className="sr-only">препятствий</span>
        </div>

        <div className="flex min-w-0 flex-col gap-1 text-caption text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3 text-text-muted" aria-hidden />
            <span className="tabular">{lastCheck ? formatDateTime(lastCheck) : 'нет проверок'}</span>
          </span>
          <span className="flex items-center gap-1.5 truncate">
            <UserRound className="size-3 text-text-muted" aria-hidden />
            {entry.responsible}
          </span>
        </div>

        <ChevronRight className="hidden size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-strong 2xl:block" aria-hidden />
      </Link>
    </li>
  );
}

export function ObjectRowHeader() {
  return (
    <div aria-hidden className="hidden gap-x-5 px-5 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-text-muted 2xl:grid 2xl:grid-cols-[minmax(220px,1.2fr)_minmax(236px,auto)_140px_88px_72px_minmax(130px,0.7fr)_16px]">
      <span>Объект</span>
      <span>Этапы</span>
      <span>Статус</span>
      <span>Готовность</span>
      <span>Препятствия</span>
      <span>Проверка</span>
      <span />
    </div>
  );
}
