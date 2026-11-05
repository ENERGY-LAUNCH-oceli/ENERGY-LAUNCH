import { STAGE_STATUS_LABEL } from '@/config/stages';
import type { StageStatus } from '@/types';
import { cn } from '@/utils/cn';

const TONE: Record<StageStatus, string> = {
  NOT_STARTED: 'bg-status-not-started/15 text-status-not-started border-status-not-started/30',
  IN_PROGRESS: 'bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30',
  BLOCKED: 'bg-status-blocked/15 text-status-blocked border-status-blocked/30',
  COMPLETED: 'bg-status-completed/15 text-status-completed border-status-completed/30',
};

export function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <span data-status={status} className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE[status])}>
      {STAGE_STATUS_LABEL[status]}
    </span>
  );
}
