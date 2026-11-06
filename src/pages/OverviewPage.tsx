import { RotateCcw, Search } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col gap-1 px-5 py-4 first:pl-0">
      <span className="text-caption font-semibold text-text-secondary">{label}</span>
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

/** Launch Control Center — главный экран инженера запуска. */
export function OverviewPage() {
  const rows = usePortfolioRows();
  const initPortfolio = useLaunchStore((s) => s.initPortfolio);
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
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <span className="text-label uppercase text-accent-strong">Launch Control Center</span>
          <h1 className="text-h1 text-balance">Запуск энергетических объектов</h1>
          <p className="text-body-lg text-text-secondary">Контроль данных, проверок и готовности объектов к эксплуатации</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => initPortfolio(true)} title="Вернуть демо-портфель в исходное состояние">
          <RotateCcw aria-hidden />
          Сбросить демо
        </Button>
      </header>

      <div className="grid grid-cols-2 divide-border rounded-lg border border-border bg-surface px-5 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        <Stat label="Объектов" value={rows.length} />
        <Stat label="Полностью готовы" value={count('COMPLETED')} tone="COMPLETED" />
        <Stat label="В работе" value={count('IN_PROGRESS')} tone="IN_PROGRESS" />
        <Stat label="Заблокированы" value={count('BLOCKED')} tone="BLOCKED" />
        <Stat label="Ожидают проверки" value={rows.filter((r) => r.awaitingCheck).length} tone="awaiting" />
      </div>

      <div className="grid gap-6 min-[1800px]:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Объекты" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Фильтр по статусу" className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface p-1">
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
                    className={cn('flex h-8 items-center gap-2 rounded-pill px-3.5 text-body-sm font-semibold text-text-secondary transition-colors hover:text-text-primary', active && 'bg-primary text-primary-foreground hover:text-primary-foreground')}
                  >
                    {f.label}
                    <span className={cn('tabular text-caption', active ? 'text-white/70' : 'text-text-muted')}>{n}</span>
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
            <div className="flex flex-col gap-2">
              <ObjectRowHeader />
              <ul className="flex flex-col gap-2">
                {visible.map((r) => (
                  <ObjectRow key={r.entry.id} row={r} search={search} />
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="order-first min-[1800px]:order-none min-[1800px]:sticky min-[1800px]:top-24 min-[1800px]:self-start">
          <AttentionPanel rows={rows} />
        </aside>
      </div>
    </div>
  );
}
