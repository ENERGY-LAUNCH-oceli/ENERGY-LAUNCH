import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES, type ObjectSection } from '@/app/routes';
import { STAGE_META } from '@/config/stages';
import type { PortfolioRow } from '@/hooks/use-portfolio-rows';
import type { StageId } from '@/types';

const SECTION: Record<StageId, ObjectSection> = { METER_HISTORY: 'history', REALTIME_TELEMETRY: 'telemetry', ASSET_CONTROL: 'control', FINAL_DASHBOARDS: 'dashboards' };

/** «Требуют внимания»: заблокированные объекты, причина и конкретный следующий шаг. */
export function AttentionPanel({ rows }: { rows: PortfolioRow[] }) {
  const items = rows.filter((r) => r.status === 'BLOCKED').sort((a, b) => b.blockers.length - a.blockers.length);
  return (
    <section aria-labelledby="attention-title" className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-label uppercase text-accent-strong">Приоритет</span>
          <h2 id="attention-title" className="text-h3">
            Требуют внимания
          </h2>
        </div>
        <span className="tabular flex h-7 min-w-7 items-center justify-center rounded-pill bg-status-blocked-bg px-2 text-body-sm font-bold text-status-blocked">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-6 text-body-sm">
          <ShieldCheck className="size-5 text-status-completed" aria-hidden />
          Заблокированных объектов нет
        </div>
      ) : (
        <ul className="-mb-px grid md:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-1">
          {items.map((r) => {
            const b = r.blockers[0]!;
            return (
              <li key={r.entry.id} className="border-b border-border md:border-r min-[1800px]:border-r-0">
                <Link to={ROUTES.objectSection(r.entry.id, SECTION[b.stageId])} className="group flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-surface-secondary" data-testid={`attention-${r.entry.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body-sm font-bold">{r.entry.name}</span>
                      <span className="text-caption text-text-muted">
                        <span className="font-mono">{r.entry.code}</span> · {STAGE_META[b.stageId].titleRu}
                      </span>
                    </span>
                    <span className="tabular shrink-0 rounded-pill bg-status-blocked-bg px-2 py-0.5 text-caption font-bold text-status-blocked">
                      {r.blockers.length} {r.blockers.length === 1 ? 'препятствие' : r.blockers.length < 5 ? 'препятствия' : 'препятствий'}
                    </span>
                  </div>
                  <p className="text-caption text-text-secondary">
                    <span className="font-mono font-semibold text-text-primary">{b.ruleId ?? 'Ручное'}</span> · {b.description}
                  </p>
                  {r.nextAction && (
                    <p className="flex items-start gap-1.5 text-caption font-semibold text-accent-strong">
                      <ArrowRight className="mt-px size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      {r.nextAction.title}
                    </p>
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
