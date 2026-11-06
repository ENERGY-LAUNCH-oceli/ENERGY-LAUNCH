import * as React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { HeatState, TelemetryReport } from '@/types';
import { cn } from '@/utils/cn';
import { utc } from '../invoice-validation/labels';
import { DIAGNOSIS, HEAT } from './labels';

const ORDER: HeatState[] = ['G', 'S', 'D', 'M', 'I'];
const worst = (cells: string) => (cells.includes('I') ? 'I' : cells.includes('M') ? 'M' : cells.includes('D') ? 'D' : cells.includes('S') ? 'S' : 'G') as HeatState;

interface Selected {
  signal: string;
  col: number;
}

/** Data Quality Heatmap: строки — оборудование и сигналы, столбцы — интервалы окна 48 ч. */
export function QualityHeatmap({ report }: { report: TelemetryReport }) {
  const [zoom, setZoom] = React.useState<'1h' | '15m'>('1h');
  const [sel, setSel] = React.useState<Selected | null>(null);
  const rows = report.signals.filter((s) => s.required);
  const per = zoom === '1h' ? 60 / report.window.stepMinutes : 1;
  const cols = Math.ceil(report.window.slots / per);
  const from = Date.parse(report.window.from);
  const colMs = per * report.window.stepMinutes * 60_000;
  const cell = zoom === '1h' ? 14 : 5;
  const label = 190;
  const W = label + cols * (cell + 1);
  const H = rows.length * (cell + 3) + 22;
  const sig = sel && rows.find((r) => r.signal === sel.signal);
  const detail = sig && sel ? sig.heat.slice(sel.col * per, sel.col * per + per) : '';

  return (
    <section id="heatmap" aria-label="Data Quality Heatmap" className="min-w-0 scroll-mt-24 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-label uppercase text-accent-strong">Data Quality Heatmap</span>
          <h2 className="text-h3">Качество потока за {Math.round((report.window.slots * report.window.stepMinutes) / 60)} ч до точки проверки</h2>
        </div>
        <Tabs value={zoom} onValueChange={(v) => (setZoom(v as '1h' | '15m'), setSel(null))}>
          <TabsList variant="pill">
            <TabsTrigger value="1h">По часам</TabsTrigger>
            <TabsTrigger value="15m">15 мин</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap gap-4 text-caption">
        {ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ background: HEAT[k].color }} />
            {HEAT[k].label}
          </span>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg width={W} height={H} role="grid" aria-label="Тепловая карта качества" data-testid="heatmap">
          {rows.map((r, ri) => {
            const y = ri * (cell + 3);
            return (
              <g key={r.signal}>
                <text x={0} y={y + cell - 2} fontSize="10" fontFamily="JetBrains Mono, monospace" fill={r.diagnosis === 'OK' ? 'rgb(var(--el-text-secondary))' : 'rgb(var(--el-error))'}>
                  {r.signal.length > 30 ? `${r.signal.slice(0, 29)}…` : r.signal}
                </text>
                {Array.from({ length: cols }, (_, c) => {
                  const state = worst(r.heat.slice(c * per, c * per + per));
                  const active = sel?.signal === r.signal && sel.col === c;
                  return (
                    <rect
                      key={c}
                      role="gridcell"
                      aria-label={`${r.signal} ${utc(new Date(from + c * colMs).toISOString())}: ${HEAT[state].label}`}
                      data-state={state}
                      x={label + c * (cell + 1)}
                      y={y}
                      width={cell}
                      height={cell}
                      rx={2}
                      fill={HEAT[state].color}
                      opacity={state === 'G' ? 0.75 : 1}
                      stroke={active ? 'rgb(var(--el-text-primary))' : 'none'}
                      strokeWidth={2}
                      className="cursor-pointer"
                      onClick={() => setSel({ signal: r.signal, col: c })}
                    />
                  );
                })}
              </g>
            );
          })}
          {Array.from({ length: cols }, (_, c) =>
            (zoom === '1h' ? c % 6 === 0 : c % 24 === 0) ? (
              <text key={c} x={label + c * (cell + 1)} y={H - 4} fontSize="9" fill="rgb(var(--el-text-muted))">
                {utc(new Date(from + c * colMs).toISOString()).slice(0, 16)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
      {sig && sel ? (
        <div className={cn('mt-4 grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_auto]', sig.diagnosis === 'OK' ? 'border-border' : 'border-status-blocked-border')} data-testid="heatmap-detail">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-body-sm font-bold">{sig.signal}</span>
            <span className="text-caption text-text-secondary">
              {sig.owner} · {utc(new Date(from + sel.col * colMs).toISOString())} – {utc(new Date(from + (sel.col + 1) * colMs).toISOString())} UTC
            </span>
            <span className="text-caption">
              Диагноз сигнала: <b>{DIAGNOSIS[sig.diagnosis].label}</b> — {DIAGNOSIS[sig.diagnosis].hint}
            </span>
            <span className="text-caption text-text-muted">
              Последнее значение: {sig.lastTimestamp ? `${utc(sig.lastTimestamp)} UTC (${sig.ageMinutes} мин до точки проверки)` : 'нет'} · полнота {sig.completenessPct} %
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-caption">
            {detail.split('').map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="size-2.5 rounded-[2px]" style={{ background: HEAT[s as HeatState].color }} />
                <span className="tabular">{utc(new Date(from + (sel.col * per + i) * report.window.stepMinutes * 60_000).toISOString()).slice(11)}</span>
                <b>{HEAT[s as HeatState].label}</b>
                <span className="text-text-muted">{HEAT[s as HeatState].text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-caption text-text-muted">Нажмите на ячейку, чтобы увидеть интервалы и причину.</p>
      )}
    </section>
  );
}
