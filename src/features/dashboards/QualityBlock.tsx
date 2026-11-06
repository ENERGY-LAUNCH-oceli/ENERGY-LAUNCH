import { StatusBadge } from '@/components/ui/status-badge';
import { AUDIT_ACTION_LABEL } from '@/config/labels';
import { STAGE_META } from '@/config/stages';
import { STAGE_IDS, type DashboardBlockConfig } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { Stat, Widget } from './BlockFrame';
import { num, type DashboardData } from './data';

/** Блок 4. Качество данных и статус запуска. */
export function QualityBlock({ block, data }: { block: DashboardBlockConfig; data: DashboardData }) {
  const w = block.widgets;
  const r = data.invoice;
  const t = data.telemetry;
  const req = t?.signals.filter((s) => s.required) ?? [];
  const okSignals = req.filter((s) => s.diagnosis === 'OK').length;
  const minPct = req.length ? Math.min(...req.map((s) => s.completenessPct)) : null;
  const stages = STAGE_IDS.filter((id) => block.filter !== 'OPEN' || data.blockers.some((b) => b.stageId === id));

  return (
    <>
      {w.stage_statuses && (
        <Widget title="Статус этапов">
          <ol className="grid gap-2 sm:grid-cols-2">
            {STAGE_IDS.map((id, i) => (
              <li key={id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="truncate text-body-sm">
                  <span className="font-mono text-caption text-text-muted">0{i + 1}</span> {STAGE_META[id].titleRu}
                </span>
                <StatusBadge status={data.session.stages[id].status} size="sm" />
              </li>
            ))}
          </ol>
        </Widget>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {w.history_quality && (
          <Widget title="Качество истории">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Полнота" value={r ? `${num(r.completeness.pct, 2)} %` : '–'} tone={r ? (r.completeness.pct >= 100 ? 'ok' : 'bad') : undefined} />
              <Stat label="Покрытие" value={r?.window ? `${r.window.months.length - r.missingMonths.length}/${r.window.months.length}` : '–'} tone={r && r.missingMonths.length ? 'bad' : 'ok'} />
            </div>
          </Widget>
        )}
        {w.telemetry_quality && (
          <Widget title="Качество телеметрии">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Мин. полнота 48 ч" value={minPct !== null ? `${num(minPct, 1)} %` : '–'} tone={minPct !== null ? (minPct >= 99 ? 'ok' : 'bad') : undefined} />
              <Stat label="Сигналы в норме" value={t ? `${okSignals}/${req.length}` : '–'} tone={t ? (okSignals === req.length ? 'ok' : 'bad') : undefined} />
            </div>
          </Widget>
        )}
      </div>
      {w.open_blockers && (
        <Widget title={`Незакрытые препятствия · ${data.blockers.length}`}>
          {data.blockers.length ? (
            <ul className="flex flex-col gap-1 text-caption">
              {data.blockers.slice(0, 6).map((b) => (
                <li key={b.id} className="text-status-blocked">
                  <span className="font-mono">{b.ruleId ?? 'Ручное'}</span> · {b.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-status-completed">Открытых препятствий нет</p>
          )}
        </Widget>
      )}
      {w.check_results && (
        <Widget title="Результаты проверок">
          <table className="w-full text-caption">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                <th className="py-1.5 pr-2 font-normal">Этап</th>
                <th className="px-2 text-right font-normal">Пройдено</th>
                {block.metrics.includes('failed') && <th className="px-2 text-right font-normal">Ошибки</th>}
                {block.metrics.includes('warnings') && <th className="pl-2 text-right font-normal">Предупр.</th>}
              </tr>
            </thead>
            <tbody>
              {stages.map((id) => {
                const s = data.stats[id];
                return (
                  <tr key={id} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-2">{STAGE_META[id].titleRu}</td>
                    <td className="px-2 text-right font-mono">{s.passed}/{s.applicable}</td>
                    {block.metrics.includes('failed') && <td className={cn('px-2 text-right font-mono', s.failed && 'text-status-blocked')}>{s.failed}</td>}
                    {block.metrics.includes('warnings') && <td className={cn('pl-2 text-right font-mono', s.warnings && 'text-warning')}>{s.warnings}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Widget>
      )}
      {w.audit_feed && (
        <Widget title="Последние события">
          <ul className="flex flex-col gap-1 text-caption">
            {[...data.audit].reverse().slice(0, 5).map((e) => (
              <li key={e.id} className="flex justify-between gap-2">
                <span>{AUDIT_ACTION_LABEL[e.action]}</span>
                <span className="font-mono text-text-muted">{formatDateTime(e.timestamp)}</span>
              </li>
            ))}
          </ul>
        </Widget>
      )}
    </>
  );
}
