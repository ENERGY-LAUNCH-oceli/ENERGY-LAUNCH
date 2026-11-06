import type { LaunchSession, RulesConfig, StageId } from '@/types';
import { getPreviousStage } from './dependencies';
import { getUnmetConfirmations, openBlockers } from './state-machine/guards';
import { hasBlockingFailures } from './validators';

export type NextActionKind = 'COMPLETE_PREVIOUS' | 'START' | 'RUN_CHECKS' | 'RESOLVE_BLOCKER' | 'FIX_DATA' | 'CONFIRM' | 'COMPLETE';

export interface NextAction {
  kind: NextActionKind;
  stageId: StageId;
  title: string;
  reason?: string;
  ruleId?: string;
  blockerId?: string;
}

/** Конкретное действие, устраняющее причину провала правила (ТЗ 3.1.4). */
export const NEXT_ACTION_BY_RULE: Record<string, string> = {
  'MH-001': 'Загрузить официальную выгрузку invoice.csv',
  'MH-002': 'Получить полную выгрузку за недостающие месяцы',
  'MH-003': 'Запросить выгрузку с 15-минутным шагом',
  'MH-004': 'Получить выгрузку за интервалы с пропусками',
  'MH-005': 'Удалить дубли или запросить исправленную выгрузку',
  'MH-006': 'Запросить выгрузку с временем в UTC (ISO 8601)',
  'MH-007': 'Запросить выгрузку в kWh / kW без смешанных единиц',
  'MH-008': 'Исправить знаки значений в выгрузке',
  'MH-009': 'Заполнить пустые значения или обработать по согласованному правилу',
  'MH-010': 'Сверить корректировки validated с поставщиком данных',
  'MH-011': 'Внести корректные коды EAN в паспорт объекта',
  'MH-012': 'Подтвердить привязку счётчика: EAN или data_files паспорта',
  'TM-001': 'Подключить телеметрию по отсутствующим сигналам',
  'TM-002': 'Настроить шаг передачи телеметрии',
  'TM-003': 'Восстановить полноту потока телеметрии',
  'TM-004': 'Проверить канал связи: данные поступают с задержкой',
  'TM-005': 'Дождаться окончания периода наблюдения',
  'CT-001': 'Провести тест для неиспытанных типов команд',
  'CT-002': 'Проверить приём команд контроллером актива',
  'CT-003': 'Проверить отклик актива на команду',
  'CT-004': 'Скорректировать интервалы между командами теста',
  'CT-005': 'Проверить отработку setpoint активом',
  'CT-006': 'Повторить неуспешные команды через тестовый контур',
  'DB-001': 'Добавить обязательные блоки дашборда',
  'DB-002': 'Вывести обязательные показатели на дашборд',
  'DB-003': 'Исправить привязку блоков к сигналам объекта',
  'DB-004': 'Опубликовать дашборды для приёмки',
};

/** Следующее действие для этапа (null — этап завершён). Чистая функция. */
export function getNextAction(session: LaunchSession, stageId: StageId, config: RulesConfig): NextAction | null {
  const stage = session.stages[stageId];
  if (stage.status === 'COMPLETED') return null;

  const prev = getPreviousStage(stageId);
  if (prev && session.stages[prev].status !== 'COMPLETED') {
    return { kind: 'COMPLETE_PREVIOUS', stageId: prev, title: 'Завершить предыдущий этап', reason: `Незакрытая зависимость: ${prev}` };
  }
  if (stage.status === 'NOT_STARTED') return { kind: 'START', stageId, title: 'Начать этап и загрузить данные' };
  if (!stage.lastValidatedAt) return { kind: 'RUN_CHECKS', stageId, title: 'Запустить проверки этапа' };

  const [blocker] = openBlockers(session, stageId);
  if (blocker) {
    const result = stage.validationResults.find((r) => r.ruleId === blocker.ruleId);
    const byRule = blocker.ruleId ? (specificAction(blocker.ruleId, result?.details) ?? NEXT_ACTION_BY_RULE[blocker.ruleId]) : undefined;
    return {
      kind: byRule ? 'FIX_DATA' : 'RESOLVE_BLOCKER',
      stageId,
      title: byRule ?? `Устранить препятствие: ${blocker.title}`,
      reason: blocker.description,
      blockerId: blocker.id,
      ...(blocker.ruleId ? { ruleId: blocker.ruleId } : {}),
    };
  }
  if (hasBlockingFailures(stage.validationResults)) return { kind: 'RUN_CHECKS', stageId, title: 'Загрузить недостающие данные и повторить проверки' };

  const [unmet] = getUnmetConfirmations(session, stageId, config);
  if (unmet) return { kind: 'CONFIRM', stageId, title: `Получить подтверждение: ${unmet.title}`, reason: `Требование ${unmet.id}` };

  return { kind: 'COMPLETE', stageId, title: 'Завершить этап' };
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const day = (iso: unknown) => (typeof iso === 'string' ? iso.slice(0, 10).split('-').reverse().join('.') : '');

/** Конкретизация действия по деталям проверки: какой сигнал, какая команда, какой период. */
export function specificAction(ruleId: string, details: Record<string, unknown> | undefined): string | undefined {
  if (!details) return undefined;
  switch (ruleId) {
    case 'TM-001': {
      const tags = list(details.signals);
      if (list(details.unknownSignalIds).length) return `Проверить привязку сигнала ${tags[0] ?? ''}: поток содержит сигналы другого объекта`.trim();
      return tags.length ? `Подключить телеметрию: ${tags.join(', ')}` : undefined;
    }
    case 'MH-002': {
      const m = list(details.missingMonths);
      return m.length ? `Получить полную выгрузку за недостающие месяцы: ${m.length > 3 ? `${m[0]} … ${m.at(-1)} (${m.length})` : m.join(', ')}` : undefined;
    }
    case 'MH-004': {
      const i = details.interval as { from?: string; to?: string } | null;
      return i?.from ? `Получить выгрузку за пропущенный интервал ${day(i.from)} – ${day(i.to)}` : undefined;
    }
    case 'MH-007': {
      const f = list(details.fields);
      return f.length ? `Запросить выгрузку в kWh: ${f.join(', ')}` : undefined;
    }
    case 'CT-006':
    case 'CT-001': {
      const c = list(details.commands);
      return c.length ? `Повторить тест управления: ${c.join(', ')}` : undefined;
    }
    default:
      return undefined;
  }
}
