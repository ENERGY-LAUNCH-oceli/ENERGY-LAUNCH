import { Bell, BellOff, CheckCheck, Clock, LogOut, Menu, Search, Settings, UserRound } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tooltip } from '@/components/ui/tooltip';
import { lastCheckAt, sessionStatus } from '@/hooks/use-portfolio';
import { useLaunchStore, useNotifications, useUi, type NotificationTone } from '@/store';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';
import { Breadcrumbs } from './Breadcrumbs';
import { Logo } from './Logo';
import { ObjectSwitcher } from './ObjectSwitcher';
import { SidebarNav } from './Sidebar';

function LaunchStatus() {
  const session = useLaunchStore((s) => s.session);
  const at = lastCheckAt(session);
  if (!session) return null;
  return (
    <div className="hidden items-center gap-3 xl:flex">
      <StatusBadge status={sessionStatus(session)} />
      <Tooltip content={at ? `Последняя проверка: ${formatDateTime(at)}` : 'Проверки ещё не запускались'}>
        <span className="inline-flex items-center gap-1.5 text-caption text-text-muted" tabIndex={0}>
          <Clock className="size-3.5" aria-hidden />
          {at ? <span className="tabular">{formatRelative(at)}</span> : 'нет проверок'}
        </span>
      </Tooltip>
    </div>
  );
}

const DOT: Record<NotificationTone, string> = { info: 'bg-info', success: 'bg-status-completed-solid', warning: 'bg-warning', error: 'bg-status-blocked-solid' };

function Notifications() {
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const unread = items.filter((i) => !i.read).length;
  return (
    <Popover onOpenChange={(o) => !o && markAllRead()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'} className="relative">
          <Bell />
          {unread > 0 && (
            <span className="tabular absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-status-blocked-solid px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-body-sm font-semibold">Уведомления</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unread}>
            <CheckCheck aria-hidden />
            Прочитать все
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <BellOff className="size-5 text-text-muted" aria-hidden />
            <span className="text-body-sm font-semibold">Новых событий нет</span>
            <span className="text-caption text-text-muted">Здесь появятся блокировки, завершения этапов и отклонённые переходы.</span>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={cn('flex gap-3 px-4 py-3', !n.read && 'bg-surface-secondary')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[n.tone])} aria-hidden />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-sm font-semibold">{n.title}</span>
                  {n.description && <span className="text-caption text-text-secondary">{n.description}</span>}
                  <span className="tabular text-[11px] text-text-muted">{formatRelative(n.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Profile() {
  const actor = useLaunchStore((s) => s.actor);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Профиль" className="flex items-center gap-2 rounded-pill p-0.5 pr-2 hover:bg-surface-sunken">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-caption font-bold text-primary-foreground">ИЗ</span>
          <span className="hidden flex-col text-left leading-tight 2xl:flex">
            <span className="text-caption font-semibold">{actor}</span>
            <span className="text-[11px] text-text-muted">Commissioning</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block text-body-sm font-semibold">{actor}</span>
          <span className="text-caption text-text-muted">Роль: COMMISSIONING_ENGINEER</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={ROUTES.settings}>
            <Settings />
            Настройки
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <UserRound />
          Профиль (в следующих фазах)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogOut />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const [menu, setMenu] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Drawer
          open={menu}
          onOpenChange={setMenu}
          title="ENERGY LAUNCH"
          className="max-w-xs bg-surface-inverse [&_h2]:text-white"
          trigger={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Открыть меню">
              <Menu />
            </Button>
          }
        >
          <SidebarNav onNavigate={() => setMenu(false)} />
        </Drawer>
        <Link to={ROUTES.overview} className="lg:hidden" aria-label="ENERGY LAUNCH — обзор">
          <Logo compact />
        </Link>
        <div className="hidden min-w-0 flex-1 md:block">
          <Breadcrumbs />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-keyshortcuts="Control+K"
            className="flex h-10 items-center gap-2 rounded-pill border border-border bg-surface-secondary px-3 text-body-sm text-text-muted transition-colors hover:border-border-strong md:w-56"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden md:inline">Поиск</span>
            <kbd className="ml-auto hidden rounded-xs border border-border bg-surface px-1.5 font-mono text-[10px] md:inline">Ctrl K</kbd>
          </button>
          <ObjectSwitcher />
          <LaunchStatus />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <Notifications />
          <Profile />
        </div>
      </div>
    </header>
  );
}
