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
 * Следующее действие — самый заметный блок рабочего экрана. Тёмно-синяя поверхность
 * и бирюзовый надзаголовок повторяют подвал и CTA-кнопки Oceli Energy.
 */
export function NextActionCard({ stageLabel, title, description, reason, action, className }: NextActionCardProps) {
  return (
    <section aria-label="Следующее действие" className={cn('flex flex-col gap-4 rounded-lg bg-surface-inverse p-6 text-text-inverse sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-label uppercase text-[#22AFBF]">Следующее действие{stageLabel && ` · ${stageLabel}`}</span>
        <h3 className="text-h3 text-text-inverse">{title}</h3>
        {description && <p className="text-body-sm text-white/80">{description}</p>}
        {reason && (
          <p className="flex items-start gap-1.5 text-caption text-white/60">
            <ArrowRight className="mt-px size-3.5 shrink-0" aria-hidden />
            {reason}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
