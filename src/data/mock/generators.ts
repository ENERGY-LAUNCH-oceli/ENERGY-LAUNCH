import type {
  ControlCommand,
  ControlCommandType,
  ControlTest,
  Dashboard,
} from '@/types';
import { DEMO_OBJECT_ID } from './demo-object';

const iso = (ms: number) => new Date(ms).toISOString();


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
