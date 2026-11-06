import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { CHECK_DIMENSION_LABEL, type CheckStatus } from '@/config/labels';
import type { CheckDimension } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { CheckStatusLabel } from './check-status';

export interface ValidationResultView {
  ruleId: string;
  title: string;
  status: CheckStatus;
  dimension: CheckDimension;
  message: string;
  blocking?: boolean;
  actual?: string | number | null;
  expected?: string | number | null;
  unit?: string;
  /** Место проблемы: интервалы и поля, актив и сигналы (ТЗ 3.1.3). */
  location?: string[];
  /** Подтверждение (ТЗ 3.1.2): источник, время, версия правила. */
  source?: string;
  evaluatedAt?: string;
  rulesetVersion?: string;
}

export interface ValidationResultProps {
  result: ValidationResultView;
  onOpen?: () => void;
  className?: string;
}

const fmt = (v: string | number | null | undefined, unit?: string) =>
  v === undefined || v === null ? '–' : `${typeof v === 'number' ? v.toLocaleString('ru-RU') : v}${unit ? ` ${unit}` : ''}`;

/** Результат одной проверки с подтверждением: источник, результат, время и версия правила. */
export function ValidationResult({ result, onOpen, className }: ValidationResultProps) {
  const failed = result.status === 'FAILED' || result.status === 'UNAVAILABLE';
  const Wrapper: React.ElementType = onOpen ? 'button' : 'div';
  return (
    <Wrapper
      {...(onOpen ? { type: 'button', onClick: onOpen } : {})}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-md border bg-surface p-4 text-left transition-colors duration-fast',
        failed ? 'border-error-border' : 'border-border',
        onOpen && 'hover:border-border-strong',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-caption font-medium text-text-secondary">{result.ruleId}</span>
          <span className="truncate text-body-sm font-medium">{result.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="neutral" size="sm">
            {CHECK_DIMENSION_LABEL[result.dimension]}
          </Badge>
          {result.blocking === false && (
            <Badge tone="neutral" size="sm">
              Не блокирует
            </Badge>
          )}
          <CheckStatusLabel status={result.status} />
          {onOpen && <ChevronRight className="size-4 text-text-muted group-hover:text-text-primary" aria-hidden />}
        </div>
      </div>
      <p className="text-body-sm text-text-secondary">{result.message}</p>
      {(result.actual !== undefined || result.expected !== undefined) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-caption">
          <div className="flex gap-1.5">
            <dt className="text-text-muted">Факт</dt>
            <dd className={cn('tabular font-medium', failed ? 'text-error' : 'text-text-primary')}>{fmt(result.actual, result.unit)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-text-muted">Требование</dt>
            <dd className="tabular font-medium">{fmt(result.expected, result.unit)}</dd>
          </div>
        </dl>
      )}
      {result.location && result.location.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {result.location.map((l) => (
            <li key={l} className="rounded-xs bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
              {l}
            </li>
          ))}
        </ul>
      )}
      {(result.source || result.evaluatedAt || result.rulesetVersion) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-caption text-text-muted">
          {result.source && <span>Источник: <span className="font-mono text-text-secondary">{result.source}</span></span>}
          {result.evaluatedAt && <span className="tabular">{formatDateTime(result.evaluatedAt)}</span>}
          {result.rulesetVersion && <span>Правила v{result.rulesetVersion}</span>}
        </div>
      )}
    </Wrapper>
  );
}
