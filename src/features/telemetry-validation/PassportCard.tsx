import { Battery, Sun } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import type { SitePassport } from '@/types';

/** Поля паспорта object.json: только то, что в нём есть. */
export function PassportCard({ passport }: { passport: SitePassport }) {
  const rows: { label: string; value: React.ReactNode; mono?: boolean; wide?: boolean }[] = [
    { label: 'Идентификатор объекта', value: passport.objectId, mono: true },
    { label: 'Название', value: passport.name },
    { label: 'Адрес', value: passport.address ?? <span className="text-text-muted">Не указан</span>, wide: true },
    { label: 'Координаты', value: passport.coordinates ? `${passport.coordinates.lat.toFixed(5)}, ${passport.coordinates.lon.toFixed(5)}` : <span className="text-text-muted">Не указаны</span>, mono: true },
    { label: 'Часовой пояс', value: passport.timezone },
    { label: 'Точки подключения', value: <span className="flex flex-wrap gap-x-3 gap-y-1"><span>Потребление: {passport.ean.offtake ?? '–'}</span><span>Выдача: {passport.ean.injection ?? '–'}</span></span>, mono: true, wide: true },
    { label: 'Файлы данных', value: <span className="flex flex-wrap gap-x-3 gap-y-1"><span>Учёт: {passport.dataFiles.invoice ?? 'не указан'}</span><span>Телеметрия: {passport.dataFiles.telemetry ?? 'не указана'}</span></span>, mono: true, wide: true },
    { label: 'Формат CSV', value: <span>Разделитель «{passport.csvFormat.delimiter}» · десятичный знак «{passport.csvFormat.decimal}» · {passport.csvFormat.encoding} · шаг {passport.csvFormat.stepMinutes} мин</span>, wide: true },
  ];
  return (
    <section id="passport" aria-label="Паспорт объекта" className="min-w-0 scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label text-text-muted">Данные из object.json</span>
        <h2 className="text-h3">Паспорт объекта</h2>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map(({ label, value, mono, wide }) => (
          <div key={label} className={`min-w-0 rounded-md bg-surface-secondary px-3 py-2.5 ${wide ? 'sm:col-span-2' : ''}`}>
            <dt className="text-caption text-text-muted">{label}</dt>
            <dd className={`mt-1 min-w-0 break-words text-body-sm ${mono ? 'font-mono text-caption' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-col gap-2">
        <span className="text-label text-text-muted">Оборудование · {passport.assets.length}</span>
        <ul className="grid gap-2 sm:grid-cols-2">
          {passport.assets.map((a) => (
            <li key={a.assetId} className="flex items-center gap-3 rounded-sm bg-surface-secondary px-3 py-2">
              {a.type === 'PV' ? <Sun className="size-4 text-warning" aria-hidden /> : <Battery className="size-4 text-accent-strong" aria-hidden />}
              <span className="flex flex-col">
                <span className="text-body-sm font-medium">
                  {a.assetId} <span className="font-mono text-caption text-text-muted">· {a.prefix}</span>
                </span>
                <span className="text-caption text-text-muted">
                  {a.type === 'PV' ? 'Солнечная установка' : 'Батарея'} · сигналов {a.signals.length}
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
