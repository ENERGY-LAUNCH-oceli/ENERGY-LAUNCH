import { STAGE_STATUS_LABEL } from '@/config/stages';
import { STAGE_IDS, type LaunchSession, type StageId } from '@/types';
import { cn } from '@/utils/cn';

export const STAGE_SHORT: Record<StageId, string> = {
  METER_HISTORY: 'History',
  REALTIME_TELEMETRY: 'Telemetry',
  ASSET_CONTROL: 'Control',
  FINAL_DASHBOARDS: 'Dashboards',
};

const BAR: Record<string, string> = {
  COMPLETED: 'bg-status-completed-solid',
  IN_PROGRESS: 'bg-status-in-progress-solid',
  BLOCKED: 'bg-status-blocked-solid',
  NOT_STARTED: 'bg-surface-sunken',
};

/** Четыре этапа запуска – четыре отрезка: цвет и подсказка дают статус, текущий этап отмечен номером. */
export function StageSequence({ session, className }: { session: LaunchSession | undefined; className?: string }) {
  return (
    <ol className={cn('flex items-center gap-1', className)} aria-label="Этапы запуска">
      {STAGE_IDS.map((id, i) => {
        const status = session?.stages[id].status ?? 'NOT_STARTED';
        const current = session?.currentStageId === id && status !== 'COMPLETED';
        return (
          <li key={id} title={`0${i + 1} ${STAGE_SHORT[id]}: ${STAGE_STATUS_LABEL[status]}`} data-stage-status={status} className="flex flex-col items-start gap-1">
            <span className={cn('tabular font-mono text-[10px] leading-none', current ? 'text-text-primary' : 'text-text-muted')}>0{i + 1}</span>
            <span className={cn('block h-1 w-8 rounded-pill', BAR[status], status === 'NOT_STARTED' && 'ring-1 ring-inset ring-border-strong')} />
            <span className="sr-only">
              {STAGE_SHORT[id]}: {STAGE_STATUS_LABEL[status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
