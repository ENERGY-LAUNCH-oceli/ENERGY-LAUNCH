import type { DashboardBlockId, DashboardConfig, DashboardConfigRules, LaunchInputs } from '@/types';
import { BLOCK_CATALOG } from './catalog';

export interface BlockEvaluation {
  blockId: DashboardBlockId;
  ok: boolean;
  /** Обязательные виджеты, которые выключены. */
  missingWidgets: string[];
  /** Обязательные по ТЗ, но не применимые: актива нет в паспорте. */
  notApplicable: string[];
  /** Нет данных объекта для блока. */
  dataIssues: string[];
}

/** Источники данных панели и их object_id: всё должно относиться к одному объекту. */
export function dataSources(inputs: LaunchInputs): { source: string; objectId: string }[] {
  const out: { source: string; objectId: string }[] = [];
  if (inputs.invoice) out.push({ source: `invoice.csv v${inputs.invoice.version}`, objectId: inputs.invoice.objectId });
  if (inputs.passport) out.push({ source: `object.json v${inputs.passport.version}`, objectId: inputs.passport.objectId });
  if (inputs.telemetry) out.push({ source: `telemetry.csv v${inputs.telemetry.version}`, objectId: inputs.telemetry.objectId });
  for (const c of inputs.controlCommands ?? []) out.push({ source: c.commandId, objectId: c.objectId });
  return out;
}

/** Нарушения привязки: конфигурация, источники и приёмки другого объекта. */
export function bindingIssues(config: DashboardConfig | undefined, inputs: LaunchInputs): string[] {
  const objectId = inputs.object.id;
  const issues: string[] = [];
  if (config && config.objectId !== objectId) issues.push(`Панель привязана к ${config.objectId}, а запуск – к ${objectId}`);
  for (const s of dataSources(inputs)) if (s.objectId !== objectId) issues.push(`${s.source} относится к ${s.objectId}`);
  for (const a of inputs.dashboard?.acceptances ?? []) if (a.objectId !== objectId) issues.push(`Приёмка ${a.id} относится к ${a.objectId}`);
  return issues;
}

/** Корректность блока: обязательные виджеты включены и у объекта есть данные для блока. */
export function evaluateBlocks(config: DashboardConfig, inputs: LaunchInputs, rules: DashboardConfigRules): Record<DashboardBlockId, BlockEvaluation> {
  const objectId = inputs.object.id;
  const types = new Set(inputs.passport?.assets.map((a) => a.type) ?? []);
  const result = {} as Record<DashboardBlockId, BlockEvaluation>;
  for (const block of config.blocks) {
    const def = BLOCK_CATALOG[block.id];
    const required = rules.requiredWidgets[block.id] ?? [];
    const notApplicable: string[] = [];
    const missingWidgets: string[] = [];
    for (const wid of required) {
      const w = def.widgets.find((x) => x.id === wid)!;
      if (w.requiresAsset && !types.has(w.requiresAsset)) {
        notApplicable.push(w.label);
        continue;
      }
      if (!block.widgets[wid]) missingWidgets.push(w.label);
    }
    const dataIssues: string[] = [];
    if (block.id === 'METER_HISTORY' && !(inputs.invoice?.objectId === objectId && inputs.invoice.report?.window)) dataIssues.push('Нет истории учёта объекта (invoice.csv)');
    // Объект без PV и батарей (паспорт): блоки активов и управления показывают отсутствие активов – это данные объекта, а не ошибка
    const controllable = types.has('PV') || types.has('BATTERY');
    if (block.id === 'ASSETS') {
      if (!inputs.passport) dataIssues.push('Нет паспорта объекта (object.json)');
      else if (!controllable) notApplicable.push('Установки PV и батареи – в паспорте их нет');
      if (!inputs.telemetry?.report) dataIssues.push('Нет телеметрии объекта (telemetry.csv)');
    }
    if (block.id === 'CONTROL') {
      if (inputs.passport && !controllable) notApplicable.push('Тесты управления – нет управляемых активов');
      else if (!(inputs.controlCommands ?? []).some((c) => c.objectId === objectId)) dataIssues.push('Нет тестов управления объекта (этап 3)');
    }
    result[block.id] = { blockId: block.id, ok: !missingWidgets.length && !dataIssues.length, missingWidgets, notApplicable, dataIssues };
  }
  return result;
}

export const blockProblems = (e: BlockEvaluation) => [...e.missingWidgets.map((w) => `выключен обязательный виджет «${w}»`), ...e.dataIssues];
