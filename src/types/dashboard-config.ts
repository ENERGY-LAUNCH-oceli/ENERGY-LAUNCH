import type { Id, IsoDateTime } from './common';

/**
 * Этап 4 – настройка и приёмка финальной рабочей панели объекта (фаза 09).
 * Четыре обязательных блока; конфигурация версионируется, приёмка ссылается на опубликованную версию.
 */

export const DASHBOARD_BLOCK_IDS = ['METER_HISTORY', 'ASSETS', 'CONTROL', 'QUALITY_STATUS'] as const;
export type DashboardBlockId = (typeof DASHBOARD_BLOCK_IDS)[number];

/** Демонстрационные роли этапа 4. */
export const DEMO_ROLES = ['LAUNCH_ENGINEER', 'OPERATOR', 'ACCEPTANCE_OFFICER'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

/** Действия, которые проверяются на уровне логики приложения, а не только в интерфейсе. */
export const ACCESS_ACTIONS = ['dashboard.view', 'dashboard.edit', 'dashboard.publish', 'dashboard.accept', 'launch.manage'] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

/** Настройка одного блока панели. Разрешённые значения задаёт каталог блоков. */
export interface DashboardBlockConfig {
  id: DashboardBlockId;
  /** Включённые виджеты блока. */
  widgets: Record<string, boolean>;
  /** Выбранные показатели (ряды). */
  metrics: string[];
  period: string;
  filter: string;
}

export interface DashboardConfig {
  /** Объект, к которому привязана панель. Данные других объектов не допускаются. */
  objectId: Id;
  title: string;
  /** Номер версии: у черновика – следующая версия, у опубликованной – зафиксированная. */
  version: number;
  /** Порядок блоков = порядок массива. Все четыре блока обязательны. */
  blocks: DashboardBlockConfig[];
  updatedAt: IsoDateTime;
  updatedBy: string;
  publishedAt?: IsoDateTime;
  publishedBy?: string;
}

export type AcceptanceResult = 'ACCEPTED' | 'REJECTED';

/** Решение ответственного по одному блоку. */
export interface BlockReview {
  blockId: DashboardBlockId;
  correct: boolean;
  comment?: string;
}

/** Приёмка панели: автор, время, версия конфигурации, объект, результат. */
export interface DashboardAcceptance {
  id: Id;
  objectId: Id;
  configVersion: number;
  author: string;
  role: DemoRole;
  at: IsoDateTime;
  result: AcceptanceResult;
  blocks: BlockReview[];
  comment?: string;
}

/** Рабочее пространство этапа 4 в данных запуска объекта. */
export interface DashboardWorkspace {
  draft: DashboardConfig;
  /** Последняя опубликованная версия (её принимает ответственный). */
  published?: DashboardConfig;
  /** Предыдущие опубликованные версии. */
  history: DashboardConfig[];
  acceptances: DashboardAcceptance[];
}
