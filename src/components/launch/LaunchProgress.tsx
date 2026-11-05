import { BadgeCheck, Lock } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { StageStatus } from '@/types';
import { cn } from '@/utils/cn';

export interface LaunchProgressStage {
  id: string;
  title: string;
  status: StageStatus;
}

export interface LaunchProgressProps {
  /** Название объекта; не передаётся, если оно уже есть в заголовке страницы. */
  objectName?: string;
  objectCode?: string;
  stages: LaunchProgressStage[];
  currentStageId?: string;
  /** Итоговая готовность: только после завершения всех этапов и приёмки дашбордов (ТЗ 2.2.5). */
  ready?: boolean;
  className?: string;
}

const SEGMENT: Record<StageStatus, string> = {
  NOT_STARTED: 'bg-surface-sunken',
  IN_PROGRESS: 'bg-status-in-progress-solid',
  BLOCKED: 'bg-status-blocked-solid',
  COMPLETED: 'bg-status-completed-solid',
};

/** Общий прогресс запуска: сегмент на каждый этап, текущий этап, итоговая готовность. */
export function LaunchProgress({ objectName, objectCode, stages, currentStageId, ready, className }: LaunchProgressProps) {
  const completed = stages.filter((s) => s.status === 'COMPLETED').length;
  const blocked = stages.filter((s) => s.status === 'BLOCKED').length;
  const current = stages.find((s) => s.id === currentStageId);
  const currentIndex = current ? stages.indexOf(current) + 1 : null;
  const pct = Math.round((completed / stages.length) * 100);

  return (
    <section aria-label="Прогресс запуска" className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-label uppercase text-accent-strong">{objectName ? 'Запуск объекта' : 'Прогресс запуска'}</span>
          <h2 className="truncate text-h2">{objectName ?? `Завершено этапов: ${completed} из ${stages.length}`}</h2>
          {objectCode && <span className="font-mono text-caption text-text-muted">{objectCode}</span>}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="tabular text-display text-text-primary">{pct}</span>
          <span className="text-h3 text-text-secondary">%</span>
        </div>
      </div>

      <div className="px-6">
        <div className="flex gap-1.5" role="img" aria-label={`Завершено этапов: ${completed} из ${stages.length}`}>
          {stages.map((s) => (
            <span key={s.id} className={cn('h-2 flex-1 rounded-pill transition-colors duration-slow', SEGMENT[s.status], s.id === currentStageId && s.status !== 'COMPLETED' && 'ring-2 ring-offset-2 ring-offset-surface ring-accent/40')} />
          ))}
        </div>
        <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stages.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-1">
              <span className={cn('text-caption', s.id === currentStageId ? 'font-bold text-text-primary' : 'text-text-secondary')}>
                {i + 1}. {s.title}
              </span>
              <StatusBadge status={s.status} size="sm" className="self-start" />
            </li>
          ))}
        </ol>
      </div>

      <div
        className={cn(
          'mt-6 flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4',
          ready ? 'border-transparent bg-brand' : 'border-border bg-surface-secondary',
        )}
      >
        {ready ? (
          <span className="flex items-center gap-2 text-body-sm font-bold text-text-primary">
            <BadgeCheck className="size-5 text-accent-strong" aria-hidden />
            Объект готов к эксплуатации — все этапы завершены, дашборды приняты
          </span>
        ) : (
          <span className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Lock className="size-4 text-text-muted" aria-hidden />
            Готовность не объявлена.
            {currentIndex && current && (
              <span>
                Текущий этап: <span className="font-semibold text-text-primary">{currentIndex}. {current.title}</span>
              </span>
            )}
          </span>
        )}
        <span className="tabular text-caption text-text-muted">
          Завершено {completed} из {stages.length}
          {blocked > 0 && <span className="font-semibold text-status-blocked"> · заблокировано {blocked}</span>}
        </span>
      </div>
    </section>
  );
}
