import { FileCheck2, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CheckStatusLabel } from '@/components/launch';
import { CHECK_DIMENSION_LABEL } from '@/config/labels';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import type { CheckView } from './model';

/** Проверки этапа: название, описание, обязательность, результат, источник, время, версия правила, подтверждение. */
export function ChecksList({ checks, source }: { checks: CheckView[]; source: string }) {
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface" aria-label="Проверки этапа">
      {checks.map(({ rule, status, result }) => {
        const bad = status === 'FAILED';
        return (
          <li key={rule.id} data-check={rule.id} data-check-status={status} className={cn('grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_200px]', bad && 'bg-error-subtle/40')}>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-caption font-semibold text-text-muted">{rule.id}</span>
                <span className="text-body-sm font-bold">{rule.title}</span>
                <Badge size="sm" tone={rule.blocking ? 'inverse' : 'neutral'}>
                  {rule.blocking ? 'Обязательная' : 'Рекомендуемая'}
                </Badge>
                <Badge size="sm">{CHECK_DIMENSION_LABEL[rule.dimension]}</Badge>
              </div>
              <p className="text-caption text-text-secondary">{rule.description}</p>
              {result && <p className={cn('text-body-sm', bad ? 'font-semibold text-error' : 'text-text-primary')}>{result.message}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-muted">
                <span>
                  Источник: <span className="font-mono text-text-secondary">{source}</span>
                </span>
                <span className="tabular">{result ? formatDateTime(result.evaluatedAt) : 'не выполнялась'}</span>
                <span>Правило v{result?.rulesetVersion ?? '—'}</span>
              </div>
            </div>
            <div className="flex flex-row items-start justify-between gap-2 lg:flex-col lg:items-end">
              <CheckStatusLabel status={status} className="text-body-sm" />
              <span className={cn('inline-flex items-center gap-1 text-caption', result ? 'text-text-secondary' : 'text-text-muted')}>
                {result ? <FileCheck2 className="size-3.5 text-accent-strong" aria-hidden /> : <FileQuestion className="size-3.5" aria-hidden />}
                {result ? 'Подтверждение сохранено' : 'Нет подтверждения'}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
