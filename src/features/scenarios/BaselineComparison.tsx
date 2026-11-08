import { Download, Square, Timer } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { manualChecklistCsv, parseMinutes, SCENARIOS, timeReduction, TIME_REDUCTION_TARGET_PCT, type ScenarioRun } from '@/scenarios';
import { cn } from '@/utils/cn';

type Kind = 'manual' | 'proto';
const KEYS: Record<Kind, string> = { manual: 'el.scenarios.baseline', proto: 'el.scenarios.prototype' };

function load(kind: Kind): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(KEYS[kind]) ?? '{}') as Record<number, string>;
  } catch {
    return {};
  }
}

const fmtMin = (v: number | null) => (v === null ? '–' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} мин`);
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Сравнение с ручным чек-листом (ТЗ 6.1 п. 5, 6.2): на тех же 6 оценочных сценариях инженер засекает время ручной
 * проверки и проверки с прототипом; ΔT считается по медианам. Значения не подставляются – без замера «не измерено».
 */
export function BaselineComparison({ runs, rulesetVersion }: { runs: Record<number, ScenarioRun>; rulesetVersion: string }) {
  const evaluation = SCENARIOS.filter((s) => s.evaluation);
  const [values, setValues] = React.useState<Record<Kind, Record<number, string>>>(() => ({ manual: load('manual'), proto: load('proto') }));
  const [timer, setTimer] = React.useState<{ n: number; kind: Kind; start: number } | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!timer) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [timer]);

  const set = (kind: Kind, n: number, v: string) =>
    setValues((s) => {
      const next = { ...s, [kind]: { ...s[kind], [n]: v } };
      try {
        localStorage.setItem(KEYS[kind], JSON.stringify(next[kind]));
      } catch {
        /* хранилище недоступно – значение живёт до перезагрузки */
      }
      return next;
    });

  const toggle = (n: number, kind: Kind) => {
    if (timer && timer.n === n && timer.kind === kind) {
      set(kind, n, String(Math.max(0.1, Math.round((Date.now() - timer.start) / 6000) / 10)).replace('.', ','));
      setTimer(null);
      return;
    }
    setNow(Date.now());
    setTimer({ n, kind, start: Date.now() });
  };

  const rows = evaluation.map((def) => {
    const runMs = runs[def.n]?.outcome.workspace.durationMs;
    const manualMin = parseMinutes(values.manual[def.n]);
    const measuredProto = parseMinutes(values.proto[def.n]);
    const protoMin = measuredProto ?? (runMs !== undefined ? Math.max(runMs, 1) / 60000 : undefined);
    return { def, runMs, manualMin, measuredProto, protoMin };
  });
  const result = timeReduction(rows);
  const anyFallback = rows.some((r) => r.measuredProto === undefined && r.runMs !== undefined);

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Сценарий', 'Ручная проверка, мин', 'С прототипом, мин', 'Источник времени прототипа', 'Прогон сценария, с'],
      ...rows.map((r) => [`${r.def.n}. ${r.def.title}`, r.manualMin ?? 'не измерено', r.protoMin !== undefined ? Math.round(r.protoMin * 1000) / 1000 : 'не измерено', r.measuredProto !== undefined ? 'замер инженера' : 'время прогона', r.runMs !== undefined ? r.runMs / 1000 : '']),
      [],
      ['Медиана, мин', result.manualMedianMin ?? 'не измерено', result.protoMedianMin ?? 'не измерено'],
      ['ΔT, %', result.deltaPct ?? 'не измерено', `цель ≥ ${TIME_REDUCTION_TARGET_PCT} %`],
      ['Набор правил', rulesetVersion],
      ['Выгружено (UTC)', new Date().toISOString()],
    ];
    save('baseline-comparison.csv', `\uFEFF${lines.map((l) => l.map(cell).join(';')).join('\n')}\n`, 'text/csv');
  };

  const input = (def: (typeof evaluation)[number], kind: Kind, label: string, placeholder: string) => {
    const running = timer?.n === def.n && timer.kind === kind;
    return (
      <div className="flex items-center gap-1.5">
        <input
          inputMode="decimal"
          aria-label={`${label}, сценарий ${def.n}`}
          placeholder={placeholder}
          value={running ? clock(now - timer.start) : (values[kind][def.n] ?? '')}
          readOnly={running}
          onChange={(e) => set(kind, def.n, e.target.value)}
          className={cn('tabular h-8 w-28 rounded-md border border-border bg-surface px-2 text-body-sm placeholder:text-text-muted focus:border-accent focus:outline-none', running && 'border-accent text-accent-strong')}
        />
        <Button size="sm" variant={running ? 'accent' : 'ghost'} onClick={() => toggle(def.n, kind)} disabled={!!timer && !running} aria-label={running ? `Остановить секундомер, сценарий ${def.n}` : `Засечь время, сценарий ${def.n}`} title={running ? 'Остановить и записать' : 'Засечь время'}>
          {running ? <Square aria-hidden /> : <Timer aria-hidden />}
        </Button>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-3" data-testid="baseline">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3">Сравнение с ручной проверкой</h2>
          <p className="max-w-3xl text-body-sm text-text-muted">
            ТЗ 6.1 п. 5: те же 6 оценочных сценариев, те же данные и правила. Инженер проверяет объект сценария по ручному чек-листу и засекает время, затем – с прототипом. ΔT = (T<sub>ручн</sub> − T<sub>прот</sub>) / T<sub>ручн</sub> × 100 % по
            медианам, цель ≥ {TIME_REDUCTION_TARGET_PCT} %. Без замера – «не измерено», значения не подставляются.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => save(`manual-checklist-${rulesetVersion}.csv`, manualChecklistCsv(rulesetVersion), 'text/csv')} data-testid="manual-checklist">
            <Download aria-hidden />
            Ручной чек-лист
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download aria-hidden />
            Результаты CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[720px] text-body-sm" data-testid="baseline-table">
          <thead className="border-b border-border">
            <tr>
              {['Сценарий', 'Ручная проверка, мин', 'С прототипом, мин', 'Прогон сценария'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-text-muted first:pl-5 last:pr-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ def, runMs }) => (
              <tr key={def.n} className="border-b border-border">
                <td className="px-3 py-2.5 first:pl-5">
                  {def.n}. {def.title}
                </td>
                <td className="px-3 py-2">{input(def, 'manual', 'Ручная проверка', 'не измерено')}</td>
                <td className="px-3 py-2">{input(def, 'proto', 'Проверка с прототипом', runMs !== undefined ? 'по прогону' : 'не измерено')}</td>
                <td className="tabular px-3 py-2.5 text-text-muted last:pr-5">{runMs === undefined ? 'не запускался' : runMs < 1000 ? `${Math.max(runMs, 1)} мс` : `${(runMs / 1000).toFixed(2)} с`}</td>
              </tr>
            ))}
            <tr className="bg-surface-secondary">
              <td className="px-3 py-2.5 font-medium first:pl-5">Медиана</td>
              <td className="tabular px-3 py-2.5">{fmtMin(result.manualMedianMin)}</td>
              <td className="tabular px-3 py-2.5">{fmtMin(result.protoMedianMin)}</td>
              <td className="px-3 py-2.5 last:pr-5" data-testid="time-reduction">
                {result.deltaPct === null ? (
                  <span className="text-text-muted">
                    ΔT не измерено · замерено {result.measured} из {result.total}
                  </span>
                ) : (
                  <span className={cn('tabular font-medium', result.passed ? 'text-status-completed' : 'text-status-blocked')}>
                    ΔT {result.deltaPct.toLocaleString('ru-RU')} % {result.passed ? '≥' : '<'} {TIME_REDUCTION_TARGET_PCT} %
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {anyFallback && <p className="text-caption text-text-muted">Где время с прототипом не замерено, берётся время прогона сценария – это нижняя граница: инженеру ещё нужно прочитать итог.</p>}
    </section>
  );
}
