import { Check, ChevronsUpDown, Search } from 'lucide-react';
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
          className="group flex h-9 min-w-0 items-center gap-2.5 rounded-md px-2.5 text-left transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover"
        >
          <StatusDot status={(currentId && statuses[currentId]) || 'NOT_STARTED'} />
          <span className="hidden min-w-0 items-baseline gap-2 min-[380px]:flex">
            <span className="max-w-28 truncate text-body-sm font-medium sm:max-w-44">{current?.name ?? 'Выберите объект'}</span>
            {current && <span className="hidden max-w-32 truncate text-caption text-text-muted 2xl:inline">{current.city}</span>}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-text-muted transition-colors group-hover:text-text-secondary" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0">
        <div className="p-2">
          <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/15">
            <Search className="size-4 text-text-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Найти объект"
              aria-label="Поиск объекта"
              className="h-full min-w-0 flex-1 bg-transparent text-body-sm outline-none placeholder:text-text-muted focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={(e) => e.key === 'Enter' && list[0] && choose(list[0].id)}
            />
          </div>
        </div>
        <ul role="listbox" aria-label="Объекты" className="max-h-[min(55vh,22rem)] overflow-y-auto overscroll-contain border-t border-border p-1.5">
          {list.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === currentId}>
              <button
                type="button"
                onClick={() => choose(o.id)}
                className={cn('flex min-h-12 w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-secondary', o.id === currentId && 'bg-surface-secondary')}
              >
                <StatusDot status={statuses[o.id] ?? 'NOT_STARTED'} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body-sm font-medium">{o.name}</span>
                  <span className="truncate text-caption text-text-muted">
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
