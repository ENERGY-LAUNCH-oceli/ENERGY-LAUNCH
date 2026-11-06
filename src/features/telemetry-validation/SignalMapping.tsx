import { Check, Minus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SignalReport, SitePassport, TelemetryReport } from '@/types';
import { cn } from '@/utils/cn';
import { DIAGNOSIS, ownerLabel } from './labels';

const Yes = ({ ok }: { ok: boolean }) => (ok ? <Check className="size-4 text-success" aria-label="да" /> : <X className="size-4 text-error" aria-label="нет" />);

function Row({ s, maxAge, minPct }: { s: SignalReport; maxAge: number; minPct: number }) {
  const d = DIAGNOSIS[s.diagnosis];
  return (
    <tr className={cn('border-b border-border last:border-0', s.diagnosis !== 'OK' && s.required && 'bg-error-subtle/30')} data-signal={s.signal} data-diagnosis={s.diagnosis}>
      <td className="py-2 pl-4 pr-3 font-mono text-caption font-medium">{s.signal}</td>
      <td className="px-3 text-caption">
        {s.inData ? (
          <span className={cn(s.unit !== s.expectedUnit && s.expectedUnit !== 'code' && 'font-medium text-error')}>{s.unit ?? '–'}</span>
        ) : (
          '–'
        )}{' '}
        <span className="text-text-muted">/ {s.expectedUnit}</span>
      </td>
      <td className="px-3"><Yes ok={s.inPassport} /></td>
      <td className="px-3"><Yes ok={s.inData} /></td>
      <td className="px-3">
        <Badge size="sm" tone={d.tone === 'success' ? 'success' : d.tone === 'warning' ? 'warning' : d.tone === 'error' ? 'error' : 'neutral'} title={d.hint}>
          {d.label}
        </Badge>
      </td>
      <td className={cn('px-3 text-right tabular text-caption', s.ageMinutes !== null && s.ageMinutes > maxAge && 'font-medium text-error')}>{s.ageMinutes === null ? '–' : `${s.ageMinutes} мин`}</td>
      <td className="px-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-pill bg-surface-sunken">
            <span className={cn('block h-full rounded-pill', s.completenessPct >= minPct ? 'bg-status-completed-solid' : 'bg-status-blocked-solid')} style={{ width: `${s.completenessPct}%` }} />
          </span>
          <span className="tabular text-caption">{s.completenessPct.toLocaleString('ru-RU')} %</span>
        </div>
        <span className="tabular text-[11px] text-text-muted">
          {s.received}/{s.expected} · пропущено {s.missing}
        </span>
      </td>
      <td className="px-3 pr-4 text-right tabular text-caption">
        {s.invalid ? <span className="font-medium text-error">{s.invalid} некорр.</span> : s.suspicious ? <span className="font-medium text-warning">{s.suspicious} подозр.</span> : <Minus className="ml-auto size-4 text-text-muted" />}
      </td>
    </tr>
  );
}

/** Signal Mapping: сигналы автоматически сопоставлены с активами по object.json. */
export function SignalMapping({ passport, report, maxAge, minPct }: { passport: SitePassport; report: TelemetryReport | undefined; maxAge: number; minPct: number }) {
  const groups = [{ owner: 'GRID', type: 'GRID' }, ...passport.assets.map((a) => ({ owner: a.assetId, type: a.type }))];
  const signals = report?.signals ?? [];
  const extra = signals.filter((s) => !s.required);
  return (
    <section id="mapping" aria-label="Signal Mapping" className="min-w-0 scroll-mt-24 rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-label text-text-muted">Signal Mapping</span>
          <h2 className="text-h3">Карта сигналов по паспорту</h2>
        </div>
        <span className="text-caption text-text-muted">Колонки «В карте» – object.json, «В данных» – telemetry.csv</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-body-sm" data-testid="signal-mapping">
          <thead>
            <tr className="border-y border-border text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted">
              <th className="py-2 pl-4 pr-3">Сигнал</th>
              <th className="px-3">Ед.</th>
              <th className="px-3">В карте</th>
              <th className="px-3">В данных</th>
              <th className="px-3">Подключение</th>
              <th className="px-3 text-right">Возраст</th>
              <th className="px-3">Полнота 48 ч</th>
              <th className="px-3 pr-4 text-right">Качество</th>
            </tr>
          </thead>
          {groups.map((g) => {
            const rows = signals.filter((s) => s.required && s.owner === g.owner);
            const bad = rows.filter((s) => s.diagnosis !== 'OK').length;
            return (
              <tbody key={g.owner}>
                <tr className="border-b border-border bg-surface-secondary/60">
                  <td colSpan={8} className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <b className="text-body-sm">{ownerLabel(g.owner, g.type)}</b>
                      <span className="text-caption text-text-muted">обязательных {rows.length}</span>
                      {report && <Badge size="sm" tone={bad ? 'error' : 'success'}>{bad ? `проблем ${bad}` : 'все подключены'}</Badge>}
                    </span>
                  </td>
                </tr>
                {rows.map((s) => (
                  <Row key={s.signal} s={s} maxAge={maxAge} minPct={minPct} />
                ))}
                {!report && (
                  <tr>
                    <td colSpan={8} className="px-4 py-3 text-caption text-text-muted">Телеметрия не загружена – сигналы не проверены.</td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="grid gap-4 border-t border-border px-5 py-4 text-caption md:grid-cols-2">
        <div>
          <span className="font-medium text-text-secondary">Агрегаты и сигналы объекта (не подменяют сигналы оборудования):</span>
          <span className="mt-1 block font-mono text-text-muted">{extra.length ? extra.map((s) => `${s.signal}${s.inData ? '' : ' (нет в данных)'}`).join(' · ') : '–'}</span>
        </div>
        <div>
          <span className="font-medium text-text-secondary">Сигналы вне паспорта:</span>
          <span className={cn('mt-1 block font-mono', report?.foreignColumns.length ? 'font-medium text-error' : 'text-text-muted')} data-testid="foreign-columns">
            {report?.foreignColumns.length ? report.foreignColumns.join(' · ') : 'нет'}
          </span>
          {report?.objectIdsInFile.length ? <span className="mt-1 block">object_id в файле: <span className="font-mono">{report.objectIdsInFile.join(', ')}</span></span> : null}
        </div>
      </div>
    </section>
  );
}

/** Легенда причин: отсутствие сигнала ≠ отсутствие связи ≠ ошибка привязки ≠ неисправность. */
export function DiagnosisLegend() {
  const items = ['NOT_IN_DATA', 'NO_COMMUNICATION', 'WRONG_BINDING', 'SUSPICIOUS'] as const;
  return (
    <section aria-label="Как читать причины" className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-body-sm font-semibold">Как читать результаты</h2>
      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
        {items.map((k) => (
          <div key={k} className="flex flex-col gap-1 rounded-md bg-surface-secondary px-3 py-2.5">
          <span className="text-body-sm font-medium">{DIAGNOSIS[k].label}</span>
          <span className="text-caption text-text-secondary">{DIAGNOSIS[k].hint}</span>
          </div>
        ))}
      </div>
      <p className="rounded-md border border-info-border bg-info-subtle px-3 py-2.5 text-caption text-text-secondary">
        Отсутствие телеметрии не является доказательством неисправности батареи или PV: вывод о неисправности делается только после восстановления связи и проверки на месте.
      </p>
    </section>
  );
}
