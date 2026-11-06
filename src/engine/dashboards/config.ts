import { DASHBOARD_BLOCK_IDS, type BlockReview, type DashboardAcceptance, type DashboardBlockConfig, type DashboardBlockId, type DashboardConfig, type DashboardWorkspace, type DemoRole } from '@/types';
import { assertCan } from './access';
import { BLOCK_CATALOG } from './catalog';

/** Кто и когда выполняет действие. */
export interface DashboardActor {
  name: string;
  role: DemoRole;
  now: string;
  newId: () => string;
}

export class DashboardRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardRuleError';
  }
}

const defaultBlock = (id: DashboardBlockId): DashboardBlockConfig => {
  const def = BLOCK_CATALOG[id];
  return { id, widgets: Object.fromEntries(def.widgets.map((w) => [w.id, true])), ...def.defaults, metrics: [...def.defaults.metrics] };
};

/** Черновик по умолчанию: четыре обязательных блока, все разрешённые виджеты включены. */
export function createDashboardWorkspace(objectId: string, at: string, by: string): DashboardWorkspace {
  return {
    draft: { objectId, title: 'Рабочая панель объекта', version: 1, blocks: DASHBOARD_BLOCK_IDS.map(defaultBlock), updatedAt: at, updatedBy: by },
    history: [],
    acceptances: [],
  };
}

/** Ошибки формы конфигурации: только разрешённые виджеты, показатели, периоды, фильтры; все четыре блока. */
export function configShapeErrors(config: DashboardConfig): string[] {
  const errors: string[] = [];
  const ids = config.blocks.map((b) => b.id);
  for (const id of DASHBOARD_BLOCK_IDS) if (!ids.includes(id)) errors.push(`Нет обязательного блока «${BLOCK_CATALOG[id].title}»`);
  if (new Set(ids).size !== ids.length) errors.push('Блоки повторяются');
  for (const b of config.blocks) {
    const def = BLOCK_CATALOG[b.id];
    if (!def) {
      errors.push(`Неизвестный блок ${String(b.id)}`);
      continue;
    }
    for (const w of Object.keys(b.widgets)) if (!def.widgets.some((x) => x.id === w)) errors.push(`${def.title}: виджет «${w}» не разрешён`);
    for (const m of b.metrics) if (!def.metrics.some((x) => x.id === m)) errors.push(`${def.title}: показатель «${m}» не разрешён`);
    if (!def.periods.some((x) => x.id === b.period)) errors.push(`${def.title}: период «${b.period}» не разрешён`);
    if (!def.filters.some((x) => x.id === b.filter)) errors.push(`${def.title}: фильтр «${b.filter}» не разрешён`);
    if (!b.metrics.length) errors.push(`${def.title}: не выбран ни один показатель`);
  }
  return errors;
}

export type DashboardChange =
  | { kind: 'toggleWidget'; blockId: DashboardBlockId; widgetId: string; enabled: boolean }
  | { kind: 'moveBlock'; blockId: DashboardBlockId; direction: -1 | 1 }
  | { kind: 'setMetrics'; blockId: DashboardBlockId; metrics: string[] }
  | { kind: 'setPeriod'; blockId: DashboardBlockId; period: string }
  | { kind: 'setFilter'; blockId: DashboardBlockId; filter: string }
  | { kind: 'reset' };

/** Изменение черновика. Право – dashboard.edit; недопустимое значение отклоняется. */
export function changeDashboard(ws: DashboardWorkspace, change: DashboardChange, actor: DashboardActor): DashboardWorkspace {
  assertCan(actor.role, 'dashboard.edit');
  let blocks = ws.draft.blocks.map((b) => ({ ...b, widgets: { ...b.widgets }, metrics: [...b.metrics] }));
  const idx = change.kind === 'reset' ? -1 : blocks.findIndex((b) => b.id === change.blockId);
  if (change.kind !== 'reset' && idx < 0) throw new DashboardRuleError('Блок не найден');
  switch (change.kind) {
    case 'reset':
      blocks = DASHBOARD_BLOCK_IDS.map(defaultBlock);
      break;
    case 'toggleWidget':
      blocks[idx]!.widgets[change.widgetId] = change.enabled;
      break;
    case 'moveBlock': {
      const to = idx + change.direction;
      if (to < 0 || to >= blocks.length) return ws;
      [blocks[idx], blocks[to]] = [blocks[to]!, blocks[idx]!];
      break;
    }
    case 'setMetrics':
      blocks[idx]!.metrics = change.metrics;
      break;
    case 'setPeriod':
      blocks[idx]!.period = change.period;
      break;
    case 'setFilter':
      blocks[idx]!.filter = change.filter;
      break;
  }
  const draft: DashboardConfig = { ...ws.draft, blocks, updatedAt: actor.now, updatedBy: actor.name };
  const errors = configShapeErrors(draft);
  if (errors.length) throw new DashboardRuleError(errors[0]!);
  return { ...ws, draft };
}

/** Есть ли в черновике изменения относительно опубликованной версии. */
export function hasUnpublishedChanges(ws: DashboardWorkspace): boolean {
  if (!ws.published) return true;
  return JSON.stringify(ws.draft.blocks) !== JSON.stringify(ws.published.blocks) || ws.draft.title !== ws.published.title;
}

/** Публикация черновика как новой версии. Право – dashboard.publish; привязка к объекту обязательна. */
export function publishDashboard(ws: DashboardWorkspace, objectId: string, actor: DashboardActor): DashboardWorkspace {
  assertCan(actor.role, 'dashboard.publish');
  if (ws.draft.objectId !== objectId) throw new DashboardRuleError(`Панель привязана к ${ws.draft.objectId}, а не к ${objectId}`);
  const errors = configShapeErrors(ws.draft);
  if (errors.length) throw new DashboardRuleError(`Конфигурация некорректна: ${errors.join('; ')}`);
  if (ws.published && !hasUnpublishedChanges(ws)) throw new DashboardRuleError(`Изменений нет: версия v${ws.published.version} уже опубликована`);
  const published: DashboardConfig = { ...ws.draft, publishedAt: actor.now, publishedBy: actor.name };
  return {
    ...ws,
    published,
    history: ws.published ? [...ws.history, ws.published] : ws.history,
    draft: { ...ws.draft, version: published.version + 1, updatedAt: actor.now, updatedBy: actor.name },
  };
}

/**
 * Приёмка опубликованной версии. Право – dashboard.accept.
 * ACCEPTED – только если все четыре блока отмечены корректными; при отказе нужен комментарий.
 */
export function acceptDashboard(ws: DashboardWorkspace, objectId: string, input: { result: 'ACCEPTED' | 'REJECTED'; blocks: BlockReview[]; comment?: string }, actor: DashboardActor): { ws: DashboardWorkspace; acceptance: DashboardAcceptance } {
  assertCan(actor.role, 'dashboard.accept');
  const pub = ws.published;
  if (!pub) throw new DashboardRuleError('Нет опубликованной версии панели – принимать нечего');
  if (pub.objectId !== objectId) throw new DashboardRuleError(`Опубликованная панель привязана к ${pub.objectId}, а не к ${objectId}`);
  const reviewed = new Map(input.blocks.map((b) => [b.blockId, b]));
  const missing = DASHBOARD_BLOCK_IDS.filter((id) => !reviewed.has(id));
  if (missing.length) throw new DashboardRuleError(`Не просмотрены блоки: ${missing.map((id) => BLOCK_CATALOG[id].title).join(', ')}`);
  const incorrect = input.blocks.filter((b) => !b.correct);
  if (input.result === 'ACCEPTED' && incorrect.length) throw new DashboardRuleError(`Нельзя принять: некорректны блоки ${incorrect.map((b) => BLOCK_CATALOG[b.blockId].title).join(', ')}`);
  if (input.result === 'REJECTED' && !incorrect.length && !input.comment?.trim()) throw new DashboardRuleError('Укажите некорректный блок или причину отказа');
  const acceptance: DashboardAcceptance = {
    id: actor.newId(),
    objectId,
    configVersion: pub.version,
    author: actor.name,
    role: actor.role,
    at: actor.now,
    result: input.result,
    blocks: DASHBOARD_BLOCK_IDS.map((id) => reviewed.get(id)!),
    ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
  };
  return { ws: { ...ws, acceptances: [...ws.acceptances, acceptance] }, acceptance };
}

/** Действующая приёмка: последняя по опубликованной версии этого объекта. */
export function currentAcceptance(ws: DashboardWorkspace | undefined, objectId: string): DashboardAcceptance | undefined {
  if (!ws?.published) return undefined;
  return [...ws.acceptances].reverse().find((a) => a.objectId === objectId && a.configVersion === ws.published!.version);
}
