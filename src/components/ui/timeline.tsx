import type * as React from 'react';
import { cn } from '@/utils/cn';

export type TimelineTone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'error';

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  time: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  tone?: TimelineTone;
  icon?: React.ReactNode;
}

const DOT: Record<TimelineTone, string> = {
  neutral: 'border-border-strong bg-surface text-text-muted',
  accent: 'border-accent/40 bg-accent-subtle text-accent-strong',
  info: 'border-info-border bg-info-subtle text-info',
  success: 'border-success-border bg-success-subtle text-success',
  warning: 'border-warning-border bg-warning-subtle text-warning',
  error: 'border-error-border bg-error-subtle text-error',
};

/** Вертикальная лента событий. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('relative flex flex-col', className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
          {i < items.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px bg-border" />}
          <span className={cn('relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3.5', DOT[item.tone ?? 'neutral'])}>
            {item.icon ?? <span className="size-1.5 rounded-full bg-current" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-body-sm font-medium">{item.title}</span>
              <span className="tabular text-caption text-text-muted">{item.time}</span>
            </div>
            {item.description && <div className="text-body-sm text-text-secondary">{item.description}</div>}
            {item.meta && <div className="mt-1 flex flex-wrap gap-1.5">{item.meta}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
