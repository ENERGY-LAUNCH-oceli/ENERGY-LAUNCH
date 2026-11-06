import { Battery, Cable, Sun, Zap } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { LaunchProgress } from '@/components/launch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { STAGE_META } from '@/config/stages';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';

export function ObjectPassportPage() {
  const inputs = useLaunchStore((s) => s.inputs);
  const session = useLaunchStore((s) => s.session);
  if (!inputs || !session) return null;
  const o = inputs.object;
  const signals = o.assets.flatMap((a) => a.signals);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Паспорт объекта" title={o.name} description={`${o.passport.location.region} · ${o.passport.timezone} · ${o.gridConnection.pointOfConnection}`} />
      <LaunchProgress currentStageId={session.currentStageId} ready={session.status === 'COMPLETED'} stages={STAGE_IDS.map((id) => ({ id, title: STAGE_META[id].titleRu, status: session.stages[id].status }))} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Установленная мощность" value={o.passport.installedCapacityMw} unit="МВт" icon={<Sun />} />
        <Kpi label="Договорное ограничение (CA)" value={o.gridConnection.maxCapacityMw} unit="МВт" icon={<Zap />} />
        <Kpi label="Активов" value={o.assets.length} icon={<Battery />} />
        <Kpi label="Сигналов в карте" value={signals.length} icon={<Cable />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Точка подключения</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
              {[
                ['Сетевая организация', o.gridConnection.gridOperator],
                ['Напряжение', `${o.gridConnection.voltageLevelKv} кВ`],
                ['Точки учёта', o.gridConnection.meteringPointIds.join(', ')],
                ['Паспорт', o.passport.passportNumber],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-caption text-text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Состав активов и карта сигналов</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {o.assets.map((a) => (
              <div key={a.id} className="flex flex-col gap-1.5 rounded-md bg-surface-secondary p-3">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-semibold">{a.name}</span>
                  {a.controllable && <Badge tone="accent" size="sm">Управляемый</Badge>}
                </div>
                <span className="flex flex-wrap gap-1">
                  {a.signals.map((s) => (
                    <span key={s.id} className="rounded-xs bg-surface px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                      {s.tag}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
