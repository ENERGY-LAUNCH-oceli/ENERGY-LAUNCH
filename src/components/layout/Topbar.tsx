import { Menu } from 'lucide-react';
import * as React from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useLaunchStore } from '@/store';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';
import { NAV, NAV_SECONDARY } from './Sidebar';

export function Topbar() {
  const ruleset = useLaunchStore((s) => s.ruleset);
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 backdrop-blur-sm md:px-8">
      <div className="flex items-center gap-3">
        <Drawer
          open={open}
          onOpenChange={setOpen}
          title="Навигация"
          className="max-w-xs"
          trigger={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Открыть меню">
              <Menu />
            </Button>
          }
        >
          <nav className="flex flex-col gap-1" aria-label="Мобильная навигация">
            {[...NAV, ...NAV_SECONDARY].map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn('flex items-center gap-3 rounded-sm px-3 py-2.5 text-body-sm font-medium', isActive ? 'bg-accent-subtle text-text-primary' : 'text-text-secondary')}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </Drawer>
        <Logo className="lg:hidden" />
        <span className="hidden text-body-sm text-text-secondary lg:inline">Сопровождение запуска энергетических объектов</span>
      </div>
      <Tooltip content={ruleset.provisional ? 'Пороговые значения ожидают сверки с ТЗ и паспортом OE-04' : 'Активный набор правил'}>
        <Badge tone={ruleset.provisional ? 'warning' : 'neutral'} className="cursor-default font-mono">
          Правила v{ruleset.version}
        </Badge>
      </Tooltip>
    </header>
  );
}
