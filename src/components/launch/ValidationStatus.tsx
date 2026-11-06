import { CHECK_DIMENSION_LABEL } from '@/config/labels';
import { CHECK_DIMENSIONS, type CheckDimension } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import type { ValidationResultView } from './ValidationResultItem';
import { CheckStatusLabel } from './check-status';

export interface ValidationStatusProps {
  results: Pick<ValidationResultView, 'status' | 'dimension' | 'blocking'>[];
  lastCheckedAt?: string;
  rulesetVersion?: string;
  /** Источник недоступен: результат не становится успешным (ТЗ, сценарий 6). */
  unavailable?: boolean;
  className?: string;
}

type Summary = 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED' | 'UNAVAILABLE' | 'STALE' | 'NOT_APPLICABLE';

function summarize(items: ValidationStatusProps['results'], unavailable?: boolean): Summary {
  if (unavailable) return 'UNAVAILABLE';
  if (items.length > 0 && items.every((r) => r.status === 'NOT_APPLICABLE')) return 'NOT_APPLICABLE';
  const relevant = items.filter((r) => r.status !== 'NOT_APPLICABLE');
  if (relevant.length === 0) return 'SKIPPED';
  if (relevant.some((r) => r.status === 'FAILED')) return 'FAILED';
  if (relevant.some((r) => r.status === 'UNAVAILABLE')) return 'UNAVAILABLE';
  // Неактуальность и отсутствие данных – не успех
  if (relevant.some((r) => r.status === 'STALE')) return 'STALE';
  if (relevant.some((r) => r.status === 'SKIPPED' || r.status === 'PENDING')) return 'SKIPPED';
  if (relevant.some((r) => r.status === 'WARNING')) return 'WARNING';
  return 'PASSED';
}

/**
 * Сводный результат проверок этапа. Наличие данных, качество и функция показаны
 * раздельно (ТЗ 2.2.3): успех одного измерения не маскирует провал другого.
 */
export function ValidationStatus({ results, lastCheckedAt, rulesetVersion, unavailable, className }: ValidationStatusProps) {
  const overall = summarize(results, unavailable);
  const byDim = (d: CheckDimension) => results.filter((r) => r.dimension === d);
  return (
    <section aria-label="Результат проверок" className={cn('rounded-lg border border-border bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-body-sm font-medium">Результат проверок</span>
          <CheckStatusLabel status={overall} />
        </div>
        <span className="text-caption text-text-muted">
          {lastCheckedAt ? <span className="tabular">{formatDateTime(lastCheckedAt)}</span> : 'Проверки не запускались'}
          {rulesetVersion && <> · правила v{rulesetVersion}</>}
        </span>
      </div>
      <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {CHECK_DIMENSIONS.map((d) => {
          const items = byDim(d);
          const passed = items.filter((r) => r.status === 'PASSED').length;
          const applicable = items.filter((r) => r.status !== 'NOT_APPLICABLE').length;
          const s = items.length ? summarize(items, unavailable) : null;
          return (
            <div key={d} className="flex flex-col gap-1.5 px-5 py-4">
              <span className="text-label text-text-muted">{CHECK_DIMENSION_LABEL[d]}</span>
              {s ? (
                <>
                  <CheckStatusLabel status={s} />
                  <span className="tabular text-caption text-text-muted">
                    {applicable ? `${passed} из ${applicable} пройдено` : 'Проверка не применима'}
                  </span>
                </>
              ) : (
                <span className="text-caption text-text-muted">Нет проверок</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
