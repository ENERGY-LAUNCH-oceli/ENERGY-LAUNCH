import { FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import * as React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';
import { invoiceCsvText, type InvoiceGenOptions } from '@/data/mock';
import { importInvoice, type InvoiceImportProgress } from '@/services/invoice-import';
import { useLaunchStore } from '@/store';
import type { InvoiceDataset } from '@/types';
import { formatDateTime } from '@/utils/format';
import { bytes, utc } from './labels';

const DEMO: { label: string; o: Omit<InvoiceGenOptions, 'objectId'> }[] = [
  { label: 'Полная история', o: {} },
  { label: '19 из 24 месяцев', o: { missingFirstMonths: 5 } },
  { label: 'Дефекты истории', o: { gaps: [['2025-06-10T00:00:00Z', 288]], duplicates: 4, mixedUnitRows: 8, emptyCells: 3, seed: 7 } },
  { label: 'Часовой шаг', o: { stepMinutes: 60 } },
];

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="truncate text-body-sm font-semibold">{children}</dd>
    </div>
  );
}

/** Импорт invoice.csv: drag & drop, выбор файла, потоковый разбор и сведения о файле. */
export function UploadPanel({ dataset }: { dataset: InvoiceDataset | undefined }) {
  const ruleset = useLaunchStore((s) => s.ruleset);
  const objectId = useLaunchStore((s) => s.currentObjectId)!;
  const importReport = useLaunchStore((s) => s.importInvoiceReport);
  const [progress, setProgress] = React.useState<InvoiceImportProgress | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (source: File | string, name: string, kind: 'UPLOAD' | 'DEMO') => {
    setError(null);
    setProgress({ rows: 0, bytes: 0, totalBytes: typeof source === 'string' ? source.length : source.size });
    try {
      const report = await importInvoice(source, ruleset.meterHistory, { fileName: name, source: kind, onProgress: setProgress });
      importReport(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  const r = dataset?.report;
  return (
    <section aria-label="Загрузка invoice.csv" className="grid gap-5 rounded-lg border border-border bg-surface p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-label uppercase text-accent-strong">Источник</span>
          <h2 className="text-h3">Официальная выгрузка invoice.csv</h2>
          <p className="text-caption text-text-secondary">CSV, UTF-8 с BOM, разделитель «;», десятичная запятая, время ISO 8601 UTC. Файл читается потоково — строки не хранятся в браузере.</p>
        </div>
        {progress ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-accent bg-accent-subtle/50 p-6">
            <span className="flex items-center gap-2 text-body-sm font-semibold">
              <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
              Проверка файла… <span className="tabular">{progress.rows.toLocaleString('ru-RU')}</span> строк
            </span>
            <Progress value={progress.bytes} max={Math.max(progress.totalBytes, 1)} size="sm" />
          </div>
        ) : (
          <FileUpload accept=".csv" maxSizeMb={500} label="Перетащите invoice.csv или выберите файл" onFilesChange={(f) => f[0] && void run(f[0], f[0].name, 'UPLOAD')} />
        )}
        {error && (
          <Alert tone="error" title="Файл не принят">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-caption text-text-muted">
            <Sparkles className="size-3.5" aria-hidden />
            Демо-выгрузки:
          </span>
          {DEMO.map((d) => (
            <Button key={d.label} size="sm" variant="outline" disabled={!!progress} onClick={() => void run(invoiceCsvText({ objectId, ...d.o }), 'invoice.csv', 'DEMO')}>
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-surface-secondary p-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-accent-strong" aria-hidden />
          <span className="font-mono text-body-sm font-semibold">{r?.meta.fileName ?? 'Файл не загружен'}</span>
          {dataset && <span className="rounded-pill bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">v{dataset.version}</span>}
        </div>
        {r ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Meta label="Размер">{bytes(r.meta.sizeBytes)}</Meta>
            <Meta label="Загружен">{formatDateTime(r.meta.uploadedAt)}</Meta>
            <Meta label="Строк">
              <span className="tabular">{r.meta.rows.toLocaleString('ru-RU')}</span>
            </Meta>
            <Meta label="Формат">
              CSV · {r.meta.format.encoding}
              {r.meta.format.bom ? ' BOM' : ' без BOM'} · «{r.meta.format.delimiter}» · «{r.meta.format.decimal}»
            </Meta>
            <Meta label="Период данных (UTC)">
              <span className="tabular">
                {utc(r.period.first).slice(0, 10)} – {utc(r.period.last).slice(0, 10)}
              </span>
            </Meta>
            <Meta label="Шаг исходных данных">{r.detectedStepMinutes ? `${r.detectedStepMinutes} мин` : '—'}</Meta>
          </dl>
        ) : (
          <p className="text-body-sm text-text-secondary">Загрузите файл, чтобы увидеть период, строки и формат. Отсутствие данных не считается успешной проверкой.</p>
        )}
      </div>
    </section>
  );
}
