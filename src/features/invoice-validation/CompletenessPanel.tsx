import type { InvoiceReport } from '@/types';
import { cn } from '@/utils/cn';
import { coverageMonths, monthLabel } from './labels';

/** Полнота по месяцам: столбик = доля фактических интервалов; линия – порог из правил. */
export function CompletenessPanel({ report, minPct, stepMinutes }: { report: InvoiceReport | undefined; minPct: number; stepMinutes: number }) {
  const months = coverageMonths(report?.window?.months ?? []);
  const c = report?.completeness;
  const W = 720;
  const H = 150;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const bw = months.length ? (W - pad.l - pad.r) / months.length : 0;
  const y = (pct: number) => pad.t + (1 - pct / 100) * (H - pad.t - pad.b);
  return (
    <section id="completeness" aria-label="Полнота" className="min-w-0 scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-col gap-0.5">
        <span className="text-label text-text-muted">Completeness</span>
        <h2 className="text-h3">Полнота {stepMinutes}-минутных интервалов</h2>
      </div>
      {c ? (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Ожидается интервалов', c.expected.toLocaleString('ru-RU'), ''],
              ['Фактически', c.present.toLocaleString('ru-RU'), ''],
              ['Пропущено', c.missing.toLocaleString('ru-RU'), c.missing ? 'text-status-blocked' : ''],
              ['Полнота', `${c.pct.toLocaleString('ru-RU')} %`, c.pct < minPct ? 'text-status-blocked' : 'text-status-completed'],
            ].map(([k, v, cls]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-sm bg-surface-secondary px-3 py-2">
                <dt className="text-caption text-text-muted">{k}</dt>
                <dd className={cn('tabular text-body font-medium', cls)}>{v}</dd>
              </div>
            ))}
          </dl>
          {report.detectedStepMinutes && report.detectedStepMinutes !== stepMinutes && (
            <p className="mb-3 rounded-sm border border-warning-border bg-warning-subtle px-3 py-2 text-caption text-text-secondary">
              Исходный шаг – {report.detectedStepMinutes} мин. Данные хранятся в исходной детализации: интервалы не досоздаются, поэтому полнота {stepMinutes}-минутного ряда не подтверждена.
            </p>
          )}
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Полнота по месяцам">
              {[0, 50, 100].map((p) => (
                <g key={p}>
                  <line x1={pad.l} x2={W - pad.r} y1={y(p)} y2={y(p)} stroke="rgb(var(--el-border))" strokeWidth="1" />
                  <text x={pad.l - 6} y={y(p) + 3} textAnchor="end" fontSize="9" fill="rgb(var(--el-text-muted))">
                    {p}%
                  </text>
                </g>
              ))}
              {months.map((m, i) => {
                const pct = m.expected ? (m.present / m.expected) * 100 : 0;
                const fill = m.state === 'FULL' ? 'rgb(var(--el-status-completed-solid))' : m.state === 'PARTIAL' ? 'rgb(var(--el-warning))' : 'rgb(var(--el-status-blocked-solid))';
                return (
                  <g key={m.month}>
                    <title>{`${m.month}: ${Math.floor(pct * 100) / 100}%`}</title>
                    {m.state === 'MISSING' ? (
                      <rect x={pad.l + i * bw + 2} y={y(100)} width={bw - 4} height={H - pad.b - y(100)} fill="none" stroke={fill} strokeDasharray="3 3" rx="2" />
                    ) : (
                      <rect x={pad.l + i * bw + 2} y={y(pct)} width={bw - 4} height={Math.max(1, H - pad.b - y(pct))} fill={fill} rx="2" />
                    )}
                    {i % 3 === 0 && (
                      <text x={pad.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="rgb(var(--el-text-muted))">
                        {monthLabel(m.month)}
                      </text>
                    )}
                  </g>
                );
              })}
              <line x1={pad.l} x2={W - pad.r} y1={y(minPct)} y2={y(minPct)} stroke="rgb(var(--el-text-primary))" strokeDasharray="4 3" strokeWidth="1.2" />
              <text x={W - pad.r} y={y(minPct) - 4} textAnchor="end" fontSize="9" fill="rgb(var(--el-text-primary))">
                порог {minPct}%
              </text>
            </svg>
          </div>
        </>
      ) : (
        <p className="text-body-sm text-text-secondary">Нет данных – полнота не рассчитана.</p>
      )}
    </section>
  );
}
