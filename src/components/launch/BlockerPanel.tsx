import { ChevronDown, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/utils/cn';
import { BlockerCard, type BlockerCardProps } from './BlockerCard';

export interface BlockerPanelProps {
  items: (BlockerCardProps & { key?: string })[];
  className?: string;
  renderActions?: (blockerId: string) => React.ReactNode;
}

/** Препятствия этапа: открытые — сверху и полностью; устранённые — свёрнуты, но доступны. */
export function BlockerPanel({ items, renderActions, className }: BlockerPanelProps) {
  const [showClosed, setShowClosed] = React.useState(false);
  const open = items.filter((i) => i.blocker.status === 'OPEN');
  const closed = items.filter((i) => i.blocker.status !== 'OPEN');

  return (
    <section aria-label="Препятствия" className={cn('flex flex-col gap-4 rounded-lg border bg-surface p-5', open.length ? 'border-status-blocked-border' : 'border-border', className)}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-h3">Препятствия</h3>
          <span
            className={cn(
              'tabular inline-flex h-6 min-w-6 items-center justify-center rounded-pill px-2 text-caption font-bold',
              open.length ? 'bg-status-blocked-bg text-status-blocked' : 'bg-surface-sunken text-text-secondary',
            )}
          >
            {open.length}
          </span>
        </div>
      </header>

      {open.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md bg-status-completed-bg px-4 py-3 text-body-sm">
          <ShieldCheck className="size-5 text-status-completed" aria-hidden />
          <span className="font-semibold text-text-primary">Открытых препятствий нет</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {open.map(({ key, ...p }) => (
            <BlockerCard key={key ?? p.blocker.id} {...p} actions={p.actions ?? renderActions?.(p.blocker.id)} />
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            aria-expanded={showClosed}
            className="inline-flex items-center gap-1 self-start text-caption font-semibold text-text-secondary hover:text-text-primary"
          >
            <ChevronDown className={cn('size-4 transition-transform duration-fast', showClosed && 'rotate-180')} aria-hidden />
            Устранённые ({closed.length})
          </button>
          {showClosed && closed.map(({ key, ...p }) => <BlockerCard key={key ?? p.blocker.id} {...p} />)}
        </div>
      )}
    </section>
  );
}
