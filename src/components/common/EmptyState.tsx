import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface-secondary text-center', compact ? 'p-6' : 'p-10', className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-accent-subtle text-accent-strong [&_svg]:size-5">{icon ?? <Inbox aria-hidden />}</span>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-body font-semibold">{title}</p>
        {description && <p className="text-body-sm text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
