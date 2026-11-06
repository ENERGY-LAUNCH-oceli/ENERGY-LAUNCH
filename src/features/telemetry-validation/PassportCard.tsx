import { Battery, Sun } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import type { SitePassport } from '@/types';

/** Поля паспорта object.json: только то, что в нём есть. */
export function PassportCard({ passport }: { passport: SitePassport }) {
  const rows: [string, React.ReactNode][] = [
    ['object_id', <span className="font-mono">{passport.objectId}</span>],
    ['name', passport.name],
    ['address', passport.address ?? <span className="text-text-muted">не указан (null)</span>],
    ['coordinates', passport.coordinates ? <span className="tabular">{passport.coordinates.lat}, {passport.coordinates.lon}</span> : <span className="text-text-muted">null</span>],
    ['timezone', `${passport.timezone} (только отображение)`],
    ['grid_connection', <span className="font-mono text-caption">offtake {passport.ean.offtake ?? '—'} · injection {passport.ean.injection ?? '—'}</span>],
    ['data_files', <span className="font-mono text-caption">invoice: {passport.dataFiles.invoice ?? 'null'} · telemetry: {passport.dataFiles.telemetry ?? 'null'}</span>],
    ['csv_format', <span className="font-mono text-caption">«{passport.csvFormat.delimiter}» · «{passport.csvFormat.decimal}» · {passport.csvFormat.encoding} · {passport.csvFormat.stepMinutes} мин</span>],
  ];
  return (
    <section id="passport" aria-label="Паспорт объекта" className="min-w-0 scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label uppercase text-accent-strong">object.json</span>
        <h2 className="text-h3">Паспорт объекта</h2>
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 text-body-sm sm:grid-cols-[140px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-caption text-text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-col gap-2">
        <span className="font-mono text-caption text-text-muted">assets</span>
        <ul className="grid gap-2 sm:grid-cols-2">
          {passport.assets.map((a) => (
            <li key={a.assetId} className="flex items-center gap-3 rounded-sm bg-surface-secondary px-3 py-2">
              {a.type === 'PV' ? <Sun className="size-4 text-warning" aria-hidden /> : <Battery className="size-4 text-accent-strong" aria-hidden />}
              <span className="flex flex-col">
                <span className="text-body-sm font-semibold">
                  {a.assetId} <span className="font-mono text-caption text-text-muted">· {a.prefix}</span>
                </span>
                <span className="text-caption text-text-muted">
                  {a.type === 'PV' ? 'pv' : 'battery'} · сигналов {a.signals.length}
                </span>
              </span>
            </li>
          ))}
          {!passport.assets.length && <li className="text-caption text-text-muted">Активов PV и Battery в паспорте нет.</li>}
        </ul>
      </div>
      {passport.warnings.length > 0 && (
        <Alert tone="warning" title="Замечания к паспорту" className="mt-4">
          {passport.warnings.join('; ')}
        </Alert>
      )}
    </section>
  );
}
