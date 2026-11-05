import { Battery, Building2, Cable, Zap } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';

export function ObjectsPage() {
  const object = useLaunchStore((s) => s.inputs?.object);
  const session = useLaunchStore((s) => s.session);
  if (!object || !session) return null;
  const current = session.stages[session.currentStageId];
  const signals = object.assets.reduce((n, a) => n + a.signals.length, 0);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Реестр" title="Объекты" description="Обзор объектов и их состояния запуска. Полный реестр — в следующих фазах." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Установленная мощность" value={object.passport.installedCapacityMw} unit="МВт" icon={<Zap />} />
        <Kpi label="Активов" value={object.assets.length} icon={<Battery />} />
        <Kpi label="Сигналов в карте" value={signals} icon={<Cable />} />
        <Kpi label="Завершено этапов" value={`${STAGE_IDS.filter((id) => session.stages[id].status === 'COMPLETED').length} / 4`} tone={current.status === 'BLOCKED' ? 'error' : 'default'} icon={<Building2 />} />
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{object.name}</CardTitle>
            <StatusBadge status={current.status} />
          </div>
          <CardDescription className="font-mono">{object.code}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-body-sm sm:grid-cols-2">
            {[
              ['Присоединение', object.gridConnection.pointOfConnection],
              ['Сетевая организация', object.gridConnection.gridOperator],
              ['Часовой пояс', object.passport.timezone],
              ['Точки учёта', object.gridConnection.meteringPointIds.join(', ')],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-caption text-text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
