import type { CommandState } from '@/types';
import { cn } from '@/utils/cn';
import { STATE_LABEL } from './labels';

const TONE: Record<CommandState, { text: string; dot: string }> = {
  CREATED: { text: 'text-text-muted', dot: 'border-[1.5px] border-status-not-started-solid' },
  SENT: { text: 'text-status-in-progress', dot: 'bg-status-in-progress-solid' },
  RECEIVED: { text: 'text-status-in-progress', dot: 'bg-status-in-progress-solid' },
  RESPONDED: { text: 'text-status-in-progress', dot: 'bg-status-in-progress-solid' },
  PASSED: { text: 'text-status-completed', dot: 'bg-status-completed-solid' },
  FAILED: { text: 'text-status-blocked', dot: 'bg-status-blocked-solid' },
  TIMEOUT: { text: 'text-warning', dot: 'bg-warning' },
};

/** Состояние команды: маркер + текст. */
export function CommandStateBadge({ state, className }: { state: CommandState; className?: string }) {
  const t = TONE[state];
  return (
    <span data-command-state={state} className={cn('inline-flex items-center gap-2 whitespace-nowrap text-caption font-medium', t.text, className)}>
      <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', t.dot)} />
      {STATE_LABEL[state]}
    </span>
  );
}
