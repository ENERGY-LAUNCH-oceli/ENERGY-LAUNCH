import { CheckStatusLabel } from '@/components/launch';
import type { InvoiceFieldRule, InvoiceReport } from '@/types';
import { cn } from '@/utils/cn';

const SIGN: Record<InvoiceFieldRule['sign'], string> = { NON_NEGATIVE: '≥ 0', NON_POSITIVE: '≤ 0', ANY: '±' };
const fmt = (v: number | null) => (v === null ? '–' : v.toLocaleString('ru-RU', { maximumFractionDigits: 2 }));

/** Качество и единицы по каждому из семи полей invoice.csv. */
export function FieldQualityTable({ report, rules }: { report: InvoiceReport | undefined; rules: InvoiceFieldRule[] }) {
  return (
    <section id="quality" aria-label="Качество полей" className="scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label text-text-muted">Data Quality · Units</span>
        <h2 className="text-h3">Поля, единицы и знаки</h2>
      </div>
      <div id="units" className="scroll-mt-24 overflow-x-auto">
        <table className="w-full min-w-[820px] text-body-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted">
              <th className="py-2 pr-3">Поле</th>
              <th className="px-3">Единица</th>
              <th className="px-3">Знак</th>
              <th className="px-3 text-right">Значений</th>
              <th className="px-3 text-right">Пустых</th>
              <th className="px-3 text-right">Некорр.</th>
              <th className="px-3 text-right">Знак ✕</th>
              <th className="px-3 text-right">Ед. ✕</th>
              <th className="px-3 text-right">Мин … макс</th>
              <th className="pl-3">Итог</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const f = report?.fields.find((x) => x.field === rule.field);
              const unitBad = f && (f.unit !== rule.unit || f.unitSuspect > 0);
              const bad = !f?.present || unitBad || (f && (f.empty || f.invalid || f.signViolations));
              return (
                <tr key={rule.field} className="border-b border-border last:border-0" data-field={rule.field}>
                  <td className="py-2.5 pr-3 font-mono text-caption font-medium">{rule.field}</td>
                  <td className={cn('px-3 tabular', unitBad && 'font-medium text-error')}>
                    {f?.present ? f.unit ?? '–' : 'нет колонки'} <span className="text-text-muted">/ {rule.unit}</span>
                  </td>
                  <td className="px-3">{SIGN[rule.sign]}</td>
                  <td className="px-3 text-right tabular">{f?.values.toLocaleString('ru-RU') ?? '–'}</td>
                  <td className={cn('px-3 text-right tabular', f?.empty && 'font-medium text-error')}>{f?.empty ?? '–'}</td>
                  <td className={cn('px-3 text-right tabular', f?.invalid && 'font-medium text-error')}>{f?.invalid ?? '–'}</td>
                  <td className={cn('px-3 text-right tabular', f?.signViolations && 'font-medium text-error')}>{f?.signViolations ?? '–'}</td>
                  <td className={cn('px-3 text-right tabular', f?.unitSuspect && 'font-medium text-error')}>{f?.unitSuspect ?? '–'}</td>
                  <td className="px-3 text-right tabular text-text-secondary">{f ? `${fmt(f.min)} … ${fmt(f.max)}` : '–'}</td>
                  <td className="pl-3">{report ? <CheckStatusLabel status={bad ? 'FAILED' : 'PASSED'} /> : <CheckStatusLabel status="PENDING" />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
