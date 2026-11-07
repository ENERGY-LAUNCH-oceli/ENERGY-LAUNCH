import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip } from '@/components/ui/tooltip';
import { PRIMARY_NAV, sectionOwner, type NavItem } from '@/config/navigation';
import { DEFAULT_OBJECT_ID } from '@/data/objects';
import { useLaunchStore, useUi } from '@/store';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';
import { SidebarHelp } from './SidebarHelp';
import { StorageIndicator } from './StorageIndicator';
import { ThemeToggle } from './ThemeToggle';

/** Какой пункт активен: по разделу объекта, затем по префиксу пути. */
export function useActiveNavId(): string | undefined {
  const { pathname } = useLocation();
  const m = /^\/objects\/[^/]+(?:\/([^/]+))?/.exec(pathname);
  if (m) return m[1] ? sectionOwner(m[1]) : 'objects';
  return PRIMARY_NAV.find((n) => pathname.startsWith(n.to(DEFAULT_OBJECT_ID)))?.id;
}

function NavEntry({ item, collapsed, active, objectId, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; objectId: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to(objectId)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-2.5 rounded-sm text-body-sm text-text-secondary transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active && 'bg-accent-subtle font-medium text-accent-strong hover:bg-accent-subtle hover:text-accent-strong',
      )}
    >
      {active && <span aria-hidden className={cn('absolute inset-y-2 w-[3px] rounded-r-sm bg-accent', collapsed ? '-left-3' : '-left-3')} />}
      <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip side="right" content={<span><b>{item.label}</b> · {item.hint}</span>}>
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const active = useActiveNavId();
  const objectId = useLaunchStore((s) => s.currentObjectId) ?? DEFAULT_OBJECT_ID;
  const groups: [string, NavItem[]][] = [
    ['Портфель', PRIMARY_NAV.slice(0, 2)],
    ['Запуск объекта', PRIMARY_NAV.slice(2, 7)],
    ['Контроль', PRIMARY_NAV.slice(7, 10)],
    ['Система', PRIMARY_NAV.slice(10)],
  ];
  return (
    <nav aria-label="Основная навигация" className="flex flex-col gap-4">
      {groups.map(([title, items]) => (
        <div key={title} className="flex flex-col gap-px">
          {collapsed ? <span aria-hidden className="mx-auto mb-1.5 h-px w-5 bg-border" /> : <span className="px-2.5 pb-1.5 text-label text-text-muted">{title}</span>}
          {items.map((item) => (
            <NavEntry key={item.id} item={item} collapsed={collapsed} active={active === item.id} objectId={objectId} {...(onNavigate ? { onNavigate } : {})} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Боковая навигация: светлая поверхность с тонкой линией. Сворачивается до иконок; состояние запоминается. */
export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-base ease-brand lg:flex',
        collapsed ? 'w-[64px]' : 'w-60',
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Logo compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="border-t border-border px-3 pt-3">
        <SidebarHelp collapsed={collapsed} />
      </div>
      <div className={cn('px-3 pt-2', collapsed && 'flex justify-center')}>
        <StorageIndicator collapsed={collapsed} />
      </div>
      <div className={cn('flex gap-1 p-3 pt-1', collapsed ? 'flex-col items-center' : 'items-center')}>
        <ThemeToggle />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Развернуть навигацию' : 'Свернуть навигацию'}
          aria-keyshortcuts="Control+B"
          title={collapsed ? 'Развернуть (Ctrl B)' : undefined}
          className={cn(
            'flex h-9 items-center gap-2 rounded-sm text-caption text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary',
            collapsed ? 'w-9 justify-center' : 'flex-1 px-2.5',
          )}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && (
            <>
              Свернуть
              <kbd className="ml-auto font-mono text-[10px] text-text-muted">Ctrl B</kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
