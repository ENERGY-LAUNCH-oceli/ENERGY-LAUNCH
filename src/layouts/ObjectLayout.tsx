import { useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ContextPanel } from '@/components/layout/ContextPanel';
import { ObjectContextNav } from '@/components/layout/ObjectContextNav';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { findObject } from '@/data/objects';
import { useLaunchStore } from '@/store';

/** Раздел объекта: синхронизирует текущий объект с адресом, даёт контекстную навигацию и панель. */
export function ObjectLayout() {
  const { objectId = '' } = useParams();
  const selectObject = useLaunchStore((s) => s.selectObject);
  const current = useLaunchStore((s) => s.currentObjectId);
  const entry = findObject(objectId);
  // Карточка запуска сама показывает следующее действие и журнал — контекстная панель там не нужна
  const isLaunch = useLocation().pathname.endsWith('/launch');

  useEffect(() => {
    if (entry && current !== entry.id) selectObject(entry.id);
  }, [entry, current, selectObject]);

  if (!entry)
    return (
      <EmptyState
        title="Объект не найден"
        description={`В портфеле нет объекта «${objectId}».`}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to={ROUTES.objects}>К списку объектов</Link>
          </Button>
        }
      />
    );
  if (current !== entry.id) return null;

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <ObjectContextNav objectId={entry.id} />
        <Outlet />
      </div>
      {!isLaunch && <ContextPanel objectId={entry.id} />}
    </div>
  );
}
