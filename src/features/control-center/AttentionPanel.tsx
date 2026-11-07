import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES, type ObjectSection } from '@/app/routes';
import { STAGE_META } from '@/config/stages';
import type { PortfolioRow } from '@/hooks/use-portfolio-rows';
import { blockerHref } from '@/config/blocker-links';
import type { StageId } from '@/types';

const SECTION: Record<StageId, ObjectSection> = { METER_HISTORY: 'history', REALTIME_TELEMETRY: 'telemetry', ASSET_CONTROL: 'control', FINAL_DASHBOARDS: 'dashboards' };

const plural = (n: number) => (n === 1 ? 'препятствие' : n < 5 ? 'препятствия' : 'препятствий');

/** «Требуют внимания»: заблокированные объекты, причина и конкретный следующий шаг – по строке на объект. */
export function AttentionPanel({ rows }: { rows: PortfolioRow[] }) {
  const items = rows.filter((r) => r.status === 'BLOCKED').sort((a, b) => b.blockers.length - a.blockers.length);
  return (
    <section aria-labelledby="attention-title" data-tour="attention" className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="attention-title" className="text-h3">
          Требуют внимания
        </h2>
        <span className="font-mono text-caption text-text-muted">
          <span className="tabular text-status-blocked">{items.length}</span> заблокировано
        </span>
      </header>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5 text-body-sm text-text-secondary">
          <ShieldCheck className="size-4 text-status-completed" aria-hidden />
          Заблокированных объектов нет
        </div>
      ) : (
        <ul>
          {items.map((r) => {
            const b = r.blockers[0]!;
            return (
              <li key={r.entry.id} className="border-b border-border last:border-b-0">
                <Link
                  to={blockerHref(r.entry.id, b.ruleId, b.stageId) ?? ROUTES.objectSection(r.entry.id, SECTION[b.stageId])}
                  data-testid={`attention-${r.entry.id}`}
                  className="group grid gap-x-6 gap-y-1 px-5 py-3 transition-colors duration-fast hover:bg-surface-hover md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)_minmax(0,1.2fr)] md:items-center"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm font-medium">{r.entry.name}</span>
                    <span className="text-caption text-text-muted">
                      {STAGE_META[b.stageId].titleRu} ·{' '}
                      <span className="tabular text-status-blocked">
                        {r.blockers.length} {plural(r.blockers.length)}
                      </span>
                    </span>
                  </span>
                  <span className="line-clamp-2 text-caption text-text-secondary">
                    <span className="font-mono text-text-primary">{b.ruleId ?? 'Ручное'}</span> · {b.description}
                  </span>
                  {r.nextAction && (
                    <span className="flex items-start gap-1.5 text-caption text-accent-strong">
                      <ArrowRight className="mt-px size-3.5 shrink-0 transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden />
                      <span className="line-clamp-2">{r.nextAction.title}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
