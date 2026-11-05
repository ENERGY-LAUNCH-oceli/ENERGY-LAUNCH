import { Building2, History, Palette, Rocket } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { cn } from '@/utils/cn';
import { Logo } from './Logo';

export const NAV = [
  { to: ROUTES.launch, label: 'Карточка запуска', icon: Rocket },
  { to: ROUTES.objects, label: 'Объекты', icon: Building2 },
  { to: ROUTES.audit, label: 'Журнал', icon: History },
] as const;

export const NAV_SECONDARY = [{ to: ROUTES.designSystem, label: 'Дизайн-система', icon: Palette }] as const;

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Rocket }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-body-sm font-medium text-white/70 transition-colors duration-fast hover:bg-white/5 hover:text-white',
          isActive && 'bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-pill before:bg-[#22AFBF]',
        )
      }
    >
      <Icon className="size-[18px]" aria-hidden />
      {label}
    </NavLink>
  );
}

/** Тёмно-синяя навигация (цвет подвала Oceli Energy) — рабочая область остаётся светлой. */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-surface-inverse lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo inverse />
      </div>
      <nav className="flex flex-1 flex-col gap-6 px-3 py-4" aria-label="Основная навигация">
        <div className="flex flex-col gap-1">
          <span className="px-3 pb-2 text-label uppercase text-[#22AFBF]">Запуск</span>
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-1">
          {NAV_SECONDARY.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
