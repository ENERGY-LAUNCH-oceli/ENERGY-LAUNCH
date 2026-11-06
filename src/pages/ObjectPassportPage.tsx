import { PageHeader } from '@/components/common/PageHeader';
import { LaunchProgress } from '@/components/launch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STAGE_META } from '@/config/stages';
import { findObject } from '@/data/objects';
import { DeleteObjectButton } from '@/features/objects';
import { isValidEan } from '@/engine/invoice';
import { objectReadiness } from '@/engine';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';
import { cn } from '@/utils/cn';

const Row = ({ label, value, mono, bad }: { label: string; value: React.ReactNode; mono?: boolean; bad?: string | null }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-caption text-text-muted">{label}</dt>
    <dd className={cn('min-w-0 break-words text-body-sm', mono && 'break-all font-mono text-caption', value === null && 'text-text-muted')}>{value ?? 'не указано (null)'}</dd>
    {bad && <dd className="text-caption text-status-blocked">{bad}</dd>}
  </div>
);

/** Паспорт объекта: только поля object.json и сведения о файлах набора. Вымышленные значения не показываются. */
export function ObjectPassportPage() {
  const inputs = useLaunchStore((s) => s.inputs);
  const session = useLaunchStore((s) => s.session);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const manifest = useLaunchStore((s) => s.dataManifest);
  if (!inputs || !session) return null;
  const p = inputs.passport;
  const entry = findObject(session.objectId);
  const files = entry?.folder && manifest ? manifest.files.filter((f) => f.path.startsWith(`${entry.folder}/`)) : [];
  const unit = (s: string) => p?.signalUnits?.[s];
  const eanCheck = (v: string | null) => (v === null ? null : isValidEan(v, ruleset.meterHistory.eanLength) ? null : `не соответствует формату EAN (${ruleset.meterHistory.eanLength} цифр, контрольная цифра GS1)`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Паспорт объекта · object.json" title={p?.name ?? inputs.object.name} description={[p?.address, p?.timezone].filter(Boolean).join(' · ')} actions={entry && <DeleteObjectButton entry={entry} />} />
      <LaunchProgress currentStageId={session.currentStageId} ready={objectReadiness(session, inputs, ruleset).ready} stages={STAGE_IDS.map((id) => ({ id, title: STAGE_META[id].titleRu, status: session.stages[id].status }))} />

      {!p ? (
        <p className="text-body-sm text-text-muted">Паспорт object.json не загружен.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Объект и точка подключения</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Row label="object_id" value={p.objectId} mono />
                <Row label="name" value={p.name} />
                <Row label="address" value={p.address} />
                <Row label="coordinates" value={p.coordinates ? `${p.coordinates.lat.toFixed(5)}, ${p.coordinates.lon.toFixed(5)}` : null} mono />
                <Row label="timezone (только отображение)" value={p.timezone} mono />
                <Row label="csv_format" value={`«${p.csvFormat.delimiter}» · «${p.csvFormat.decimal}» · ${p.csvFormat.encoding} · ${p.csvFormat.stepMinutes} мин`} mono />
                <Row label="EAN offtake (потребление)" value={p.ean.offtake} mono bad={eanCheck(p.ean.offtake)} />
                <Row label="EAN injection (выдача)" value={p.ean.injection} mono bad={eanCheck(p.ean.injection)} />
                <Row label="data_files.invoice" value={p.dataFiles.invoice} mono />
                <Row label="data_files.telemetry" value={p.dataFiles.telemetry} mono />
              </dl>
              {p.warnings.length > 0 && <ul className="mt-3 text-caption text-warning">{p.warnings.map((w) => <li key={w}>– {w}</li>)}</ul>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Активы и карта сигналов · {p.assets.length}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!p.assets.length && <p className="text-body-sm text-text-muted">В паспорте нет активов (assets: []). Оборудование не добавляется автоматически.</p>}
              {p.assets.map((a) => (
                <div key={a.assetId} className="flex flex-col gap-1.5 rounded-md bg-surface-secondary p-3" data-passport-asset={a.assetId}>
                  <span className="text-body-sm font-medium">
                    {a.assetId} <span className="text-caption text-text-muted">· {a.type === 'PV' ? 'PV' : 'Battery'} · префикс {a.prefix}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {a.signals.map((s) => (
                      <span key={s} className="max-w-full break-all rounded-xs bg-surface px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                        {s}
                        {unit(s) && <span className="text-text-muted"> ({unit(s)})</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
              {p.siteSignals.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-label text-text-muted">site_signals · {p.siteSignals.length}</span>
                  <span className="flex flex-wrap gap-1">
                    {p.siteSignals.map((s) => (
                      <span key={s} className="max-w-full break-all rounded-xs bg-surface-secondary px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">{s}</span>
                    ))}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Файлы набора · неизменяемый срез</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-body-sm" data-testid="dataset-files">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                    <th className="py-2 pr-3 font-normal">Файл</th>
                    <th className="px-3 text-right font-normal">Строк</th>
                    <th className="px-3 font-normal">Период (UTC)</th>
                    <th className="pl-3 font-normal">SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.path} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-mono text-caption">{f.path}</td>
                      <td className="px-3 text-right font-mono text-caption">{f.rows?.toLocaleString('ru-RU') ?? '–'}</td>
                      <td className="px-3 font-mono text-caption">{f.period ? `${f.period.first?.slice(0, 16)} – ${f.period.last?.slice(0, 16)}` : '–'}</td>
                      <td className="pl-3 font-mono text-[11px] text-text-muted" title={f.sha256}>{f.sha256.slice(0, 16)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
