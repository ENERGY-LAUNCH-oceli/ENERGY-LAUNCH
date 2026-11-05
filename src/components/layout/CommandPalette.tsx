import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Building2, CornerDownLeft, ShieldCheck, type LucideIcon } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { OBJECT_TABS, PRIMARY_NAV } from '@/config/navigation';
import { STAGE_META } from '@/config/stages';
import { DEFAULT_OBJECT_ID, OBJECT_CATALOG } from '@/data/objects';
import { RULE_CATALOG } from '@/engine';
import { useLaunchStore, useUi } from '@/store';
import { cn } from '@/utils/cn';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  to: string;
}

const SECTION_BY_STAGE = { METER_HISTORY: 'history', REALTIME_TELEMETRY: 'telemetry', ASSET_CONTROL: 'control', FINAL_DASHBOARDS: 'dashboards' } as const;

/** Глобальный поиск (Ctrl+K): разделы, объекты, этапы текущего объекта и правила проверок. */
export function CommandPalette() {
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const objectId = useLaunchStore((s) => s.currentObjectId) ?? DEFAULT_OBJECT_ID;
  const navigate = useNavigate();
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUi.getState().searchOpen);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        useUi.getState().toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const items = React.useMemo<Item[]>(() => {
    const all: Item[] = [
      ...PRIMARY_NAV.map((n) => ({ id: `nav-${n.id}`, group: 'Разделы', label: n.label, hint: n.hint, icon: n.icon, to: n.to(objectId) })),
      ...OBJECT_CATALOG.map((o) => ({ id: `obj-${o.id}`, group: 'Объекты', label: o.name, hint: `${o.code} · ${o.city} · ${o.assets}`, icon: Building2, to: ROUTES.objectSection(o.id, 'launch') })),
      ...OBJECT_TABS.map((t) => ({ id: `tab-${t.section}`, group: 'Текущий объект', label: t.label, ...(t.stageId ? { hint: STAGE_META[t.stageId].description } : {}), icon: t.icon, to: ROUTES.objectSection(objectId, t.section) })),
      ...Object.values(RULE_CATALOG).map((r) => ({ id: `rule-${r.id}`, group: 'Правила проверок', label: `${r.id} · ${r.title}`, hint: r.description, icon: ShieldCheck, to: ROUTES.objectSection(objectId, SECTION_BY_STAGE[r.stageId]) })),
    ];
    const t = q.trim().toLowerCase();
    return t ? all.filter((i) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(t)).slice(0, 30) : all.slice(0, 16);
  }, [q, objectId]);

  React.useEffect(() => {
    setActive(0);
  }, [q]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    navigate(item.to);
    setOpen(false);
    setQ('');
  };

  let lastGroup = '';
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">Глобальный поиск</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Разделы, объекты, этапы и правила проверок</DialogPrimitive.Description>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, items.length - 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              if (e.key === 'Enter') go(items[active]);
            }}
            placeholder="Объект, раздел, правило (например, MH-004)"
            aria-label="Поиск"
            className="h-14 w-full border-b border-border bg-transparent px-5 text-body outline-none placeholder:text-text-muted"
          />
          <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
            {items.map((item, i) => {
              const header = item.group !== lastGroup ? (lastGroup = item.group) : null;
              const Icon = item.icon;
              return (
                <React.Fragment key={item.id}>
                  {header && <li className="px-3 pb-1 pt-3 text-label uppercase text-text-muted">{header}</li>}
                  <li role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(item)}
                      className={cn('flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left', i === active && 'bg-surface-secondary')}
                    >
                      <Icon className={cn('size-4 shrink-0', i === active ? 'text-accent-strong' : 'text-text-muted')} aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-sm font-semibold">{item.label}</span>
                        {item.hint && <span className="truncate text-caption text-text-muted">{item.hint}</span>}
                      </span>
                      {i === active && <CornerDownLeft className="size-3.5 text-text-muted" aria-hidden />}
                    </button>
                  </li>
                </React.Fragment>
              );
            })}
            {items.length === 0 && <li className="px-3 py-8 text-center text-body-sm text-text-muted">Ничего не найдено по запросу «{q}»</li>}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
