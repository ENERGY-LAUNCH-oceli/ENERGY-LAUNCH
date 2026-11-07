import type { InvoiceReport } from '@/types';
import { cn } from '@/utils/cn';
import { coverageMonths, isPendingMonth, monthLabel } from './labels';

/** Временная шкала на 24 месяца: полный, частичный, отсутствующий месяц; дубли отмечены. */
export function CoverageTimeline({ report, periodMonths }: { report: InvoiceReport | undefined; periodMonths: number }) {
  const months = report?.window?.months;
  const present = months ? coverageMonths(months).filter((m) => m.state !== 'MISSING').length : 0;
  return (
    <section id="coverage" aria-label="Покрытие 24 месяцев" className="scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-label text-text-muted">Coverage</span>
          <h2 className="text-h3">Покрытие {periodMonths} последовательных месяцев</h2>
        </div>
        {months && (
          <span className={cn('tabular text-h2', present < periodMonths ? 'text-status-blocked' : 'text-status-completed')}>
            {present}
            <span className="text-body-sm font-medium text-text-secondary"> из {periodMonths} мес</span>
          </span>
        )}
      </div>
      {!months ? (
        <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label="Нет данных">
          {Array.from({ length: periodMonths }, (_, i) => (
            <li key={i} className="h-14 rounded-sm border border-dashed border-border-strong" />
          ))}
        </ol>
      ) : (
        <>
          <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" data-testid="coverage-timeline">
            {months.map((m) => {
              const pct = m.expected ? (m.present / m.expected) * 100 : 0;
              const pending = isPendingMonth(m);
              return (
                <li
                  key={m.month}
                  data-month={m.month}
                  data-month-state={m.state}
                  data-pending={pending ? '' : undefined}
                  title={pending ? `${m.month}: задержка публикации – данные за последние сутки окна ещё не опубликованы, в покрытие не входит` : `${m.month}: ${m.present} из ${m.expected} интервалов${m.duplicates ? `, дублей ${m.duplicates}` : ''}`}
                  className={cn(
                    'relative flex h-16 flex-col justify-between overflow-hidden rounded-sm border px-1.5 py-1',
                    pending && 'border-dashed border-border-strong bg-surface',
                    !pending && m.state === 'FULL' && 'border-status-completed-border bg-status-completed-bg',
                    m.state === 'PARTIAL' && 'border-warning-border bg-warning-subtle',
                    m.state === 'MISSING' && 'border-dashed border-status-blocked-border bg-[repeating-linear-gradient(135deg,rgb(var(--el-error-subtle)),rgb(var(--el-error-subtle))_4px,rgb(var(--el-surface))_4px,rgb(var(--el-surface))_8px)]',
                  )}
                >
                  <span className={cn('text-[11px] font-medium', m.state === 'MISSING' ? 'text-status-blocked' : 'text-text-primary')}>{monthLabel(m.month)}</span>
                  <span className="tabular text-[10px] text-text-secondary">{pending ? 'публикуется' : m.state === 'MISSING' ? 'нет данных' : `${Math.floor(pct * 10) / 10}%`}</span>
                  {m.duplicates > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-warning" aria-label="Есть дубли" />}
                  <span aria-hidden className={cn('absolute inset-x-0 bottom-0 h-1', m.state === 'FULL' ? 'bg-status-completed-solid' : m.state === 'PARTIAL' ? 'bg-warning' : 'bg-transparent')} style={{ width: `${pct}%` }} />
                </li>
              );
            })}
          </ol>
          <dl className="mt-4 grid gap-3 text-body-sm sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <dt className="text-caption text-text-muted">Начало окна</dt>
              <dd className="tabular font-medium">{report.window!.from.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Конец окна</dt>
              <dd className="tabular font-medium">{report.window!.to.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">Фактическое покрытие</dt>
              <dd className="tabular font-medium">
                {present} из {periodMonths} мес
              </dd>
            </div>
            <div className="xl:col-span-2">
              <dt className="text-caption text-text-muted">Недостающие месяцы</dt>
              <dd className={cn('font-mono text-caption font-medium', report.missingMonths.length ? 'text-status-blocked' : 'text-status-completed')} data-testid="missing-months">
                {report.missingMonths.length ? report.missingMonths.join(', ') : 'нет'}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-4 text-caption text-text-secondary">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-xs border border-status-completed-border bg-status-completed-bg" />Полный месяц</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-xs border border-warning-border bg-warning-subtle" />Есть пропуски</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-xs border border-dashed border-status-blocked-border" />Нет данных</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-xs border border-dashed border-border-strong" />Задержка публикации (не входит в покрытие)</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-warning" />Дубли</span>
          </div>
        </>
      )}
    </section>
  );
}
