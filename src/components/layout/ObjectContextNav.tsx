import { NavLink } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { StatusDot } from '@/components/ui/status-badge';
import { OBJECT_TABS } from '@/config/navigation';
import { useLaunchStore } from '@/store';
import { cn } from '@/utils/cn';

/** Контекстная навигация объекта: карточка запуска, четыре этапа со статусами, журнал. */
export function ObjectContextNav({ objectId }: { objectId: string }) {
  const session = useLaunchStore((s) => s.session);
  return (
    <nav aria-label="Разделы объекта" className="-mx-1 mb-8 overflow-x-auto [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 rounded-pill border border-border bg-surface p-1">
        <li>
          <NavLink end to={ROUTES.object(objectId)} className={({ isActive }) => cn('flex h-9 items-center rounded-pill px-4 text-body-sm font-semibold text-text-secondary hover:text-text-primary', isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground')}>
            Паспорт
          </NavLink>
        </li>
        {OBJECT_TABS.map((t) => {
          const status = t.stageId && session ? session.stages[t.stageId].status : undefined;
          return (
            <li key={t.section}>
              <NavLink
                to={ROUTES.objectSection(objectId, t.section)}
                className={({ isActive }) =>
                  cn('flex h-9 items-center gap-2 rounded-pill px-4 text-body-sm font-semibold text-text-secondary transition-colors hover:text-text-primary', isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground')
                }
              >
                {status && <StatusDot status={status} className="size-2" />}
                {t.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
