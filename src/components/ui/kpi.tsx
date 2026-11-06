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

const TONE_TEXT = { default: 'text-text-primary', success: 'text-success', warning: 'text-warning', error: 'text-error' } as const;

/** Числовой показатель. Значение – табличными цифрами, единица – отдельно и мельче. */
export function Kpi({ label, value, unit, hint, delta, tone = 'default', icon, className }: KpiProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface px-[18px] py-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-text-muted">{label}</span>
        {icon && <span className="text-text-muted [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('tabular text-numeric', TONE_TEXT[tone])}>{value}</span>
        {unit && <span className="text-body-sm text-text-muted">{unit}</span>}
      </div>
      {(hint || delta) && (
        <div className="flex flex-wrap items-center gap-2 text-caption text-text-muted">
          {delta && (
            <span className={cn('tabular inline-flex items-center gap-0.5 font-mono font-medium', delta.positive ? 'text-success' : 'text-error')}>
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
