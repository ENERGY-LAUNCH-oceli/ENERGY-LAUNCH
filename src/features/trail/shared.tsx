import type * as React from 'react';
import type { ObjectSection } from '@/app/routes';
import { Select } from '@/components/ui/select';
import type { InputRef, StageId } from '@/types';
import { cn } from '@/utils/cn';

export const STAGE_SECTION: Record<StageId, ObjectSection> = { METER_HISTORY: 'history', REALTIME_TELEMETRY: 'telemetry', ASSET_CONTROL: 'control', FINAL_DASHBOARDS: 'dashboards' };
export const STAGE_SHORT: Record<StageId, string> = { METER_HISTORY: '1 · История', REALTIME_TELEMETRY: '2 · Телеметрия', ASSET_CONTROL: '3 · Управление', FINAL_DASHBOARDS: '4 · Дашборды' };

export const utc = (iso: string | null | undefined) => (iso ? `${iso.slice(0, 10).split('-').reverse().join('.')} ${iso.slice(11, 16)}` : '–');

export const TH = 'whitespace-nowrap px-3 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted first:pl-5 last:pr-5';
export const TD = 'px-3 py-3 align-top first:pl-5 last:pr-5 [overflow-wrap:anywhere]';

/** Фильтр-селект с подписью. */
export function Filter({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <label className={cn('flex min-w-[150px] flex-1 flex-col gap-1 sm:max-w-[220px]', className)}>
      <span className="text-label text-text-muted">{label}</span>
      <Select aria-label={label} value={value} onValueChange={onChange} options={options} className="h-9" />
    </label>
  );
}

/** Ссылки на неизменяемые версии входов. */
export function InputRefs({ refs }: { refs: InputRef[] }) {
  if (!refs.length) return <span className="text-text-muted">–</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {refs.map((r) => (
        <li key={`${r.kind}-${r.version}`} className="font-mono text-[11px] text-text-secondary">
          {r.label}
          {r.rows !== undefined && <span className="text-text-muted"> · {r.rows.toLocaleString('ru-RU')} строк</span>}
          {r.sha256 && (
            <span className="block text-text-muted" title={r.sha256}>
              sha256 {r.sha256.slice(0, 16)}…
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-label text-text-muted">{title}</h3>
      <div className="text-body-sm">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'bad' | 'warn' | 'ok' }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-[18px] py-4">
      <span className="text-caption text-text-muted">{label}</span>
      <span className={cn('tabular text-numeric', tone === 'bad' && 'text-status-blocked', tone === 'warn' && 'text-warning', tone === 'ok' && 'text-status-completed')}>{value}</span>
    </div>
  );
}
