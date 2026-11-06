import { Check, OctagonAlert } from 'lucide-react';
import { Fragment } from 'react';
import { STAGE_STATUS_LABEL } from '@/config/stages';
import { STAGE_IDS, type LaunchSession, type StageId } from '@/types';
import { cn } from '@/utils/cn';

export const STAGE_SHORT: Record<StageId, string> = {
  METER_HISTORY: 'History',
  REALTIME_TELEMETRY: 'Telemetry',
  ASSET_CONTROL: 'Control',
  FINAL_DASHBOARDS: 'Dashboards',
};

/** Горизонтальная последовательность «01 History → 02 Telemetry → 03 Control → 04 Dashboards». */
export function StageSequence({ session, className }: { session: LaunchSession | undefined; className?: string }) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Этапы запуска">
      {STAGE_IDS.map((id, i) => {
        const status = session?.stages[id].status ?? 'NOT_STARTED';
        const current = session?.currentStageId === id && status !== 'COMPLETED';
        return (
          <Fragment key={id}>
            {i > 0 && <span aria-hidden className={cn('h-px w-3 shrink-0', status === 'NOT_STARTED' ? 'bg-border-strong' : 'bg-text-muted')} />}
            <li
              title={`${STAGE_SHORT[id]}: ${STAGE_STATUS_LABEL[status]}`}
              data-stage-status={status}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-pill border px-2 text-[11px] font-semibold',
                status === 'COMPLETED' && 'border-transparent bg-status-completed-bg text-status-completed',
                status === 'IN_PROGRESS' && 'border-status-in-progress-border bg-status-in-progress-bg text-status-in-progress',
                status === 'BLOCKED' && 'border-status-blocked-border bg-status-blocked-bg text-status-blocked',
                status === 'NOT_STARTED' && 'border-dashed border-border-strong bg-surface text-text-muted',
                current && 'ring-2 ring-accent/25',
              )}
            >
              <span className="tabular font-mono text-[10px] opacity-70">0{i + 1}</span>
              {status === 'COMPLETED' && <Check className="size-3" strokeWidth={3} aria-hidden />}
              {status === 'BLOCKED' && <OctagonAlert className="size-3" aria-hidden />}
              <span className="hidden min-[2200px]:inline">{STAGE_SHORT[id]}</span>
              <span className="sr-only">{STAGE_STATUS_LABEL[status]}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
