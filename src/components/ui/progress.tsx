import { cn } from '@/utils/cn';

export type ProgressTone = 'accent' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

const TONE: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  info: 'bg-info',
  success: 'bg-status-completed-solid',
  warning: 'bg-warning',
  error: 'bg-status-blocked-solid',
  neutral: 'bg-status-not-started-solid',
};

export interface ProgressProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  label?: string;
  /** Показать значение в процентах справа от подписи. */
  showValue?: boolean;
  /** Пороговая отметка (например, минимальная полнота 99 %). */
  threshold?: number;
  className?: string;
}

export function Progress({ value, max = 100, tone = 'accent', size = 'md', label, showValue, threshold, className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-baseline justify-between gap-2 text-caption">
          {label && <span className="text-text-secondary">{label}</span>}
          {showValue && <span className="tabular font-mono text-text-primary">{(Math.round(pct * 10) / 10).toLocaleString('ru-RU')} %</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className={cn('relative w-full overflow-hidden rounded-pill bg-surface-sunken', size === 'sm' ? 'h-1' : 'h-1.5')}
      >
        <div className={cn('h-full rounded-pill transition-[width] duration-slow ease-brand', TONE[tone])} style={{ width: `${pct}%` }} />
        {threshold !== undefined && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-text-primary/60"
            style={{ left: `${Math.min(100, (threshold / max) * 100)}%` }}
            title={`Порог ${threshold}`}
          />
        )}
      </div>
    </div>
  );
}
