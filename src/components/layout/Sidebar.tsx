import { ChevronsLeft, Moon, Sun } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Tooltip } from '@/components/ui/tooltip';
import { PRIMARY_NAV, sectionOwner, type NavItem } from '@/config/navigation';
import { DEFAULT_OBJECT_ID } from '@/data/objects';
import { useLaunchStore, useUi } from '@/store';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';
import { SB_LABEL, SB_ROW, SB_ROW_SM } from './sidebar-styles';
import { SidebarHelp } from './SidebarHelp';
import { StorageIndicator } from './StorageIndicator';

/** Какой пункт активен: по разделу объекта, затем по префиксу пути. */
export function useActiveNavId(): string | undefined {
  const { pathname } = useLocation();
  const m = /^\/objects\/[^/]+(?:\/([^/]+))?/.exec(pathname);
  if (m) return m[1] ? sectionOwner(m[1]) : 'objects';
  return PRIMARY_NAV.find((n) => pathname.startsWith(n.to(DEFAULT_OBJECT_ID)))?.id;
}

function NavEntry({ item, collapsed, active, objectId, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; objectId: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Tooltip side="right" disabled={!collapsed} content={<span><b>{item.label}</b> · {item.hint}</span>}>
      <NavLink to={item.to(objectId)} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={collapsed ? item.label : undefined} className={cn(SB_ROW, active && 'bg-accent-subtle font-medium text-accent-strong hover:bg-accent-subtle hover:text-accent-strong')}>
        {active && <span aria-hidden className="absolute -left-3 inset-y-2 w-[3px] rounded-r-sm bg-accent" />}
        <Icon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
        <span className={SB_LABEL}>{item.label}</span>
      </NavLink>
    </Tooltip>
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
    <nav aria-label="Основная навигация" className="flex flex-col gap-3">
      {groups.map(([title, items]) => (
        <div key={title} className="flex flex-col gap-px">
          {/* Заголовок группы и разделитель – в одной строке одинаковой высоты: заголовок гаснет, линия проявляется */}
          <span className="relative flex h-[22px] items-start">
            <span className={cn('px-2.5 text-label text-text-muted', SB_LABEL)}>{title}</span>
            <span aria-hidden className="absolute left-2.5 top-2 h-px w-5 bg-border opacity-0 transition-opacity duration-200 group-data-[collapsed=true]/sb:opacity-100 group-data-[collapsed=true]/sb:delay-100" />
          </span>
          {items.map((item) => (
            <NavEntry key={item.id} item={item} collapsed={collapsed} active={active === item.id} objectId={objectId} {...(onNavigate ? { onNavigate } : {})} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Боковая навигация: светлая поверхность с тонкой линией. Сворачивается до иконок плавно; состояние запоминается. */
export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const themeLabel = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'group/sb sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none lg:flex',
        collapsed ? 'w-[64px]' : 'w-60',
      )}
    >
      <div className="flex h-14 shrink-0 items-center px-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 [scrollbar-width:thin]">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="border-t border-border px-3 pt-2.5">
        <SidebarHelp collapsed={collapsed} />
      </div>
      <div className="flex flex-col gap-px px-3 pb-2.5 pt-1">
        <StorageIndicator collapsed={collapsed} />
        <Tooltip side="right" disabled={!collapsed} content={themeLabel}>
          <button type="button" onClick={toggleTheme} aria-label={themeLabel} className={cn(SB_ROW, SB_ROW_SM)}>
            <ThemeIcon className="size-[17px] shrink-0" strokeWidth={1.75} aria-hidden />
            <span className={SB_LABEL}>{themeLabel}</span>
          </button>
        </Tooltip>
        <Tooltip side="right" disabled={!collapsed} content="Развернуть (Ctrl B)">
          <button type="button" onClick={toggle} aria-label={collapsed ? 'Развернуть навигацию' : 'Свернуть навигацию'} aria-keyshortcuts="Control+B" className={cn(SB_ROW, SB_ROW_SM)}>
            <ChevronsLeft className={cn('size-[17px] shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]', collapsed && 'rotate-180')} strokeWidth={1.75} aria-hidden />
            <span className={cn('flex flex-1 items-center', SB_LABEL)}>
              Свернуть
              <kbd className="ml-auto font-mono text-[10px] text-text-muted">Ctrl B</kbd>
            </span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
