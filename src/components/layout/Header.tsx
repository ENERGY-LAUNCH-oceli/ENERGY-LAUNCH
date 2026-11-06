import { Bell, BellOff, Check, CheckCheck, LogOut, Menu, Settings, UserRound, X } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STAGE_STATUS_LABEL } from '@/config/stages';
import { Tooltip } from '@/components/ui/tooltip';
import { lastCheckAt, sessionStatus } from '@/hooks/use-portfolio';
import { useLaunchStore, useNotifications, type NotificationTone } from '@/store';
import { ROLE_TITLE } from '@/engine';
import { DEMO_ROLES } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime, formatRelative } from '@/utils/format';
import { Breadcrumbs } from './Breadcrumbs';
import { Logo } from './Logo';
import { ObjectSwitcher } from './ObjectSwitcher';
import { SidebarNav } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';

function LaunchStatus() {
  const session = useLaunchStore((s) => s.session);
  const at = lastCheckAt(session);
  if (!session) return null;
  const status = sessionStatus(session);
  return (
    <Tooltip content={at ? `Последняя проверка: ${formatDateTime(at)}` : 'Проверки ещё не запускались'}>
      <span className="hidden items-center gap-1.5 whitespace-nowrap text-caption xl:inline-flex" tabIndex={0} data-status={status}>
        <span className={cn('font-medium', STATUS_TEXT[status])}>{STAGE_STATUS_LABEL[status]}</span>
        <span className="text-text-muted">· {at ? <span className="tabular">проверка {formatRelative(at)}</span> : 'нет проверок'}</span>
      </span>
    </Tooltip>
  );
}

const STATUS_TEXT = { NOT_STARTED: 'text-status-not-started', IN_PROGRESS: 'text-status-in-progress', BLOCKED: 'text-status-blocked', COMPLETED: 'text-status-completed' } as const;

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
            <span className="tabular absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-status-blocked-solid px-1 font-mono text-[10px] font-medium text-white">{unread > 9 ? '9+' : unread}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-body-sm font-medium">Уведомления</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={!unread}>
            <CheckCheck aria-hidden />
            Прочитать все
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <BellOff className="size-5 text-text-muted" aria-hidden />
            <span className="text-body-sm font-medium">Новых событий нет</span>
            <span className="text-caption text-text-muted">Здесь появятся блокировки, завершения этапов и отклонённые переходы.</span>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={cn('flex gap-3 px-4 py-3', !n.read && 'bg-surface-secondary')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', DOT[n.tone])} aria-hidden />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-sm font-medium">{n.title}</span>
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

const INITIALS = { LAUNCH_ENGINEER: 'ИЗ', OPERATOR: 'ОП', ACCEPTANCE_OFFICER: 'ПР' } as const;

function Profile() {
  const actor = useLaunchStore((s) => s.actor);
  const role = useLaunchStore((s) => s.role);
  const setRole = useLaunchStore((s) => s.setRole);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  return (
    <>
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Trigger asChild>
          <button type="button" aria-label={`Профиль: ${ROLE_TITLE[role]}`} data-role={role} className="flex items-center gap-2 rounded-md p-1 hover:bg-surface-hover lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-full border border-border bg-surface-sunken font-heading text-[11px] font-medium text-text-secondary">{INITIALS[role]}</span>
          </button>
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-xl border border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom lg:hidden">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" aria-hidden />
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-5">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-body-sm font-medium">{actor}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-caption leading-relaxed text-text-muted">
                  Демонстрационная роль: права проверяются в логике приложения
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Закрыть меню профиля" className="-mr-2 -mt-2 shrink-0">
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="border-b border-border px-3 py-2" aria-label="Выбор роли">
              {DEMO_ROLES.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setMobileOpen(false);
                  }}
                  data-role-option={r}
                  aria-current={r === role ? 'true' : undefined}
                  className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-body-sm text-text-primary hover:bg-surface-hover"
                >
                  {r === role ? <Check className="size-4 text-accent-strong" aria-hidden /> : <span className="size-4" aria-hidden />}
                  {ROLE_TITLE[r]}
                </button>
              ))}
            </div>
            <div className="border-b border-border px-3 py-2">
              <Link
                to={ROUTES.settings}
                onClick={() => setMobileOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-body-sm text-text-primary hover:bg-surface-hover"
              >
                <Settings className="size-4 text-text-muted" aria-hidden />
                Настройки
              </Link>
              <div aria-disabled="true" className="flex min-h-11 items-center gap-3 px-3 text-body-sm text-text-muted opacity-60">
                <UserRound className="size-4" aria-hidden />
                Профиль (в следующих фазах)
              </div>
            </div>
            <div className="px-3 py-2">
              <div aria-disabled="true" className="flex min-h-11 items-center gap-3 px-3 text-body-sm text-text-muted opacity-60">
                <LogOut className="size-4" aria-hidden />
                Выйти
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`Профиль: ${ROLE_TITLE[role]}`} data-role={role} className="hidden items-center gap-2 rounded-md p-1 hover:bg-surface-hover lg:flex">
            <span className="flex size-7 items-center justify-center rounded-full border border-border bg-surface-sunken font-heading text-[11px] font-medium text-text-secondary">{INITIALS[role]}</span>
            <span className="hidden flex-col text-left leading-tight 2xl:flex">
              <span className="text-caption font-medium">{actor}</span>
              <span className="text-[11px] text-text-muted">демо-роль</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="hidden lg:block">
          <DropdownMenuLabel>
            <span className="block text-body-sm font-medium">{actor}</span>
            <span className="text-caption text-text-muted">Демонстрационная роль: права проверяются в логике приложения</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DEMO_ROLES.map((r) => (
            <DropdownMenuItem key={r} onSelect={() => setRole(r)} data-role-option={r}>
              {r === role ? <Check /> : <span className="size-4" />}
              {ROLE_TITLE[r]}
            </DropdownMenuItem>
          ))}
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
    </>
  );
}

export function Header() {
  const [menu, setMenu] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        <Drawer
          open={menu}
          onOpenChange={setMenu}
          title="ENERGY LAUNCH"
          className="max-w-xs"
          trigger={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Открыть меню">
              <Menu />
            </Button>
          }
        >
          <SidebarNav onNavigate={() => setMenu(false)} />
        </Drawer>
        <Link to={ROUTES.overview} className="lg:hidden" aria-label="ENERGY LAUNCH – обзор">
          <Logo compact />
        </Link>
        <div className="hidden min-w-0 flex-1 md:block">
          <Breadcrumbs />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex min-w-0 items-center gap-1 rounded-lg border border-border bg-surface py-0.5 pl-0.5 pr-0.5 xl:pr-3">
            <ObjectSwitcher />
            <LaunchStatus />
          </div>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
          <ThemeToggle className="lg:hidden" />
          <Notifications />
          <Profile />
        </div>
      </div>
    </header>
  );
}
