import { CheckCircle2, CircleDashed, OctagonAlert, LoaderCircle } from 'lucide-react';
import type { StageStatus } from '@/types';
import { STAGE_STATUS_LABEL } from '@/config/stages';
import { cn } from '@/utils/cn';

const STYLE: Record<StageStatus, { className: string; icon: typeof CheckCircle2 }> = {
  NOT_STARTED: { className: 'border-status-not-started-border bg-status-not-started-bg text-status-not-started', icon: CircleDashed },
  IN_PROGRESS: { className: 'border-status-in-progress-border bg-status-in-progress-bg text-status-in-progress', icon: LoaderCircle },
  BLOCKED: { className: 'border-status-blocked-border bg-status-blocked-bg text-status-blocked', icon: OctagonAlert },
  COMPLETED: { className: 'border-status-completed-border bg-status-completed-bg text-status-completed', icon: CheckCircle2 },
};

export interface StatusBadgeProps {
  status: StageStatus;
  size?: 'sm' | 'md';
  /** Только иконка (подпись остаётся для экранных дикторов). */
  iconOnly?: boolean;
  className?: string;
}

/** Статус этапа: цвет + иконка + текст. Статус никогда не передаётся одним цветом. */
export function StatusBadge({ status, size = 'md', iconOnly, className }: StatusBadgeProps) {
  const { className: tone, icon: Icon } = STYLE[status];
  const label = STAGE_STATUS_LABEL[status];
  return (
    <span
      data-status={status}
      title={iconOnly ? label : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border font-semibold',
        size === 'sm' ? 'h-5 px-2 text-[11px] [&_svg]:size-3' : 'h-6 px-2.5 text-caption [&_svg]:size-3.5',
        iconOnly && 'px-1',
        tone,
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={2.25} />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

/** Маркер статуса (точка/кольцо) для степперов и таймлайнов. */
export function StatusDot({ status, className }: { status: StageStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        status === 'NOT_STARTED' && 'border-2 border-status-not-started-solid bg-surface',
        status === 'IN_PROGRESS' && 'bg-status-in-progress-solid ring-4 ring-status-in-progress-bg',
        status === 'BLOCKED' && 'bg-status-blocked-solid ring-4 ring-status-blocked-bg',
        status === 'COMPLETED' && 'bg-status-completed-solid',
        className,
      )}
    />
  );
}
