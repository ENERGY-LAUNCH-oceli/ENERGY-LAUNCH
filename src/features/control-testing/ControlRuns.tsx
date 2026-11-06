import { CheckStatusLabel } from '@/components/launch';
import type { ControlValidationRun } from '@/types';
import { formatDateTime } from '@/utils/format';

/** Подтверждения прогонов проверок этапа 3; прогон неактуален, если после него были новые тесты. */
export function ControlRuns({ runs, commandsCount }: { runs: ControlValidationRun[]; commandsCount: number }) {
  return (
    <section id="runs" aria-label="История проверок управления" className="scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label text-text-muted">Подтверждения</span>
        <h2 className="text-h3">История проверок</h2>
      </div>
      {!runs.length ? (
        <p className="text-body-sm text-text-secondary">Проверки ещё не запускались.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-body-sm" data-testid="control-runs">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted">
                <th className="py-2 pr-3">Прогон</th>
                <th className="px-3">Время</th>
                <th className="px-3">Команды</th>
                <th className="px-3">Правила · параметры</th>
                <th className="pl-3">Результат</th>
              </tr>
            </thead>
            <tbody>
              {[...runs].reverse().map((r) => {
                const last = r === runs.at(-1);
                const stale = last && r.commandsCount !== commandsCount;
                return (
                  <tr key={r.id} className="border-b border-border align-top last:border-0">
                    <td className="py-2.5 pr-3 font-medium">#{r.run}{last && <span className="ml-2 rounded-pill bg-accent-subtle px-2 text-[11px] font-medium text-accent-strong">текущий</span>}</td>
                    <td className="px-3 tabular text-caption">{formatDateTime(r.at)}</td>
                    <td className="px-3 text-caption">
                      <span className="font-mono">{r.commandIds.slice(-4).join(', ') || '–'}</span>
                      {r.commandIds.length > 4 && <span className="text-text-muted"> и ещё {r.commandIds.length - 4}</span>}
                      {stale && <span className="block font-medium text-warning">После проверки были новые тесты – результат неактуален</span>}
                    </td>
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
