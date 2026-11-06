import { acceptDashboard, changeDashboard, createDashboardWorkspace, publishDashboard, type DashboardActor } from '@/engine/dashboards';
import { DASHBOARD_BLOCK_IDS, type DashboardBlockId, type DashboardWorkspace } from '@/types';

export interface DashboardPlan {
  objectId: string;
  at: string;
  engineer: string;
  officer?: string;
  publish?: boolean;
  /** Решение ответственного по опубликованной версии. */
  review?: 'ACCEPT' | 'REJECT';
  /** Выключить виджеты перед публикацией (демо некорректного блока). */
  disable?: { blockId: DashboardBlockId; widgetId: string }[];
}

/**
 * Демо-панель объекта: проходит те же функции движка с проверкой прав, что и действия в интерфейсе
 * (инженер настраивает и публикует, ответственный принимает). Время и ID фиксированы.
 */
export function buildDashboardWorkspace(p: DashboardPlan): DashboardWorkspace {
  let seq = 0;
  const actor = (name: string, role: DashboardActor['role'], minutes: number): DashboardActor => ({ name, role, now: new Date(Date.parse(p.at) + minutes * 60_000).toISOString(), newId: () => `${p.objectId}-acc-${++seq}` });
  let ws = createDashboardWorkspace(p.objectId, p.at, p.engineer);
  for (const d of p.disable ?? []) ws = changeDashboard(ws, { kind: 'toggleWidget', blockId: d.blockId, widgetId: d.widgetId, enabled: false }, actor(p.engineer, 'LAUNCH_ENGINEER', 1));
  if (!p.publish) return ws;
  ws = publishDashboard(ws, p.objectId, actor(p.engineer, 'LAUNCH_ENGINEER', 2));
  if (!p.review) return ws;
  const disabled = new Set((p.disable ?? []).map((d) => d.blockId));
  const reject = p.review === 'REJECT';
  return acceptDashboard(
    ws,
    p.objectId,
    {
      result: reject ? 'REJECTED' : 'ACCEPTED',
      blocks: DASHBOARD_BLOCK_IDS.map((blockId) => (reject && disabled.has(blockId) ? { blockId, correct: false, comment: 'Нет обязательного показателя' } : { blockId, correct: true })),
      ...(reject ? { comment: 'Блок неполный – доработать и опубликовать заново' } : {}),
    },
    actor(p.officer ?? 'Ответственный за приёмку', 'ACCEPTANCE_OFFICER', 5),
  ).ws;
}
