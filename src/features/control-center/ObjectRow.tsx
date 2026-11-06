import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META } from '@/config/stages';
import type { PortfolioRow } from '@/hooks/use-portfolio-rows';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { StageSequence } from './StageSequence';

/** Колонки строки и шапки – одна сетка на широком экране. */
const COLS = 'lg:grid-cols-[minmax(220px,1.4fr)_164px_132px_112px_88px_minmax(132px,0.8fr)_16px]';

/** Строка объекта в таблице портфеля: всё нужное для оценки за один взгляд. */
export function ObjectRow({ row, search }: { row: PortfolioRow; search: string }) {
  const { entry, session, status, progress, blockers, lastCheck } = row;
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`${ROUTES.objectSection(entry.id, 'launch')}`}
        state={{ from: `${ROUTES.overview}${search}` }}
        data-testid={`object-row-${entry.id}`}
        className={cn('group grid grid-cols-2 gap-x-5 gap-y-3 px-5 py-3.5 transition-colors duration-fast hover:bg-surface-hover lg:items-center', COLS)}
      >
        <div className="col-span-2 flex min-w-0 flex-col gap-0.5 lg:col-span-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-body font-medium" title={entry.name}>
              {entry.name}
            </span>
            <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-text-muted">{entry.code}</span>
          </div>
          <span className="truncate text-caption text-text-muted" title={entry.address}>
            {entry.address} · {entry.assets}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <StageSequence session={session} />
          <span className="truncate text-[11px] text-text-muted">{STAGE_META[session?.currentStageId ?? 'METER_HISTORY'].titleRu}</span>
        </div>

        <div>
          <StatusBadge status={status} />
        </div>

        <div className="flex items-center gap-2.5" aria-label={`Готовность ${progress} %`}>
          <span className="tabular w-11 whitespace-nowrap font-mono text-caption">{progress} %</span>
          <span className="h-1 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
            <span
              className={cn('block h-full rounded-pill', status === 'COMPLETED' ? 'bg-status-completed-solid' : status === 'BLOCKED' ? 'bg-status-blocked-solid' : 'bg-accent')}
              style={{ width: `${progress}%` }}
            />
          </span>
        </div>

        <div className={cn('font-mono text-caption', blockers.length ? 'text-status-blocked' : 'text-text-muted')}>
          <span className="tabular">{blockers.length}</span>
          <span className="lg:sr-only"> препятствий</span>
        </div>

        <div className="flex min-w-0 flex-col text-caption">
          <span className="tabular font-mono text-text-secondary">{lastCheck ? formatDateTime(lastCheck) : 'нет проверок'}</span>
          <span className="truncate text-text-muted">{entry.responsible}</span>
        </div>

        <ChevronRight className="hidden size-4 text-text-muted transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-text-primary lg:block" aria-hidden />
      </Link>
    </li>
  );
}

export function ObjectRowHeader() {
  return (
    <div aria-hidden className={cn('hidden gap-x-5 border-b border-border px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted lg:grid', COLS)}>
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
