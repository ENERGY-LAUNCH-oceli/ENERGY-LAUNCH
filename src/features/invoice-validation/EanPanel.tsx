import { CheckStatusLabel } from '@/components/launch';
import { isValidEan } from '@/engine/invoice';
import type { EnergyObject, InvoiceReport, ValidationResult } from '@/types';

/** Сопоставление EAN паспорта объекта и данных. */
export function EanPanel({ object, report, results, eanLength }: { object: EnergyObject; report: InvoiceReport | undefined; results: ValidationResult[]; eanLength: number }) {
  const rows = [
    { label: 'EAN offtake (потребление)', passport: object.gridConnection.eanOfftake ?? null, file: report?.fileEan.offtake ?? [] },
    { label: 'EAN injection (выдача)', passport: object.gridConnection.eanInjection ?? null, file: report?.fileEan.injection ?? [] },
  ];
  const binding = results.find((r) => r.ruleId === 'MH-012');
  return (
    <section id="ean" aria-label="EAN Matching" className="min-w-0 scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label uppercase text-accent-strong">EAN Matching</span>
        <h2 className="text-h3">Привязка счётчика к объекту</h2>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-body-sm">
        <thead>
          <tr className="border-b border-border text-left text-caption font-bold uppercase tracking-[0.06em] text-text-secondary">
            <th className="py-2 pr-3">Код</th>
            <th className="px-3">Паспорт (object.json)</th>
            <th className="px-3">В данных</th>
            <th className="pl-3">Проверка</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const valid = isValidEan(r.passport, eanLength);
            const match = r.file.length === 0 || r.file.every((f) => f === r.passport);
            return (
              <tr key={r.label} className="border-b border-border last:border-0">
                <td className="py-2.5 pr-3 font-semibold">{r.label}</td>
                <td className="px-3 font-mono text-caption">{r.passport ?? '—'}</td>
                <td className="px-3 font-mono text-caption">{r.file.length ? r.file.join(', ') : 'нет колонки EAN'}</td>
                <td className="pl-3">
                  <CheckStatusLabel status={!valid || !match ? 'FAILED' : 'PASSED'} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="mt-3 text-caption text-text-secondary">
        {binding ? binding.message : 'Привязка проверяется после запуска проверок.'} Зарегистрированный файл: <span className="font-mono">{object.passport.dataFiles?.invoice ?? 'не указан'}</span>.
      </p>
    </section>
  );
}
