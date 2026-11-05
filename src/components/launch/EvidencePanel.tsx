import { FolderOpen, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/utils/cn';
import { EvidenceCard, type EvidenceView } from './EvidenceCard';

export interface EvidencePanelProps {
  items: EvidenceView[];
  /** Обязательные подтверждения этапа: получено / требуется. */
  confirmations?: { received: number; required: number };
  onAdd?: () => void;
  onOpen?: (id: string) => void;
  className?: string;
}

/** Подтверждающие материалы этапа. Неактуальные материалы показываются отдельно, история не теряется. */
export function EvidencePanel({ items, confirmations, onAdd, onOpen, className }: EvidencePanelProps) {
  const current = items.filter((e) => !e.stale);
  const stale = items.filter((e) => e.stale);
  return (
    <section aria-label="Подтверждающие материалы" className={cn('flex flex-col gap-4 rounded-lg border border-border bg-surface p-5', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-h3">Подтверждения</h3>
          <span className="text-caption text-text-muted">
            Материалов: <span className="tabular">{current.length}</span>
            {stale.length > 0 && (
              <>
                {' '}
                · неактуальных: <span className="tabular">{stale.length}</span>
              </>
            )}
          </span>
        </div>
        {onAdd && (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus aria-hidden />
            Добавить
          </Button>
        )}
      </header>
      {confirmations && (
        <Progress
          value={confirmations.received}
          max={Math.max(confirmations.required, 1)}
          tone={confirmations.received >= confirmations.required ? 'success' : 'accent'}
          size="sm"
          label={`Обязательные подтверждения: ${confirmations.received} из ${confirmations.required}`}
        />
      )}
      {items.length === 0 ? (
        <EmptyState compact icon={<FolderOpen aria-hidden />} title="Материалов пока нет" description="Отчёты проверок, акты и журналы команд появятся здесь." />
      ) : (
        <div className="flex flex-col gap-2">
          {current.map((e) => (
            <EvidenceCard key={e.id} evidence={e} {...(onOpen ? { onOpen: () => onOpen(e.id) } : {})} />
          ))}
          {stale.length > 0 && (
            <>
              <span className="mt-2 text-label uppercase text-text-muted">Требуют перепроверки</span>
              {stale.map((e) => (
                <EvidenceCard key={e.id} evidence={e} {...(onOpen ? { onOpen: () => onOpen(e.id) } : {})} />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}
