import { Battery, CalendarClock, Clock3, MapPin, PlugZap, UserRound } from 'lucide-react';
import type * as React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ObjectCatalogEntry } from '@/data/objects';
import type { LaunchInputs, StageStatus } from '@/types';
import { formatDateTime } from '@/utils/format';

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-0.5 text-text-muted [&_svg]:size-4">{icon}</span>
      <div className="flex min-w-0 flex-col">
        <dt className="text-caption text-text-muted">{label}</dt>
        <dd className="text-body-sm font-semibold">{children}</dd>
      </div>
    </div>
  );
}

/** Верхняя область карточки запуска: идентичность объекта и общий статус. */
export function ObjectHeader({ entry, inputs, status, startedAt, actions }: { entry: ObjectCatalogEntry; inputs: LaunchInputs; status: StageStatus; startedAt: string; actions?: React.ReactNode }) {
  return (
    <section aria-label="Объект" className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-label uppercase text-accent-strong">Карточка запуска</span>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1">{entry.name}</h1>
            <span className="rounded-xs bg-surface-sunken px-2 py-0.5 font-mono text-body-sm text-text-secondary">{entry.code}</span>
          </div>
          <p className="text-body-sm text-text-secondary">
            {entry.kind} · {entry.assets}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-muted">Общий статус</span>
            <StatusBadge status={status} className="h-8 px-3.5 text-body-sm [&_svg]:size-4" />
          </div>
          {actions}
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-4 border-t border-border bg-surface-secondary px-6 py-4 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-6">
        <Meta icon={<MapPin />} label="Адрес">
          <span className="block truncate" title={entry.address}>{entry.address}</span>
        </Meta>
        <Meta icon={<Clock3 />} label="Часовой пояс">{inputs.object.passport.timezone}</Meta>
        <Meta icon={<Battery />} label="Активы">
          <span className="tabular">{entry.assetCount}</span> · {entry.assets}
        </Meta>
        <Meta icon={<PlugZap />} label="EAN offtake / injection">
          <span className="block font-mono text-caption font-semibold">{entry.ean.offtake}</span>
          <span className="block font-mono text-caption font-semibold">{entry.ean.injection}</span>
        </Meta>
        <Meta icon={<UserRound />} label="Инженер запуска">{entry.responsible}</Meta>
        <Meta icon={<CalendarClock />} label="Начало запуска">
          <span className="tabular">{formatDateTime(startedAt)}</span>
        </Meta>
      </dl>
    </section>
  );
}
