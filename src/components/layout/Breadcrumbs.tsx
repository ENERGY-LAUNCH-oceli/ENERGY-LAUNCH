import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { OBJECT_TABS } from '@/config/navigation';
import { findObject } from '@/data/objects';
import { useUi } from '@/store';

interface Crumb {
  label: string;
  to?: string;
}

const STATIC: Record<string, string> = { overview: 'Центр запуска', objects: 'Объекты', settings: 'Настройки', 'design-system': 'Дизайн-система' };

export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const overviewSearch = useUi((s) => s.overviewSearch);
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  if (parts[0] === 'objects') {
    if (parts[1]) crumbs.push({ label: 'Центр запуска', to: `${ROUTES.overview}${overviewSearch}` });
    crumbs.push({ label: 'Объекты', to: ROUTES.objects });
    const id = parts[1] ? decodeURIComponent(parts[1]) : undefined;
    if (id) {
      crumbs.push({ label: findObject(id)?.name ?? id, to: ROUTES.object(id) });
      const tab = OBJECT_TABS.find((t) => t.section === parts[2]);
      if (tab) crumbs.push({ label: tab.label });
      else crumbs.push({ label: 'Паспорт' });
    }
  } else if (parts[0] && STATIC[parts[0]]) {
    crumbs.push({ label: STATIC[parts[0]]! });
  }
  if (crumbs.length) delete crumbs[crumbs.length - 1]!.to;
  return crumbs;
}

export function Breadcrumbs() {
  const crumbs = useBreadcrumbs();
  return (
    <nav aria-label="Навигационная цепочка" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body-sm">
        {crumbs.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-text-muted" aria-hidden />}
            {c.to ? (
              <Link to={c.to} className="truncate text-text-secondary transition-colors hover:text-text-primary">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-text-primary">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
