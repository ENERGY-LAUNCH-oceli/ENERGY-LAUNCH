import { CloudOff, Gauge } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

export type DataQualityLevel = 'GOOD' | 'DEGRADED' | 'POOR' | 'UNAVAILABLE';

export interface DataQualityIndicatorProps {
  title?: string;
  /** Полнота, %. */
  completenessPct?: number;
  /** Минимальная полнота из конфигурации правил, %. */
  minCompletenessPct: number;
  /** Возраст последнего значения относительно точки проверки, минуты. */
  freshnessMinutes?: number;
  maxAgeMinutes?: number;
  gaps?: number;
  duplicates?: number;
  /** Нет связи с источником: показывается отдельно и не считается неисправностью актива. */
  unavailable?: boolean;
  lastSuccessAt?: string;
  period?: string;
  compact?: boolean;
  className?: string;
}

const LEVEL: Record<DataQualityLevel, { label: string; className: string }> = {
  GOOD: { label: 'Соответствует правилам', className: 'bg-status-completed-bg text-status-completed' },
  DEGRADED: { label: 'Есть замечания', className: 'bg-warning-subtle text-warning' },
  POOR: { label: 'Ниже порога', className: 'bg-status-blocked-bg text-status-blocked' },
  UNAVAILABLE: { label: 'Нет связи с источником', className: 'bg-surface-sunken text-text-secondary' },
};

/** Уровень качества вычисляется по тем же порогам, что и правила (значения передаются из конфигурации). */
export function getDataQualityLevel(p: Pick<DataQualityIndicatorProps, 'completenessPct' | 'minCompletenessPct' | 'freshnessMinutes' | 'maxAgeMinutes' | 'gaps' | 'duplicates' | 'unavailable'>): DataQualityLevel {
  if (p.unavailable || p.completenessPct === undefined) return 'UNAVAILABLE';
  const stale = p.maxAgeMinutes !== undefined && p.freshnessMinutes !== undefined && p.freshnessMinutes > p.maxAgeMinutes;
  if (p.completenessPct < p.minCompletenessPct || stale) return 'POOR';
  if ((p.gaps ?? 0) > 0 || (p.duplicates ?? 0) > 0) return 'DEGRADED';
  return 'GOOD';
}

/** Качество данных: полнота с отметкой порога, актуальность, пробелы и дубли. */
export function DataQualityIndicator(props: DataQualityIndicatorProps) {
  const { title = 'Качество данных', completenessPct, minCompletenessPct, freshnessMinutes, maxAgeMinutes, gaps, duplicates, lastSuccessAt, period, compact, className } = props;
  const level = getDataQualityLevel(props);
  const { label, className: chip } = LEVEL[level];
  const stale = maxAgeMinutes !== undefined && freshnessMinutes !== undefined && freshnessMinutes > maxAgeMinutes;

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold', chip, className)}>
        {level === 'UNAVAILABLE' ? <CloudOff className="size-3.5" aria-hidden /> : <Gauge className="size-3.5" aria-hidden />}
        {completenessPct !== undefined && level !== 'UNAVAILABLE' ? <span className="tabular">{completenessPct.toLocaleString('ru-RU')} %</span> : null}
        {label}
      </span>
    );
  }

  return (
    <section aria-label={title} className={cn('flex flex-col gap-4 rounded-lg border border-border bg-surface p-5', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-body font-semibold">{title}</h3>
          {period && <span className="text-caption text-text-muted">{period}</span>}
        </div>
        <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold', chip)}>
          {level === 'UNAVAILABLE' && <CloudOff className="size-3.5" aria-hidden />}
          {label}
        </span>
      </header>

      {level === 'UNAVAILABLE' ? (
        <p className="text-body-sm text-text-secondary">
          Данные не получены. Последняя успешная проверка:{' '}
          <span className="tabular font-semibold text-text-primary">{lastSuccessAt ? formatDateTime(lastSuccessAt) : 'не выполнялась'}</span>
        </p>
      ) : (
        <>
          <Progress
            value={completenessPct ?? 0}
            threshold={minCompletenessPct}
            tone={level === 'POOR' ? 'error' : level === 'DEGRADED' ? 'warning' : 'success'}
            label={`Полнота (порог ${minCompletenessPct} %)`}
            showValue
          />
          <dl className="grid grid-cols-3 gap-2 text-caption">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-text-muted">Возраст</dt>
              <dd className={cn('tabular text-numeric-sm', stale ? 'text-status-blocked' : 'text-text-primary')}>{freshnessMinutes !== undefined ? `${freshnessMinutes} мин` : '—'}</dd>
              {maxAgeMinutes !== undefined && <dd className="tabular text-text-muted">≤ {maxAgeMinutes} мин</dd>}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-text-muted">Пробелы</dt>
              <dd className={cn('tabular text-numeric-sm', (gaps ?? 0) > 0 ? 'text-warning' : 'text-text-primary')}>{gaps ?? '—'}</dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-text-muted">Дубли</dt>
              <dd className={cn('tabular text-numeric-sm', (duplicates ?? 0) > 0 ? 'text-warning' : 'text-text-primary')}>{duplicates ?? '—'}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
