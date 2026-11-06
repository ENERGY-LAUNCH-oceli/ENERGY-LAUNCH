import { CircleCheck, CircleDashed, CircleMinus, CircleX, CloudOff, History, TriangleAlert } from 'lucide-react';
import { CHECK_STATUS_LABEL, type CheckStatus } from '@/config/labels';
import { cn } from '@/utils/cn';

export const CHECK_STATUS_STYLE: Record<CheckStatus, { icon: typeof CircleCheck; className: string; tone: 'success' | 'error' | 'warning' | 'neutral' | 'info' }> = {
  PASSED: { icon: CircleCheck, className: 'text-success', tone: 'success' },
  FAILED: { icon: CircleX, className: 'text-error', tone: 'error' },
  WARNING: { icon: TriangleAlert, className: 'text-warning', tone: 'warning' },
  SKIPPED: { icon: CircleDashed, className: 'text-text-muted', tone: 'neutral' },
  NOT_APPLICABLE: { icon: CircleMinus, className: 'text-text-muted', tone: 'neutral' },
  STALE: { icon: History, className: 'text-warning', tone: 'warning' },
  UNAVAILABLE: { icon: CloudOff, className: 'text-error', tone: 'error' },
  PENDING: { icon: CircleDashed, className: 'text-info', tone: 'info' },
};

/** Иконка + подпись статуса отдельной проверки. */
export function CheckStatusLabel({ status, className, iconOnly }: { status: CheckStatus; className?: string; iconOnly?: boolean }) {
  const { icon: Icon, className: tone } = CHECK_STATUS_STYLE[status];
  return (
    <span data-check-status={status} className={cn('inline-flex items-center gap-1.5 text-caption font-medium', className)} title={iconOnly ? CHECK_STATUS_LABEL[status] : undefined}>
      <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
      {iconOnly ? <span className="sr-only">{CHECK_STATUS_LABEL[status]}</span> : <span className="text-text-primary">{CHECK_STATUS_LABEL[status]}</span>}
    </span>
  );
}
