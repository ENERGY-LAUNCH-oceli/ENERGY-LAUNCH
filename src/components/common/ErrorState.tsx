import { CloudOff, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

export interface ErrorStateProps {
  title?: string;
  description?: ReactNode;
  /** Время последней успешной проверки (требование ТЗ для недоступного источника). */
  lastSuccessAt?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** Ошибка загрузки или недоступность источника. Не выдаётся за пустой или успешный результат. */
export function ErrorState({ title = 'Источник недоступен', description, lastSuccessAt, onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-error-border bg-surface p-10 text-center', className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-error-subtle text-error">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-body font-medium">{title}</p>
        {description && <p className="text-body-sm text-text-secondary">{description}</p>}
        <p className="text-caption text-text-muted">
          Последняя успешная проверка: <span className="tabular font-medium text-text-secondary">{lastSuccessAt ? formatDateTime(lastSuccessAt) : 'не выполнялась'}</span>
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
          {!retrying && <RotateCw aria-hidden />}
          Повторить
        </Button>
      )}
    </div>
  );
}
