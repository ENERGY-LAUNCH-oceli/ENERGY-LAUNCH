import type { StageStatus } from '@/types';
import { STAGE_STATUS_LABEL } from '@/config/stages';
import { cn } from '@/utils/cn';

const TEXT: Record<StageStatus, string> = {
  NOT_STARTED: 'text-status-not-started',
  IN_PROGRESS: 'text-status-in-progress',
  BLOCKED: 'text-status-blocked',
  COMPLETED: 'text-status-completed',
};

export interface StatusBadgeProps {
  status: StageStatus;
  size?: 'sm' | 'md';
  /** Только маркер (подпись остаётся для экранных дикторов). */
  iconOnly?: boolean;
  className?: string;
}

/** Статус этапа: маркер + текст. Статус никогда не передаётся одним цветом. */
export function StatusBadge({ status, size = 'md', iconOnly, className }: StatusBadgeProps) {
  const label = STAGE_STATUS_LABEL[status];
  return (
    <span
      data-status={status}
      title={iconOnly ? label : undefined}
      className={cn('inline-flex items-center gap-2 whitespace-nowrap font-medium', size === 'sm' ? 'text-[11px]' : 'text-caption', TEXT[status], className)}
    >
      <StatusDot status={status} />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </span>
  );
}

/** Маркер статуса: пустое кольцо – не начат, точка с ореолом – в работе/заблокирован, точка – завершён. */
export function StatusDot({ status, className }: { status: StageStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        status === 'NOT_STARTED' && 'border-[1.5px] border-status-not-started-solid',
        status === 'IN_PROGRESS' && 'bg-status-in-progress-solid ring-[3px] ring-status-in-progress-solid/20',
        status === 'BLOCKED' && 'animate-[pulse-ring_1.8s_ease-out_infinite] bg-status-blocked-solid ring-[3px] ring-status-blocked-solid/20',
        status === 'COMPLETED' && 'bg-status-completed-solid',
        className,
      )}
    />
  );
}
