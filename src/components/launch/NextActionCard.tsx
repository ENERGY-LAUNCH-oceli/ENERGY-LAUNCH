import { ArrowRight } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/utils/cn';

export interface NextActionCardProps {
  /** Этап, к которому относится действие. */
  stageLabel?: string;
  title: string;
  description?: React.ReactNode;
  /** Чем вызвано действие (ссылка на препятствие или незакрытое условие). */
  reason?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Следующее действие – самый заметный блок рабочего экрана: бирюзовая подложка
 * и бирюзовая рамка, одна кнопка действия.
 */
export function NextActionCard({ stageLabel, title, description, reason, action, className }: NextActionCardProps) {
  return (
    <section aria-label="Следующее действие" className={cn('flex flex-col gap-4 rounded-lg border border-accent/35 bg-accent-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="flex items-center gap-2 text-label text-accent-strong">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Следующее действие{stageLabel && ` · ${stageLabel}`}
        </span>
        <h3 className="text-h3">{title}</h3>
        {description && <p className="text-body-sm text-text-secondary">{description}</p>}
        {reason && (
          <p className="flex items-start gap-1.5 text-caption text-text-muted">
            <ArrowRight className="mt-px size-3.5 shrink-0" aria-hidden />
            {reason}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
