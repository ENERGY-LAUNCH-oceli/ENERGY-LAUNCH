import type {
  ControlCommand,
  ControlCommandType,
  ControlTest,
  Dashboard,
  InvoiceDataset,
  Measurement,
  TelemetryDataset,
} from '@/types';
import { createRng } from '@/utils/random';
import { DEMO_METERING_POINT_ID, DEMO_OBJECT_ID } from './demo-object';

const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Условная суточная кривая генерации СЭС, кВт·ч за интервал. */
function pvEnergy(ms: number, intervalMin: number, rng: () => number): number {
  const hour = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
  const sun = Math.max(0, Math.sin(((hour - 3) / 14) * Math.PI)); // UTC ≈ МСК-3
  return Math.round(sun * 12_000 * (intervalMin / 60) * (0.85 + rng() * 0.15) * 1000) / 1000;
}

export interface InvoiceOptions {
  periodStart: string;
  days: number;
  intervalMinutes: number;
  /** Доля пропущенных интервалов 0..1 (случайно). */
  gapRatio?: number;
  /** Сплошной пропуск: [индекс первого интервала, длина]. */
  gapRun?: [number, number];
  /** Искажение объёма по счёту, % (сверка). */
  invoiceBiasPct?: number;
  seed?: number;
}

export function generateInvoiceDataset(o: InvoiceOptions): InvoiceDataset {
  const rng = createRng(o.seed ?? 1);
  const start = Date.parse(o.periodStart);
  const count = Math.round((o.days * 24 * 60) / o.intervalMinutes);
  const measurements: Measurement[] = [];
  for (let i = 0; i < count; i++) {
    const ts = start + i * o.intervalMinutes * MIN;
    const inRun = o.gapRun ? i >= o.gapRun[0] && i < o.gapRun[0] + o.gapRun[1] : false;
    const missing = inRun || rng() < (o.gapRatio ?? 0);
    measurements.push({
      signalId: 'sig-energy-export',
      timestamp: iso(ts),
      value: missing ? null : pvEnergy(ts, o.intervalMinutes, rng),
      unit: 'kWh',
      quality: missing ? 'MISSING' : 'GOOD',
    });
  }
  const end = start + count * o.intervalMinutes * MIN;
  const metered = measurements.reduce((s, m) => s + (m.value ?? 0), 0);
  const invoiced = Math.round(metered * (1 + (o.invoiceBiasPct ?? 0) / 100) * 1000) / 1000;

  return {
    kind: 'INVOICE',
    id: `ds-invoice-${o.seed ?? 1}`,
    objectId: DEMO_OBJECT_ID,
    source: 'DEMO',
    importedAt: iso(end),
    periodStart: iso(start),
    periodEnd: iso(end),
    invoiceNumber: 'DEMO-INV-0001',
    supplier: 'Демо-гарантирующий поставщик',
    lines: [{ id: 'inv-line-1', meteringPointId: DEMO_METERING_POINT_ID, periodStart: iso(start), periodEnd: iso(end), energyKwh: invoiced }],
    meterSeries: [{ meteringPointId: DEMO_METERING_POINT_ID, signalId: 'sig-energy-export', measurements }],
  };
}

export interface TelemetryOptions {
  periodStart: string;
  hours: number;
  frequencySec: number;
  signalIds: string[];
  /** Базовая задержка доставки, с. */
  latencySec?: number;
  /** Доля «медленных» сообщений и их задержка. */
  lateRatio?: number;
  lateLatencySec?: number;
  dropRatio?: number;
  seed?: number;
}

export function generateTelemetryDataset(o: TelemetryOptions): TelemetryDataset {
  const rng = createRng(o.seed ?? 7);
  const start = Date.parse(o.periodStart);
  const count = Math.round((o.hours * 3600) / o.frequencySec);
  const units: Record<string, Measurement['unit']> = { 'sig-p': 'MW', 'sig-q': 'Mvar', 'sig-u': 'kV', 'sig-f': 'Hz', 'sig-brk': 'state' };
  const base: Record<string, number> = { 'sig-p': 10, 'sig-q': 1.5, 'sig-u': 115, 'sig-f': 50, 'sig-brk': 1 };
  const measurements: Measurement[] = [];
  for (const signalId of o.signalIds) {
    for (let i = 0; i < count; i++) {
      if (rng() < (o.dropRatio ?? 0)) continue;
      const ts = start + i * o.frequencySec * 1000;
      const late = rng() < (o.lateRatio ?? 0);
      const latency = late ? (o.lateLatencySec ?? 120) : (o.latencySec ?? 2) * (0.5 + rng());
      const b = base[signalId] ?? 1;
      measurements.push({
        signalId,
        timestamp: iso(ts),
        value: signalId === 'sig-brk' ? 1 : Math.round(b * (0.98 + rng() * 0.04) * 1000) / 1000,
        unit: units[signalId] ?? 'MW',
        quality: 'GOOD',
        receivedAt: iso(ts + latency * 1000),
      });
    }
  }
  return {
    kind: 'TELEMETRY',
    id: `ds-telemetry-${o.seed ?? 7}`,
    objectId: DEMO_OBJECT_ID,
    source: 'DEMO',
    importedAt: iso(start + count * o.frequencySec * 1000),
    periodStart: iso(start),
    periodEnd: iso(start + count * o.frequencySec * 1000),
    measurements,
  };
}

export interface ControlOptions {
  startAt: string;
  intervalSec: number;
  ackSec?: number;
  execSec?: number;
  /** Отклонение обратной связи от уставки, %. */
  feedbackErrorPct?: number;
  /** Тип команды, которая завершится TIMEOUT. */
  timeoutType?: ControlCommandType;
}

export function generateControlTests(o: ControlOptions): ControlTest[] {
  const plan: Array<{ type: ControlCommandType; assetId: string; signalId: string; target?: number }> = [
    { type: 'ACTIVE_POWER_SETPOINT', assetId: 'asset-ctrl-1', signalId: 'sig-p-sp', target: 10 },
    { type: 'ACTIVE_POWER_SETPOINT', assetId: 'asset-ctrl-1', signalId: 'sig-p-sp', target: 5 },
    { type: 'REACTIVE_POWER_SETPOINT', assetId: 'asset-ctrl-1', signalId: 'sig-q-sp', target: 2 },
    { type: 'STOP', assetId: 'asset-ctrl-1', signalId: 'sig-p-sp' },
    { type: 'START', assetId: 'asset-ctrl-1', signalId: 'sig-p-sp' },
  ];
  const start = Date.parse(o.startAt);
  const commands: ControlCommand[] = plan.map((p, i) => {
    const issued = start + i * o.intervalSec * 1000;
    const timeout = o.timeoutType === p.type;
    const cmd: ControlCommand = {
      id: `cmd-${i + 1}`,
      assetId: p.assetId,
      signalId: p.signalId,
      type: p.type,
      issuedAt: iso(issued),
      acknowledgedAt: iso(issued + (o.ackSec ?? 1) * 1000),
      status: timeout ? 'TIMEOUT' : 'EXECUTED',
      issuedBy: 'demo-dispatcher',
    };
    if (p.target !== undefined) {
      cmd.targetValue = p.target;
      cmd.unit = p.type === 'REACTIVE_POWER_SETPOINT' ? 'Mvar' : 'MW';
      if (!timeout) cmd.feedbackValue = Math.round(p.target * (1 + (o.feedbackErrorPct ?? 0.5) / 100) * 1000) / 1000;
    }
    if (!timeout) cmd.executedAt = iso(issued + (o.execSec ?? 20) * 1000);
    return cmd;
  });
  const failed = commands.some((c) => c.status !== 'EXECUTED');
  return [
    {
      id: 'ct-demo-1',
      objectId: DEMO_OBJECT_ID,
      assetId: 'asset-ctrl-1',
      name: 'Программа испытаний управления PPC',
      status: failed ? 'FAILED' : 'PASSED',
      commands,
      startedAt: commands[0]?.issuedAt,
      finishedAt: commands.at(-1)?.executedAt ?? commands.at(-1)?.issuedAt,
    } as ControlTest,
  ];
}

export function generateDashboards(o: { published: boolean; omitAlerts?: boolean }): Dashboard[] {
  const blocks: Dashboard['blocks'] = [
    { id: 'blk-kpi', type: 'KPI', title: 'Выработка', signalIds: ['sig-energy-export'], signalKinds: ['ENERGY_EXPORT'], layout: { x: 0, y: 0, w: 4, h: 2 } },
    { id: 'blk-ts', type: 'TIME_SERIES', title: 'P / Q', signalIds: ['sig-p', 'sig-q'], signalKinds: ['ACTIVE_POWER', 'REACTIVE_POWER'], layout: { x: 4, y: 0, w: 8, h: 4 } },
    { id: 'blk-status', type: 'STATUS', title: 'Состояние выключателя', signalIds: ['sig-brk'], signalKinds: ['BREAKER_STATE'], layout: { x: 0, y: 2, w: 4, h: 2 } },
  ];
  if (!o.omitAlerts) blocks.push({ id: 'blk-alerts', type: 'ALERTS', title: 'События', signalIds: [], signalKinds: [], layout: { x: 0, y: 4, w: 12, h: 3 } });
  return [
    {
      id: 'dash-owner',
      objectId: DEMO_OBJECT_ID,
      title: 'Панель владельца',
      audience: 'OWNER',
      blocks,
      ...(o.published ? { publishedAt: '2026-11-04T12:00:00.000Z' } : {}),
    },
  ];
}
