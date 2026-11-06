import { CheckStatusLabel } from '@/components/launch';
import type { SitePassport, TelemetryDatasetV2, TelemetryValidationRun } from '@/types';
import { formatDateTime } from '@/utils/format';
import { utc } from '../invoice-validation/labels';

/** Подтверждения прогонов этапа 2 с версиями входов; неактуальный прогон помечается. */
export function TelemetryRuns({ runs, dataset, passport }: { runs: TelemetryValidationRun[]; dataset: TelemetryDatasetV2 | undefined; passport: SitePassport | undefined }) {
  return (
    <section id="runs" aria-label="История проверок телеметрии" className="scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label uppercase text-accent-strong">Подтверждения</span>
        <h2 className="text-h3">История проверок</h2>
      </div>
      {!runs.length ? (
        <p className="text-body-sm text-text-secondary">Проверки ещё не запускались.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-body-sm" data-testid="telemetry-runs">
            <thead>
              <tr className="border-b border-border text-left text-caption font-bold uppercase tracking-[0.06em] text-text-secondary">
                <th className="py-2 pr-3">Прогон</th>
                <th className="px-3">Время</th>
                <th className="px-3">Входы</th>
                <th className="px-3">Точка проверки</th>
                <th className="px-3 text-right">Строк · сигналов</th>
                <th className="px-3">Правила · параметры</th>
                <th className="pl-3">Результат</th>
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => {
                const last = r === runs.at(-1);
                const stale = last && ((dataset?.version ?? 0) !== r.datasetVersion || (passport?.version ?? 0) !== r.passportVersion);
                return (
                  <tr key={r.id} className="border-b border-border align-top last:border-0">
                    <td className="py-2.5 pr-3 font-semibold">#{r.run}{last && <span className="ml-2 rounded-pill bg-accent-subtle px-2 text-[11px] font-bold text-accent-strong">текущий</span>}</td>
                    <td className="px-3 tabular text-caption">{formatDateTime(r.at)}</td>
                    <td className="px-3 text-caption">
                      <span className="font-mono">{r.fileName}</span> v{r.datasetVersion} · <span className="font-mono">{r.passportFile}</span> v{r.passportVersion}
                      {stale && <span className="block font-semibold text-warning">Входы изменены — результат неактуален</span>}
                    </td>
                    <td className="px-3 tabular text-caption">{utc(r.checkPoint)}</td>
                    <td className="px-3 text-right tabular text-caption">{r.rowsProcessed.toLocaleString('ru-RU')} · {r.signalsChecked}</td>
                    <td className="px-3 font-mono text-[11px] text-text-secondary">v{r.rulesetVersion} · {Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(' · ')}</td>
                    <td className="pl-3">
                      <CheckStatusLabel status={stale ? 'STALE' : r.result} />
                      {r.failedRules.length > 0 && <span className="block font-mono text-[11px] text-error">{r.failedRules.join(', ')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
