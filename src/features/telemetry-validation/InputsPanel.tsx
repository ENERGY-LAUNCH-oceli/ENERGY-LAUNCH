import { FileJson, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import * as React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { demoObjectJson, telemetryCsvText, type TelemetryGenOptions } from '@/data/mock';
import { findObject } from '@/data/objects';
import { importPassport, importTelemetry } from '@/services/telemetry-import';
import { useLaunchStore } from '@/store';
import type { SitePassport, TelemetryDatasetV2 } from '@/types';
import { formatDateTime } from '@/utils/format';
import { utc } from '../invoice-validation/labels';

const TEL_DEMO: { label: string; o: (p: SitePassport) => TelemetryGenOptions }[] = [
  { label: 'Корректный поток', o: () => ({}) },
  { label: 'Нет связи с батареей', o: (p) => ({ silentAssets: p.assets.filter((a) => a.type === 'BATTERY').slice(0, 1).map((a) => a.prefix) }) },
  { label: 'Поток прервался 90 мин назад', o: () => ({ staleMinutes: 90 }) },
  { label: 'Телеметрия другого объекта', o: () => ({ objectIdInFile: 'OBJ-FOREIGN-07', renamePrefix: { from: 'PV1', to: 'PV7' } }) },
  { label: 'Ошибки знаков и SoC', o: () => ({ negativePv: 3, socOutOfRange: 2, batterySignErrors: 3 }) },
];

/** Входы этапа 2: паспорт object.json и поток telemetry.csv. */
export function InputsPanel({ passport, dataset }: { passport: SitePassport | undefined; dataset: TelemetryDatasetV2 | undefined }) {
  const ruleset = useLaunchStore((s) => s.ruleset);
  const objectId = useLaunchStore((s) => s.currentObjectId)!;
  const importTel = useLaunchStore((s) => s.importTelemetryReport);
  const importPass = useLaunchStore((s) => s.importPassport);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadTelemetry = async (src: File | string, name: string, kind: 'UPLOAD' | 'DEMO') => {
    if (!passport) return setError('Сначала загрузите паспорт object.json: сигналы сопоставляются с активами по паспорту');
    setError(null);
    setBusy('telemetry');
    try {
      importTel(await importTelemetry(src, passport, ruleset.telemetry, { fileName: name, source: kind }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const loadPassport = async (src: File | string, name: string, kind: 'UPLOAD' | 'DEMO') => {
    setError(null);
    setBusy('passport');
    try {
      importPass(await importPassport(src, { fileName: name, source: kind }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const entry = findObject(objectId);
  const fixedPassport = () => {
    if (!entry) return '';
    const [street, rest] = entry.address.split(', ');
    return JSON.stringify(demoObjectJson({ objectId: entry.id, name: entry.name, street: street ?? null, postalCode: rest?.split(' ')[0] ?? null, city: entry.city, ean: entry.ean, assets: entry.equipment }), null, 2);
  };
  const r = dataset?.report;

  return (
    <section aria-label="Входные данные" className="grid gap-5 rounded-lg border border-border bg-surface p-5 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileJson className="size-5 text-accent-strong" aria-hidden />
          <h2 className="text-h3">Паспорт object.json</h2>
          {passport && <span className="rounded-pill bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">v{passport.version}</span>}
        </div>
        <p className="text-caption text-text-secondary">
          {passport ? (
            <>
              <span className="font-mono">{passport.fileName}</span> · загружен {formatDateTime(passport.loadedAt)} · активов {passport.assets.length} · сигналов в карте {passport.assets.reduce((n, a) => n + a.signals.length, 0) + passport.siteSignals.length}
            </>
          ) : (
            'Паспорт не загружен — карта сигналов неизвестна.'
          )}
        </p>
        {busy === 'passport' ? <Loader2 className="size-5 animate-spin text-accent" /> : <FileUpload accept=".json" label="Перетащите object.json или выберите файл" onFilesChange={(f) => f[0] && void loadPassport(f[0], f[0].name, 'UPLOAD')} />}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!entry || !!busy} onClick={() => void loadPassport(fixedPassport(), 'object.json', 'DEMO')}>
            <Sparkles aria-hidden />
            Загрузить исправленный паспорт
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-accent-strong" aria-hidden />
          <h2 className="text-h3">Поток telemetry.csv</h2>
          {dataset && <span className="rounded-pill bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">v{dataset.version}</span>}
        </div>
        <p className="text-caption text-text-secondary">
          {r ? (
            <>
              <span className="font-mono">{r.meta.fileName}</span> · строк <span className="tabular">{r.meta.rows.toLocaleString('ru-RU')}</span> · данные {utc(r.period.first)} – {utc(r.period.last)} UTC · точка проверки <b className="tabular">{utc(r.checkPoint)}</b> · окно {r.window.slots} × {r.window.stepMinutes} мин
            </>
          ) : (
            'Телеметрия не загружена.'
          )}
        </p>
        {busy === 'telemetry' ? <Loader2 className="size-5 animate-spin text-accent" /> : <FileUpload accept=".csv" maxSizeMb={500} label="Перетащите telemetry.csv или выберите файл" onFilesChange={(f) => f[0] && void loadTelemetry(f[0], f[0].name, 'UPLOAD')} />}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-muted">Демо-потоки:</span>
          {TEL_DEMO.map((d) => (
            <Button key={d.label} size="sm" variant="outline" disabled={!passport || !!busy} onClick={() => passport && void loadTelemetry(telemetryCsvText(passport, d.o(passport)), 'telemetry.csv', 'DEMO')}>
              {d.label}
            </Button>
          ))}
        </div>
      </div>
      {error && (
        <Alert tone="error" title="Файл не принят" className="xl:col-span-2">
          {error}
        </Alert>
      )}
    </section>
  );
}
