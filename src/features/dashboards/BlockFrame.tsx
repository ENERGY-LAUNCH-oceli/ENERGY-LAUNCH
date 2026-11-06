import type * as React from 'react';
import type { BlockEvaluation } from '@/engine';
import { blockProblems } from '@/engine';
import { cn } from '@/utils/cn';

/** Рамка блока панели: название, объект и результат проверки. */
export function BlockFrame({ index, title, subtitle, objectId, evaluation, children, className }: { index: number; title: string; subtitle?: string; objectId: string; evaluation?: BlockEvaluation; children: React.ReactNode; className?: string }) {
  const problems = evaluation ? blockProblems(evaluation) : [];
  return (
    <section className={cn('flex min-w-0 flex-col overflow-hidden rounded-lg border bg-surface', evaluation && !evaluation.ok ? 'border-error-border' : 'border-border', className)} data-block={evaluation?.blockId} data-block-ok={evaluation ? evaluation.ok : undefined}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-secondary font-mono text-caption font-medium text-text-muted">{String(index).padStart(2, '0')}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-h3">{title}</h3>
            <span className="text-caption text-text-muted">{subtitle ?? `Объект ${objectId}`}</span>
          </div>
        </div>
        {evaluation && (
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium', evaluation.ok ? 'border-status-completed-border bg-status-completed-bg text-status-completed' : 'border-status-blocked-border bg-status-blocked-bg text-status-blocked')}>
            <span aria-hidden className={cn('size-1.5 rounded-full', evaluation.ok ? 'bg-status-completed-solid' : 'bg-status-blocked-solid')} />
            {evaluation.ok ? 'Всё в порядке' : 'Есть замечания'}
          </span>
        )}
      </header>
      {problems.length > 0 && (
        <ul className="border-b border-error-border bg-error-subtle px-5 py-2 text-caption text-error">
          {problems.map((p) => (
            <li key={p}>– {p}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-5 px-5 py-4">{children}</div>
    </section>
  );
}

/** Подзаголовок виджета внутри блока. */
export function Widget({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label text-text-muted">{title}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Компактный показатель: подпись и значение. */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-caption text-text-muted">{label}</span>
      <span className={cn('font-heading text-[20px] font-semibold leading-7 tracking-[-0.02em] tabular', tone === 'ok' && 'text-status-completed', tone === 'bad' && 'text-status-blocked', tone === 'warn' && 'text-warning')}>{value}</span>
    </div>
  );
}
