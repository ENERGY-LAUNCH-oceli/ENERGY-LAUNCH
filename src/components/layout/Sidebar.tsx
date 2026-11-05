import { ChevronsLeft, ChevronsRight, Palette } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Tooltip } from '@/components/ui/tooltip';
import { PRIMARY_NAV, sectionOwner, type NavItem } from '@/config/navigation';
import { DEFAULT_OBJECT_ID } from '@/data/objects';
import { useLaunchStore, useUi } from '@/store';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';

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
        'group relative flex h-10 items-center gap-3 rounded-sm text-body-sm font-medium text-white/65 transition-colors duration-fast hover:bg-white/[0.06] hover:text-white',
        collapsed ? 'justify-center px-0' : 'px-3',
        active && 'bg-white/10 font-semibold text-white',
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-pill bg-[#22AFBF]" />}
      <Icon className={cn('size-[18px] shrink-0', active ? 'text-[#22AFBF]' : 'text-white/55 group-hover:text-white')} aria-hidden />
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
    ['Система', PRIMARY_NAV.slice(7)],
  ];
  return (
    <nav aria-label="Основная навигация" className="flex flex-col gap-5">
      {groups.map(([title, items]) => (
        <div key={title} className="flex flex-col gap-0.5">
          {collapsed ? <span aria-hidden className="mx-auto mb-2 h-px w-6 bg-white/15" /> : <span className="px-3 pb-2 text-label uppercase text-[#22AFBF]/90">{title}</span>}
          {items.map((item) => (
            <NavEntry key={item.id} item={item} collapsed={collapsed} active={active === item.id} objectId={objectId} {...(onNavigate ? { onNavigate } : {})} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Тёмно-синяя навигация (цвет подвала Oceli). Сворачивается до иконок; состояние запоминается. */
export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <aside
      data-collapsed={collapsed}
      className={cn('sticky top-0 hidden h-screen shrink-0 flex-col bg-surface-inverse transition-[width] duration-base ease-brand lg:flex', collapsed ? 'w-[72px]' : 'w-64')}
    >
      <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Logo inverse compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="flex flex-col gap-0.5 border-t border-white/10 p-3">
        <NavLink
          to={ROUTES.designSystem}
          title={collapsed ? 'Дизайн-система' : undefined}
          className={({ isActive }) => cn('flex h-9 items-center gap-3 rounded-sm text-caption font-medium text-white/50 hover:bg-white/[0.06] hover:text-white', collapsed ? 'justify-center' : 'px-3', isActive && 'text-white')}
        >
          <Palette className="size-4" aria-hidden />
          {collapsed ? <span className="sr-only">Дизайн-система</span> : 'Дизайн-система'}
        </NavLink>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Развернуть навигацию' : 'Свернуть навигацию'}
          aria-keyshortcuts="Control+B"
          className={cn('flex h-9 items-center gap-3 rounded-sm text-caption font-medium text-white/50 hover:bg-white/[0.06] hover:text-white', collapsed ? 'justify-center' : 'px-3')}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && (
            <>
              Свернуть
              <kbd className="ml-auto font-mono text-[10px] text-white/35">Ctrl B</kbd>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
