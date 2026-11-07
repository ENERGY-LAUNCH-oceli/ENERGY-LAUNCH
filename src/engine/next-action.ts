import type { LaunchSession, RulesConfig, StageId } from '@/types';
import { getPreviousStage } from './dependencies';
import { getUnmetConfirmations, openBlockers, staleConfirmationStages } from './state-machine/guards';
import { STAGE_IDS } from '@/types';
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
  // Телеметрия – по действующим правилам TM-001…TM-011 (src/engine/rules/catalog.ts)
  'TM-001': 'Загрузить паспорт объекта object.json',
  'TM-002': 'Дополнить карту сигналов в паспорте object.json',
  'TM-003': 'Получить телеметрию с обязательными сигналами',
  'TM-004': 'Заменить выгрузку на телеметрию этого объекта',
  'TM-005': 'Восстановить поток и получить свежую телеметрию',
  'TM-006': 'Восстановить полноту потока за последние 48 ч',
  'TM-007': 'Запросить телеметрию в kW, kWh и %',
  'TM-008': 'Исправить знаки и диапазоны в telemetry.csv',
  'TM-009': 'Запросить телеметрию со временем в UTC (ISO 8601, «Z»)',
  'TM-010': 'Сверить подозрительные значения с журналом контроллера',
  'TM-011': 'Проверить связь и сигналы батарей',
  'CT-001': 'Провести тест для неиспытанных типов команд',
  'CT-002': 'Проверить приём команд контроллером актива',
  'CT-003': 'Проверить отклик актива на команду',
  'CT-004': 'Скорректировать интервалы между командами теста',
  'CT-005': 'Проверить отработку setpoint активом',
  'CT-006': 'Повторить неуспешные команды через тестовый контур',
  'CT-010': 'Удалить команды вне тестового контура и повторить тесты в имитаторе',
  'CT-011': 'Отправить тестовую команду по каждому управляемому активу',
  'CT-012': 'Проверить приём команды контроллером и повторить тест',
  'CT-013': 'Проверить исполнение команды активом и повторить тест',
  'CT-014': 'Повторить тест setpoint батареи',
  'CT-015': 'Повторить тест ограничения выработки PV',
  'CT-016': 'Задать корректное значение команды',
  'DB-001': 'Добавить обязательные блоки дашборда',
  'DB-002': 'Вывести обязательные показатели на дашборд',
  'DB-003': 'Исправить привязку блоков к сигналам объекта',
  'DB-004': 'Опубликовать дашборды для приёмки',
  'DB-010': 'Убрать из панели данные другого объекта',
  'DB-011': 'Включить обязательные виджеты блока «История учёта»',
  'DB-012': 'Включить обязательные виджеты блока «Текущие активы»',
  'DB-013': 'Включить обязательные виджеты блока «Управление»',
  'DB-014': 'Включить обязательные виджеты блока «Качество данных и статус запуска»',
  'DB-015': 'Опубликовать конфигурацию рабочей панели',
  'DB-016': 'Передать панель на приёмку ответственному',
};

/** Следующее действие для этапа (null – этап завершён). Чистая функция. */
export function getNextAction(session: LaunchSession, stageId: StageId, config: RulesConfig): NextAction | null {
  const stage = session.stages[stageId];
  if (stage.status === 'COMPLETED') {
    // Данные завершённого этапа (или более раннего) изменились после подтверждения – готовность снята до обновления
    const [stale] = staleConfirmationStages(session, STAGE_IDS.slice(0, STAGE_IDS.indexOf(stageId) + 1));
    if (!stale) return null;
    const c = session.stages[stale].confirmations.find((x) => x.staleSince)!;
    return { kind: 'CONFIRM', stageId: stale, title: 'Обновить устаревшие подтверждения этапа', reason: `Подтверждение ${c.requirementId} устарело: ${c.staleReason ?? 'данные изменились'}. Проверки этапа будут повторены на текущих данных` };
  }

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
/** «2025-05-14T12:30:00Z» → «14.05.2025 12:30 UTC». */
const utcShort = (iso: string) => `${day(iso)} ${iso.slice(11, 16)} UTC`;
/** Список сигналов в подсказке: до трёх, дальше – «и ещё N». */
const short = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')} и ещё ${xs.length - 3}` : xs.join(', '));

/** Конкретизация действия по деталям проверки: какой сигнал, какая команда, какой период. */
export function specificAction(ruleId: string, details: Record<string, unknown> | undefined): string | undefined {
  if (!details) return undefined;
  switch (ruleId) {
    case 'TM-002': {
      const s = list(details.signals);
      return s.length ? `Дополнить карту сигналов паспорта object.json: ${short(s)}` : undefined;
    }
    case 'TM-003': {
      const s = list(details.signals);
      return s.length ? `Получить телеметрию с сигналами: ${short(s)}` : undefined;
    }
    case 'TM-005': {
      const s = list(details.signals);
      return s.length ? `Восстановить поток и выгрузить свежие данные: ${short(s)}` : undefined;
    }
    case 'TM-006': {
      const s = list(details.signals);
      return s.length ? `Восстановить полноту за 48 ч: ${short(s)}` : undefined;
    }
    case 'TM-007': {
      const s = list(details.signals);
      return s.length ? `Запросить в правильных единицах: ${short(s)}` : undefined;
    }
    case 'TM-008': {
      // Знак обратный почти во всех интервалах – это не выбросы, а другая конвенция знака в источнике
      const sys = list(details.systematic);
      if (sys.length) return `Исправить знак ${short(sys)} в источнике телеметрии и выгрузить заново`;
      const s = list(details.signals);
      return s.length ? `Исправить знаки и диапазоны в telemetry.csv: ${short(s)}` : undefined;
    }
    case 'TM-011': {
      const o = list(details.owners);
      return o.length ? `Проверить связь и сигналы батарей: ${short(o)}` : undefined;
    }
    case 'MH-002': {
      const m = list(details.missingMonths);
      return m.length ? `Получить полную выгрузку за недостающие месяцы: ${m.length > 3 ? `${m[0]} … ${m.at(-1)} (${m.length})` : m.join(', ')}` : undefined;
    }
    case 'MH-004': {
      const i = details.interval as { from?: string; to?: string } | null;
      return i?.from ? `Получить выгрузку за пропущенный интервал ${day(i.from)} – ${day(i.to)}` : undefined;
    }
    case 'MH-008': {
      // Несколько нарушений – перечислить; много – с какого интервала и сколько всего
      const where = (examples: unknown, count: unknown) => {
        const ex = (Array.isArray(examples) ? examples : []) as { timestamp?: string; value?: string }[];
        const when = ex.filter((e) => e.timestamp).map((e) => `${utcShort(e.timestamp!)} (${e.value})`);
        const total = typeof count === 'number' ? count : when.length;
        if (!when.length) return '';
        return total <= 3 ? when.join(', ') : `с ${utcShort(ex[0]!.timestamp!)}, всего ${total.toLocaleString('ru-RU')} интервалов`;
      };
      const signs = list(details.fields);
      const ranges = list(details.rangeFields);
      const parts = [
        signs.length ? `знак ${short(signs)}${where(details.examples, details.count) ? ` (${where(details.examples, details.count)})` : ''}` : '',
        ranges.length ? `выбросы ${short(ranges)}${where(details.rangeExamples, details.rangeCount) ? ` (${where(details.rangeExamples, details.rangeCount)})` : ''}` : '',
      ].filter(Boolean);
      if (!parts.length) return undefined;
      if (signs.length && !ranges.length) return `Исправить знак ${short(signs)} в выгрузке${where(details.examples, details.count) ? `: ${where(details.examples, details.count)}` : ''}`;
      if (!signs.length) return `Сверить с поставщиком данных выбросы ${short(ranges)}${where(details.rangeExamples, details.rangeCount) ? `: ${where(details.rangeExamples, details.rangeCount)}` : ''}`;
      return `Исправить в выгрузке ${parts.join('; ')}`;
    }
    case 'DB-011':
    case 'DB-012':
    case 'DB-013':
    case 'DB-014': {
      const data = list(details.dataIssues);
      const off = list(details.fields);
      if (data.length) return `Добавить данные для блока: ${short(data)}`;
      return off.length ? `Включить обязательные виджеты: ${short(off)}` : undefined;
    }
    case 'MH-007': {
      const f = list(details.fields);
      return f.length ? `Запросить выгрузку в kWh: ${f.join(', ')}` : undefined;
    }
    case 'CT-011': {
      const a = list(details.assets);
      return a.length ? `Отправить тестовую команду: ${a.join(', ')}` : undefined;
    }
    case 'CT-012':
    case 'CT-013':
    case 'CT-014':
    case 'CT-015': {
      const a = list(details.assets);
      return a.length ? `Повторить тест управления: ${a.join(', ')}` : undefined;
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
