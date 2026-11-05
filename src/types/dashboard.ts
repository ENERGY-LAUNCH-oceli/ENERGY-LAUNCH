import type { Id, IsoDateTime } from './common';
import type { SignalKind } from './object';

export const DASHBOARD_BLOCK_TYPES = [
  'KPI',
  'TIME_SERIES',
  'TABLE',
  'STATUS',
  'ALERTS',
  'MAP',
] as const;
export type DashboardBlockType = (typeof DASHBOARD_BLOCK_TYPES)[number];

export const DASHBOARD_AUDIENCES = ['OWNER', 'OPERATOR', 'GRID_OPERATOR'] as const;
export type DashboardAudience = (typeof DASHBOARD_AUDIENCES)[number];

export interface DashboardBlockLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardBlock {
  id: Id;
  type: DashboardBlockType;
  title: string;
  /** Привязанные сигналы объекта. */
  signalIds: Id[];
  /** Виды сигналов, которые блок отображает (для проверки покрытия). */
  signalKinds: SignalKind[];
  layout: DashboardBlockLayout;
}

/** Итоговая панель мониторинга (этап 4, Final Dashboards). */
export interface Dashboard {
  id: Id;
  objectId: Id;
  title: string;
  audience: DashboardAudience;
  blocks: DashboardBlock[];
  publishedAt?: IsoDateTime;
}
