import { CheckStatusLabel } from '@/components/launch';
import type { InvoiceDataset, InvoiceValidationRun } from '@/types';
import { formatDateTime } from '@/utils/format';

/** Подтверждения прогонов: источник, файл, результат, время, версия правил, параметры, строки. Старые прогоны сохраняются. */
export function RunsHistory({ runs, current }: { runs: InvoiceValidationRun[]; current: InvoiceDataset | undefined }) {
  return (
    <section id="runs" aria-label="История проверок" className="scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label uppercase text-accent-strong">Подтверждения</span>
        <h2 className="text-h3">История проверок</h2>
      </div>
      {runs.length === 0 ? (
        <p className="text-body-sm text-text-secondary">Проверки ещё не запускались.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-body-sm" data-testid="runs-history">
            <thead>
              <tr className="border-b border-border text-left text-caption font-bold uppercase tracking-[0.06em] text-text-secondary">
                <th className="py-2 pr-3">Прогон</th>
                <th className="px-3">Время</th>
                <th className="px-3">Источник · файл</th>
                <th className="px-3 text-right">Строк</th>
                <th className="px-3">Правила</th>
                <th className="px-3">Параметры</th>
                <th className="pl-3">Результат</th>
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => (
                <tr key={r.id} className="border-b border-border align-top last:border-0">
                  <td className="py-2.5 pr-3 font-semibold">
                    #{r.run}
                    {r === runs.at(-1) && <span className="ml-2 rounded-pill bg-accent-subtle px-2 text-[11px] font-bold text-accent-strong">текущий</span>}
                  </td>
                  <td className="px-3 tabular text-caption">{formatDateTime(r.at)}</td>
                  <td className="px-3 text-caption">
                    {r.source === 'DEMO' ? 'Демо' : 'Загрузка'} · <span className="font-mono">{r.fileName}</span> v{r.datasetVersion}
                    {current && current.version !== r.datasetVersion && r === runs.at(-1) && <span className="block font-semibold text-warning">Данные изменены после проверки — результат неактуален</span>}
                  </td>
                  <td className="px-3 text-right tabular">{r.rowsProcessed.toLocaleString('ru-RU')}</td>
                  <td className="px-3 text-caption">v{r.rulesetVersion}</td>
                  <td className="px-3 font-mono text-[11px] text-text-secondary">{Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(' · ')}</td>
                  <td className="pl-3">
                    <CheckStatusLabel status={r.result} />
                    {r.failedRules.length > 0 && <span className="block font-mono text-[11px] text-error">{r.failedRules.join(', ')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
