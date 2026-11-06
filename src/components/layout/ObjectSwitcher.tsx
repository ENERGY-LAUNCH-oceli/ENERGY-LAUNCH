import { Building2, Check, ChevronsUpDown, Search } from 'lucide-react';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, type ObjectSection } from '@/app/routes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusDot } from '@/components/ui/status-badge';
import { OBJECT_CATALOG } from '@/data/objects';
import { useObjectStatuses } from '@/hooks/use-portfolio';
import { useLaunchStore } from '@/store';
import { cn } from '@/utils/cn';

/** Выбор текущего объекта: поиск по названию, коду и городу; сохраняет текущий раздел. */
export function ObjectSwitcher() {
  const currentId = useLaunchStore((s) => s.currentObjectId);
  const statuses = useObjectStatuses();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const current = OBJECT_CATALOG.find((o) => o.id === currentId);
  const list = OBJECT_CATALOG.filter((o) => `${o.name} ${o.code} ${o.city} ${o.assets}`.toLowerCase().includes(q.trim().toLowerCase()));

  const choose = (id: string) => {
    const section = /^\/objects\/[^/]+\/([^/]+)/.exec(pathname)?.[1] as ObjectSection | undefined;
    navigate(section ? ROUTES.objectSection(id, section) : pathname.startsWith('/objects/') ? ROUTES.object(id) : ROUTES.objectSection(id, 'launch'));
    setOpen(false);
    setQ('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Текущий объект"
          className="flex h-10 min-w-0 items-center gap-2.5 rounded-pill border border-border bg-surface pl-1.5 pr-1.5 text-left sm:pr-3 transition-colors hover:border-border-strong"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent-strong">
            <Building2 className="size-3.5" aria-hidden />
          </span>
          <span className="hidden min-w-0 max-w-48 flex-col leading-tight sm:flex">
            <span className="truncate text-body-sm font-semibold">{current?.name ?? 'Выберите объект'}</span>
            {current && <span className="truncate text-[11px] text-text-muted">{current.city} · {current.assets}</span>}
          </span>
          <ChevronsUpDown className="ml-1 hidden size-4 sm:block shrink-0 text-text-muted" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-text-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Найти объект"
            aria-label="Поиск объекта"
            className="h-11 w-full bg-transparent text-body-sm outline-none placeholder:text-text-muted"
            onKeyDown={(e) => e.key === 'Enter' && list[0] && choose(list[0].id)}
          />
        </div>
        <ul role="listbox" aria-label="Объекты" className="max-h-80 overflow-y-auto p-1">
          {list.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === currentId}>
              <button
                type="button"
                onClick={() => choose(o.id)}
                className={cn('flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-surface-secondary', o.id === currentId && 'bg-surface-secondary')}
              >
                <StatusDot status={statuses[o.id] ?? 'NOT_STARTED'} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-sm font-semibold">{o.name}</span>
                  <span className="text-caption text-text-muted">
                    <span className="font-mono">{o.code}</span> · {o.city} · {o.assets}
                  </span>
                </span>
                {o.id === currentId && <Check className="size-4 text-accent-strong" aria-hidden />}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-6 text-center text-caption text-text-muted">Ничего не найдено</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
