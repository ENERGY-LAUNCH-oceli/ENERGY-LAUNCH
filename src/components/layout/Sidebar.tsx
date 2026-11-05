import { Building2, History, Rocket, Zap } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { env } from '@/config/env';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';

const NAV = [
  { to: ROUTES.objects, label: 'Объекты', icon: Building2 },
  { to: ROUTES.launch, label: 'Запуск', icon: Rocket },
  { to: ROUTES.audit, label: 'Журнал аудита', icon: History },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold">
        <Zap className="size-5 text-yellow-500" aria-hidden />
        {env.appName}
      </div>
      <nav className="flex flex-col gap-1 p-3" aria-label="Основная навигация">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground', isActive && 'bg-accent font-medium text-foreground')
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
