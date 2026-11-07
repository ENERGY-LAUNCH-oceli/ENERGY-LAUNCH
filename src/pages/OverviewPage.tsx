import { RotateCcw, Search } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { UploadFilesButton } from '@/features/drop/DropHost';
import { Input } from '@/components/ui/input';
import { AttentionPanel, ObjectRow, ObjectRowHeader } from '@/features/control-center';
import { usePortfolioRows, type PortfolioRow } from '@/hooks/use-portfolio-rows';
import { useLaunchStore, useUi } from '@/store';
import { useEffect } from 'react';
import type { StageStatus } from '@/types';
import { cn } from '@/utils/cn';

type Filter = 'all' | 'in-progress' | 'blocked' | 'completed' | 'not-started';

const FILTERS: { id: Filter; label: string; match: (r: PortfolioRow) => boolean }[] = [
  { id: 'all', label: 'Все объекты', match: () => true },
  { id: 'in-progress', label: 'В работе', match: (r) => r.status === 'IN_PROGRESS' },
  { id: 'blocked', label: 'Заблокированные', match: (r) => r.status === 'BLOCKED' },
  { id: 'completed', label: 'Завершённые', match: (r) => r.status === 'COMPLETED' },
  { id: 'not-started', label: 'Не начатые', match: (r) => r.status === 'NOT_STARTED' },
];

function Stat({ label, value, tone }: { label: string; value: number; tone?: StageStatus | 'awaiting' }) {
  return (
    <div className="flex flex-col gap-2 bg-surface px-[18px] py-4">
      <span className="text-caption text-text-muted">{label}</span>
      <span
        className={cn(
          'tabular text-numeric',
          tone === 'COMPLETED' && 'text-status-completed',
          tone === 'BLOCKED' && value > 0 && 'text-status-blocked',
          tone === 'IN_PROGRESS' && 'text-status-in-progress',
          tone === 'awaiting' && value > 0 && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Launch Control Center – главный экран инженера запуска. */
export function OverviewPage() {
  const rows = usePortfolioRows();
  const resetPortfolio = useLaunchStore((s) => s.resetPortfolio);
  const dataSource = useLaunchStore((s) => s.dataSource);
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const filter = (params.get('status') as Filter | null) ?? 'all';
  const q = params.get('q') ?? '';
  const setOverviewSearch = useUi((s) => s.setOverviewSearch);
  useEffect(() => {
    setOverviewSearch(search);
  }, [search, setOverviewSearch]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const needle = q.trim().toLowerCase();
  const visible = rows.filter((r) => (FILTERS.find((f) => f.id === filter) ?? FILTERS[0]!).match(r) && (!needle || `${r.entry.name} ${r.entry.code}`.toLowerCase().includes(needle)));
  const count = (s: StageStatus) => rows.filter((r) => r.status === s).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl flex-col gap-1.5">
          <h1 className="text-h1 text-balance">Запуск энергетических объектов</h1>
          <p className="text-body text-text-muted">Контроль данных, проверок и готовности объектов к эксплуатации</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <UploadFilesButton size="sm" />
        <Button variant="ghost" size="sm" onClick={() => void resetPortfolio()} title={dataSource === 'CASE4' ? 'Вернуть объекты набора в исходное состояние (проверки этапа 1 по файлам набора)' : 'Вернуть демо-портфель в исходное состояние'}>
          <RotateCcw aria-hidden />
          {dataSource === 'CASE4' ? 'Сбросить состояние' : 'Сбросить демо'}
        </Button>
        </div>
      </header>

      <div data-tour="overview-stats" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
        <Stat label="Объектов" value={rows.length} />
        <Stat label="Полностью готовы" value={rows.filter((r) => r.ready).length} tone="COMPLETED" />
        <Stat label="В работе" value={count('IN_PROGRESS')} tone="IN_PROGRESS" />
        <Stat label="Заблокированы" value={count('BLOCKED')} tone="BLOCKED" />
        <Stat label="Ожидают проверки" value={rows.filter((r) => r.awaitingCheck).length} tone="awaiting" />
      </div>

      <AttentionPanel rows={rows} />

      <section aria-label="Объекты" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Фильтр по статусу" className="flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-border bg-surface p-[3px] [scrollbar-width:none]">
              {FILTERS.map((f) => {
                const n = rows.filter(f.match).length;
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => update('status', f.id)}
                    className={cn('flex h-8 shrink-0 items-center gap-2 rounded-sm px-3 text-body-sm text-text-muted transition-colors hover:text-text-primary', active && 'bg-primary font-medium text-primary-foreground hover:text-primary-foreground')}
                  >
                    {f.label}
                    <span className={cn('tabular font-mono text-[11px]', active ? 'opacity-70' : 'text-text-muted')}>{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="w-full sm:w-72">
              <Input leading={<Search />} placeholder="Название или ID" aria-label="Поиск объекта по названию или ID" value={q} onChange={(e) => update('q', e.target.value)} />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState compact title="Объекты не найдены" description="Измените фильтр или строку поиска." action={<Button size="sm" variant="secondary" onClick={() => setParams({}, { replace: true })}>Сбросить фильтры</Button>} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <ObjectRowHeader />
              <ul>
                {visible.map((r) => (
                  <ObjectRow key={r.entry.id} row={r} search={search} />
                ))}
              </ul>
            </div>
          )}
      </section>
    </div>
  );
}
