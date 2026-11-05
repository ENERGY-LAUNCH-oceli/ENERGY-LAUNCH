import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/utils/cn';

export interface KpiProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Пояснение под значением: порог, период. */
  hint?: React.ReactNode;
  delta?: { value: string; direction: 'up' | 'down'; positive?: boolean };
  tone?: 'default' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  className?: string;
}

const TONE_BAR = { default: 'bg-accent', success: 'bg-status-completed-solid', warning: 'bg-warning', error: 'bg-status-blocked-solid' } as const;

/** Числовой показатель. Значение — табличными цифрами, единица — отдельно и мельче. */
export function Kpi({ label, value, unit, hint, delta, tone = 'default', icon, className }: KpiProps) {
  return (
    <div className={cn('relative flex flex-col gap-2 overflow-hidden rounded-lg border border-border bg-surface p-5', className)}>
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-0.5', TONE_BAR[tone])} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold text-text-secondary">{label}</span>
        {icon && <span className="text-text-muted [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular text-numeric text-text-primary">{value}</span>
        {unit && <span className="text-body-sm font-semibold text-text-secondary">{unit}</span>}
      </div>
      {(hint || delta) && (
        <div className="flex flex-wrap items-center gap-2 text-caption text-text-muted">
          {delta && (
            <span className={cn('tabular inline-flex items-center gap-0.5 font-semibold', delta.positive ? 'text-success' : 'text-error')}>
              {delta.direction === 'up' ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {delta.value}
            </span>
          )}
          {hint}
        </div>
      )}
    </div>
  );
}
