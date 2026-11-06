import * as React from 'react';
import type { ControlTestCommand } from '@/types';
import { secBetween } from './labels';

const W = 720;
const H = 260;
const PAD = { l: 52, r: 16, t: 16, b: 32 };

const C = {
  actual: 'rgb(var(--el-text-primary))',
  setpoint: 'rgb(var(--el-accent))',
  band: 'rgb(var(--el-accent) / 0.12)',
  window: 'rgb(var(--el-info) / 0.07)',
  grid: 'rgb(var(--el-border))',
  axis: 'rgb(var(--el-text-muted))',
  sent: 'rgb(var(--el-info))',
  ok: 'rgb(var(--el-status-completed-solid))',
  bad: 'rgb(var(--el-status-blocked-solid))',
  warn: 'rgb(var(--el-warning))',
};

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** График setpoint и фактической мощности: полоса допуска, окно ожидания, моменты отправки, приёма и отклика. */
export function ControlChart({ command: c }: { command: ControlTestCommand }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  if (!c.samples.length) {
    return <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-body-sm text-text-muted">Команда не отправлялась – графика отклика нет.</p>;
  }
  const ackSec = secBetween(c.sentAt, c.receivedAt);
  const respSec = secBetween(c.sentAt, c.respondedAt);
  const t0 = c.samples[0]!.t;
  const t1 = c.samples.at(-1)!.t;
  const values = [...c.samples.map((s) => s.actualKw), c.input.valueKw, c.expected.lowerKw, c.expected.upperKw, c.input.baselineKw];
  const pad = Math.max(2, (Math.max(...values) - Math.min(...values)) * 0.12);
  const yMin = Math.min(...values) - pad;
  const yMax = Math.max(...values) + pad;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const actualPath = c.samples.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.actualKw).toFixed(1)}`).join('');
  const sp = c.samples.filter((s) => s.setpointKw !== null);
  const setpointPath = sp.length ? `M${x(sp[0]!.t).toFixed(1)},${y(sp[0]!.setpointKw!).toFixed(1)}H${x(t1).toFixed(1)}` : '';
  const windowEnd = ackSec !== null ? ackSec + c.expected.responseWindowSec : c.expected.ackTimeoutSec;
  const resultColor = c.state === 'PASSED' ? C.ok : c.state === 'TIMEOUT' ? C.warn : C.bad;
  const hs = hover !== null ? c.samples.find((s) => s.t === hover) : undefined;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = Math.round(t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0));
    setHover(t >= t0 && t <= t1 ? t : null);
  };

  const marker = (t: number | null, label: string, color: string, dy = 0) =>
    t === null ? null : (
      <g key={label}>
        <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
        <text x={x(t) + 4} y={PAD.t + 10 + dy} fontSize={10} fill={color} fontFamily="var(--font-mono, monospace)">
          {label}
        </text>
      </g>
    );

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-secondary">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-text-primary" />Фактическая мощность</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 border-t-2 border-dashed border-accent" />Setpoint (принятый)</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-xs bg-accent/15" />Полоса допуска</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-4 rounded-xs bg-info/10" />Ожидаемый интервал отклика</span>
      </div>
      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img" aria-label={`График setpoint и фактической мощности команды ${c.commandId}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {niceTicks(yMin, yMax).map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={C.grid} strokeWidth={1} />
              <text x={PAD.l - 6} y={y(v) + 3} fontSize={10} textAnchor="end" fill={C.axis}>{v}</text>
            </g>
          ))}
          {niceTicks(t0, t1, 8).map((t) => (
            <text key={t} x={x(t)} y={H - PAD.b + 14} fontSize={10} textAnchor="middle" fill={C.axis}>{t} с</text>
          ))}
          <rect x={x(ackSec ?? 0)} y={PAD.t} width={Math.max(0, x(Math.min(windowEnd, t1)) - x(ackSec ?? 0))} height={H - PAD.t - PAD.b} fill={C.window} />
          {ackSec !== null && <rect x={x(ackSec)} y={y(c.expected.upperKw)} width={x(t1) - x(ackSec)} height={Math.max(1, y(c.expected.lowerKw) - y(c.expected.upperKw))} fill={C.band} />}
          {setpointPath && <path d={setpointPath} stroke={C.setpoint} strokeWidth={1.75} strokeDasharray="6 4" fill="none" />}
          <path d={actualPath} stroke={C.actual} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
          {marker(0, 'Sent', C.sent)}
          {marker(ackSec, 'Received', C.sent, 12)}
          {marker(respSec, c.state === 'PASSED' ? 'Responded' : 'Отклик (поздно)', c.state === 'PASSED' ? C.ok : C.warn, 24)}
          {marker(Math.min(windowEnd, t1), c.state === 'PASSED' ? 'Конец окна' : c.state === 'TIMEOUT' ? 'Timeout' : 'Failed', resultColor, 36)}
          {hs && (
            <g>
              <line x1={x(hs.t)} x2={x(hs.t)} y1={PAD.t} y2={H - PAD.b} stroke={C.axis} strokeWidth={1} />
              <circle cx={x(hs.t)} cy={y(hs.actualKw)} r={3} fill={C.actual} />
            </g>
          )}
        </svg>
        {hs && (
          <div className="pointer-events-none absolute top-2 rounded-md bg-surface-inverse px-2.5 py-1.5 font-mono text-[11px] text-text-inverse shadow-md" style={{ left: `${Math.min(80, (x(hs.t) / W) * 100)}%` }}>
            t = {hs.t} с · факт {hs.actualKw} кВт{hs.setpointKw !== null && ` · setpoint ${hs.setpointKw} кВт`}
          </div>
        )}
      </div>
    </figure>
  );
}
