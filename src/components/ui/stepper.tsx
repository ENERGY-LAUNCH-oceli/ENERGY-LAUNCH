import { Check, OctagonAlert } from 'lucide-react';
import type { StageStatus } from '@/types';
import { STAGE_STATUS_LABEL } from '@/config/stages';
import { cn } from '@/utils/cn';

export interface StepperStep {
  id: string;
  title: string;
  status: StageStatus;
  description?: string;
}

export interface StepperProps {
  steps: StepperStep[];
  currentId?: string;
  onStepClick?: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const MARKER: Record<StageStatus, string> = {
  NOT_STARTED: 'border-status-not-started-border bg-surface text-status-not-started',
  IN_PROGRESS: 'border-status-in-progress-solid bg-status-in-progress-bg text-status-in-progress',
  BLOCKED: 'border-status-blocked-solid bg-status-blocked-bg text-status-blocked',
  COMPLETED: 'border-status-completed-solid bg-status-completed-solid text-white',
};

/** Пошаговая навигация по последовательным этапам. */
export function Stepper({ steps, currentId, onStepClick, orientation = 'horizontal', className }: StepperProps) {
  const vertical = orientation === 'vertical';
  return (
    <ol className={cn('flex', vertical ? 'flex-col gap-0' : 'flex-col gap-4 sm:flex-row sm:gap-0', className)}>
      {steps.map((step, i) => {
        const isCurrent = step.id === currentId;
        const Comp = onStepClick ? 'button' : 'div';
        return (
          <li key={step.id} className={cn('relative flex', vertical ? 'pb-6 last:pb-0' : 'flex-1')}>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute bg-border',
                  vertical ? 'left-4 top-9 h-[calc(100%-40px)] w-px' : 'left-4 top-9 h-[calc(100%-24px)] w-px sm:left-11 sm:right-3 sm:top-4 sm:h-px sm:w-auto',
                  step.status === 'COMPLETED' && 'bg-status-completed-solid',
                )}
              />
            )}
            <Comp
              {...(onStepClick ? { type: 'button' as const, onClick: () => onStepClick(step.id) } : {})}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn('group relative flex items-start gap-3 text-left', vertical ? '' : 'sm:flex-col sm:gap-2 sm:pr-4', onStepClick && 'rounded-sm')}
            >
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-caption font-bold tabular transition-colors', MARKER[step.status], isCurrent && 'ring-4 ring-accent/20')}>
                {step.status === 'COMPLETED' ? <Check className="size-4" strokeWidth={3} /> : step.status === 'BLOCKED' ? <OctagonAlert className="size-4" /> : i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={cn('text-body-sm font-semibold', onStepClick && 'group-hover:text-accent-strong')}>{step.title}</span>
                <span className={cn('text-caption', step.status === 'BLOCKED' ? 'font-semibold text-status-blocked' : 'text-text-muted')}>
                  {step.description ?? STAGE_STATUS_LABEL[step.status]}
                </span>
              </span>
            </Comp>
          </li>
        );
      })}
    </ol>
  );
}
