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
    <nav aria-label="Разделы объекта" className="-mx-1 mb-8 min-w-0">
      <ul className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-md border border-border bg-surface p-[3px] xl:flex xl:w-max xl:min-w-max">
        <li>
          <NavLink end to={ROUTES.object(objectId)} className={({ isActive }) => cn('flex min-h-8 min-w-0 items-center rounded-sm px-2 py-1 text-body-sm font-medium text-text-secondary hover:text-text-primary xl:h-8 xl:whitespace-nowrap xl:px-3 xl:py-0', isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground')}>
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
                  cn('flex min-h-8 min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-body-sm font-medium text-text-secondary transition-colors hover:text-text-primary xl:h-8 xl:whitespace-nowrap xl:px-3 xl:py-0', isActive && 'bg-primary text-primary-foreground hover:text-primary-foreground')
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
