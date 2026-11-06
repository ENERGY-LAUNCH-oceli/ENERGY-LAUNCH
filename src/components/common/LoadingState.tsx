import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface LoadingStateProps {
  label?: string;
  /** skeleton – каркас содержимого; spinner – индикатор с подписью. */
  variant?: 'skeleton' | 'spinner';
  rows?: number;
  className?: string;
}

export function LoadingState({ label = 'Загрузка…', variant = 'skeleton', rows = 3, className }: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <div role="status" className={cn('flex items-center justify-center gap-2 p-10 text-body-sm text-text-secondary', className)}>
        <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
        {label}
      </div>
    );
  }
  return (
    <div role="status" aria-label={label} className={cn('flex flex-col gap-3 rounded-lg border border-border bg-surface p-5', className)}>
      <div className="skeleton h-5 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-3.5" style={{ width: `${92 - i * 14}%` }} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton h-4', className)} />;
}
