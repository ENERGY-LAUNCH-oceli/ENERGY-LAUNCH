import { StatusBadge } from '@/components/ui/status-badge';
import { monthLabel, utc } from '@/features/invoice-validation/labels';
import type { DashboardBlockConfig, MonthCoverage } from '@/types';
import { cn } from '@/utils/cn';
import { Stat, Widget } from './BlockFrame';
import { mwh, num, type DashboardData } from './data';

const PERIOD_MONTHS: Record<string, number> = { '24M': 24, '12M': 12, '6M': 6 };

function MonthlyChart({ months, offtake, injection }: { months: MonthCoverage[]; offtake: boolean; injection: boolean }) {
  const max = Math.max(1, ...months.map((m) => Math.max(offtake ? (m.offtakeKwh ?? 0) : 0, injection ? (m.injectionKwh ?? 0) : 0)));
  return (
    <div className="flex flex-col gap-2">
      <div data-testid="dashboard-history-chart" className="flex flex-col" role="img" aria-label="Потребление и выдача по месяцам">
        <div className="relative flex h-36 items-end border-b border-border">
          <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4].map((line) => <span key={line} className="border-t border-border/70" />)}
          </div>
          {months.map((m) => (
            <div key={m.month} className="group relative z-[1] flex h-full min-w-0 flex-1 items-end justify-center gap-px px-px" title={`${monthLabel(m.month)}: потребление ${mwh(m.offtakeKwh ?? 0)}, выдача ${mwh(m.injectionKwh ?? 0)}`}>
              {m.state === 'MISSING' ? (
                <span className="h-full w-full rounded-t-xs border border-dashed border-status-blocked-border bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgb(var(--el-error-subtle))_4px_8px)]" />
              ) : (
                <>
                  {offtake && <span className="w-[42%] max-w-5 rounded-t-xs bg-primary" style={{ height: `${Math.max(1.5, ((m.offtakeKwh ?? 0) / max) * 100)}%` }} />}
                  {injection && <span className="w-[42%] max-w-5 rounded-t-xs bg-accent" style={{ height: `${Math.max(1.5, ((m.injectionKwh ?? 0) / max) * 100)}%` }} />}
                </>
              )}
            </div>
          ))}
        </div>
        <div aria-hidden className="flex h-4">
          {months.map((m, i) => (
            <span key={m.month} className="flex min-w-0 flex-1 justify-center whitespace-nowrap font-mono text-[9px] text-text-muted">
              {months.length <= 12 || [0, 5, 11, 17, months.length - 1].includes(i) ? monthLabel(m.month) : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-secondary">
        {offtake && <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-xs bg-primary" />Потребление (offtake)</span>}
        {injection && <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-xs bg-accent" />Выдача в сеть (injection)</span>}
        <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-xs border border-dashed border-status-blocked-border" />Нет данных</span>
      </div>
    </div>
  );
}

/** Блок 1. История учёта: потребление, выдача, договорные ограничения, период, качество. */
export function HistoryBlock({ block, data }: { block: DashboardBlockConfig; data: DashboardData }) {
  const r = data.invoice;
  const w = block.widgets;
  if (!r?.window) return <p className="text-body-sm text-text-muted">Нет истории учёта объекта – загрузите invoice.csv на этапе 1.</p>;
  const all = r.window.months.slice(-(PERIOD_MONTHS[block.period] ?? 24));
  const months = block.filter === 'ISSUES' ? all.filter((m) => m.state !== 'FULL' || m.duplicates > 0 || m.issues > 0) : all;
  const showOff = w.offtake_history && block.metrics.includes('offtake');
  const showInj = w.injection_history && block.metrics.includes('injection');
  const totalOff = all.reduce((s, m) => s + (m.offtakeKwh ?? 0), 0);
  const totalInj = all.reduce((s, m) => s + (m.injectionKwh ?? 0), 0);
  const caOff = r.fields.find((f) => f.field === 'Grid.power_kW.CA_offtake');
  const caInj = r.fields.find((f) => f.field === 'Grid.power_kW.CA_injection');
  const stage = data.session.stages.METER_HISTORY;

  return (
    <>
      {(showOff || showInj) && (
        <Widget title="Потребление и выдача по месяцам" aside={<span className="text-caption text-text-muted">{block.period === '24M' ? '24 мес.' : block.period === '12M' ? '12 мес.' : '6 мес.'}</span>}>
          <div className="grid grid-cols-2 gap-4">
            {showOff && <Stat label="Потребление за период" value={mwh(totalOff)} />}
            {showInj && <Stat label="Выдача за период" value={mwh(totalInj)} />}
          </div>
          {all.length > 0 && <MonthlyChart months={all} offtake={!!showOff} injection={!!showInj} />}
        </Widget>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {w.contract_limits && (
          <Widget title="Договорные ограничения">
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Потребление (CA)" value={`${num(caOff?.max ?? null, 0)} кВт`} />
              <Stat label="Выдача (CA)" value={`${num(caInj?.min ?? null, 0)} кВт`} />
            </dl>
          </Widget>
        )}
        {w.period && (
          <Widget title="Период">
            <p className="text-body-sm">
              <span className="font-mono">{utc(r.window.from).slice(0, 10)}</span> – <span className="font-mono">{utc(r.window.to).slice(0, 10)}</span>
            </p>
            <p className="text-caption text-text-muted">
              Покрытие {r.window.months.length - r.missingMonths.length} из {r.window.months.length} мес. · шаг {r.detectedStepMinutes ?? '–'} мин
            </p>
          </Widget>
        )}
      </div>
      {w.data_quality && (
        <Widget title="Качество исходных данных" aside={<StatusBadge status={stage.status} size="sm" />}>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Полнота" value={`${num(r.completeness.pct, 2)} %`} tone={r.completeness.pct >= 100 ? 'ok' : 'bad'} />
            <Stat label="Нет данных, мес." value={r.missingMonths.length} tone={r.missingMonths.length ? 'bad' : 'ok'} />
            <Stat label="Дубли" value={r.duplicates} tone={r.duplicates ? 'warn' : 'ok'} />
          </div>
          {r.missingMonths.length > 0 && <p className="font-mono text-caption text-status-blocked">{r.missingMonths.join(', ')}</p>}
        </Widget>
      )}
      {w.monthly_table && (
        <Widget title={block.filter === 'ISSUES' ? 'Месяцы с замечаниями' : 'По месяцам'}>
          {months.length === 0 ? (
            <p className="text-caption text-text-muted">Замечаний нет.</p>
          ) : (
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                    <th className="py-1.5 pr-2 font-normal">Месяц</th>
                    <th className="px-2 text-right font-normal">Потребл., кВт·ч</th>
                    <th className="px-2 text-right font-normal">Выдача, кВт·ч</th>
                    <th className="pl-2 font-normal">Данные</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.month} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-2">{monthLabel(m.month)}</td>
                      <td className="px-2 text-right font-mono">{num(m.offtakeKwh ?? 0, 0)}</td>
                      <td className="px-2 text-right font-mono">{num(m.injectionKwh ?? 0, 0)}</td>
                      <td className={cn('pl-2', m.state === 'FULL' ? 'text-status-completed' : m.state === 'MISSING' ? 'text-status-blocked' : 'text-warning')}>{m.state === 'FULL' ? 'полный' : m.state === 'MISSING' ? 'нет данных' : 'пропуски'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Widget>
      )}
    </>
  );
}
