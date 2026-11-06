import { ArrowRight, Building2, CircleCheck, OctagonAlert, Rocket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { PageHeader, SectionHeader } from '@/components/common/PageHeader';
import { Kpi } from '@/components/ui/kpi';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META } from '@/config/stages';
import { OBJECT_CATALOG } from '@/data/objects';
import { sessionStatus, usePortfolioSessions } from '@/hooks/use-portfolio';
import { STAGE_IDS, type StageStatus } from '@/types';
import { cn } from '@/utils/cn';

const SEG: Record<StageStatus, string> = {
  NOT_STARTED: 'bg-surface-sunken',
  IN_PROGRESS: 'bg-status-in-progress-solid',
  BLOCKED: 'bg-status-blocked-solid',
  COMPLETED: 'bg-status-completed-solid',
};

export function OverviewPage() {
  const sessions = usePortfolioSessions();
  const statuses = OBJECT_CATALOG.map((o) => sessionStatus(sessions[o.id]));
  const count = (s: StageStatus) => statuses.filter((x) => x === s).length;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Обзор" title="Портфель запусков" description="Шесть объектов в разных состояниях запуска. Готовность объявляется только после завершения всех четырёх этапов." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Объектов в портфеле" value={OBJECT_CATALOG.length} icon={<Building2 />} />
        <Kpi label="В работе" value={count('IN_PROGRESS')} icon={<Rocket />} />
        <Kpi label="Заблокировано" value={count('BLOCKED')} tone={count('BLOCKED') ? 'error' : 'default'} icon={<OctagonAlert />} />
        <Kpi label="Готовы к эксплуатации" value={count('COMPLETED')} tone="success" icon={<CircleCheck />} />
      </div>
      <section>
        <SectionHeader eyebrow="Объекты" title="Состояние запусков" description="Объекты, которые ещё не открывались в этой сессии, показаны как «Не начат»." />
        <ul className="grid gap-3 lg:grid-cols-2">
          {OBJECT_CATALOG.map((o, i) => {
            const s = sessions[o.id];
            return (
              <li key={o.id}>
                <Link
                  to={ROUTES.objectSection(o.id, 'launch')}
                  className={cn('group flex flex-col gap-4 rounded-lg border bg-surface p-5 transition-colors hover:border-border-strong', statuses[i] === 'BLOCKED' ? 'border-status-blocked-border' : 'border-border')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-h3">{o.name}</span>
                      <span className="text-caption text-text-muted">
                        <span className="font-mono">{o.code}</span> · {o.city} · {o.assets}
                      </span>
                    </div>
                    <StatusBadge status={statuses[i]!} />
                  </div>
                  <div className="flex gap-1.5" role="img" aria-label="Этапы запуска">
                    {STAGE_IDS.map((id) => (
                      <span key={id} title={STAGE_META[id].titleRu} className={cn('h-1.5 flex-1 rounded-pill', SEG[s?.stages[id].status ?? 'NOT_STARTED'])} />
                    ))}
                  </div>
                  <span className="flex items-center justify-between text-caption text-text-secondary">
                    <span>
                      Текущий этап: <b className="text-text-primary">{STAGE_META[s?.currentStageId ?? 'METER_HISTORY'].titleRu}</b>
                    </span>
                    <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-strong" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
