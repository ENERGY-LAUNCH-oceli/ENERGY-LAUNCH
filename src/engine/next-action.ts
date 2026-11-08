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
  'CT-017': 'Повторить тест после паузы между командами',
  'DB-001': 'Добавить обязательные блоки дашборда',
  'DB-002': 'Вывести обязательные показатели на дашборд',
  'DB-003': 'Исправить привязку блоков к сигналам объекта',
  'DB-004': 'Опубликовать дашборды для приёмки',
  'DB-010': 'Убрать из панели данные другого объекта',
  'DB-011': 'Включить обязательные виджеты блока «История учёта»',
  'DB-012': 'Включить обязательные виджеты блока «Текущие активы»',
  'DB-013': 'Включить обязательные виджеты блока «Управление»',
  'DB-014': 'Включить обязательные виджеты блока «Качество данных и статус запуска»',
  'DB-015': 'Опубликовать панель во вкладке «Конструктор»',
  'DB-016': 'Принять панель: вкладка «Приёмка», роль «Ответственный за приёмку»',
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

type SpecificAction = (details: Record<string, unknown>) => string | undefined;

/** Все значения через запятую (короткие списки: активы, команды, поля). */
const all = (xs: string[]) => xs.join(', ');
/** «Префикс: значения из details[field]» – если значения есть. */
const listed =
  (field: string, prefix: string, fmt: (xs: string[]) => string = short): SpecificAction =>
  (d) => {
    const xs = list(d[field]);
    return xs.length ? `${prefix}: ${fmt(xs)}` : undefined;
  };

/** MH-008: несколько нарушений – перечислить; много – с какого интервала и сколько всего. */
const signViolations: SpecificAction = (d) => {
  const where = (examples: unknown, count: unknown) => {
    const ex = (Array.isArray(examples) ? examples : []) as { timestamp?: string; value?: string }[];
    const when = ex.filter((e) => e.timestamp).map((e) => `${utcShort(e.timestamp!)} (${e.value})`);
    const total = typeof count === 'number' ? count : when.length;
    if (!when.length) return '';
    return total <= 3 ? when.join(', ') : `с ${utcShort(ex[0]!.timestamp!)}, всего ${total.toLocaleString('ru-RU')} интервалов`;
  };
  const signs = list(d.fields);
  const ranges = list(d.rangeFields);
  const parts = [
    signs.length ? `знак ${short(signs)}${where(d.examples, d.count) ? ` (${where(d.examples, d.count)})` : ''}` : '',
    ranges.length ? `выбросы ${short(ranges)}${where(d.rangeExamples, d.rangeCount) ? ` (${where(d.rangeExamples, d.rangeCount)})` : ''}` : '',
  ].filter(Boolean);
  if (!parts.length) return undefined;
  if (signs.length && !ranges.length) return `Исправить знак ${short(signs)} в выгрузке${where(d.examples, d.count) ? `: ${where(d.examples, d.count)}` : ''}`;
  if (!signs.length) return `Сверить с поставщиком данных выбросы ${short(ranges)}${where(d.rangeExamples, d.rangeCount) ? `: ${where(d.rangeExamples, d.rangeCount)}` : ''}`;
  return `Исправить в выгрузке ${parts.join('; ')}`;
};

/** DB-011…014: сначала недостающие данные блока, затем выключенные обязательные виджеты. */
const dashboardBlock: SpecificAction = (d) => {
  const data = list(d.dataIssues);
  if (data.length) return `Добавить данные для блока: ${short(data)}`;
  return listed('fields', 'Включить обязательные виджеты')(d);
};

/**
 * Конкретизация действия по деталям проверки: какой сигнал, какая команда, какой период.
 * Реестр по коду правила – новое правило добавляется строкой, остальные обработчики не меняются.
 */
const SPECIFIC_ACTIONS: Readonly<Record<string, SpecificAction>> = {
  'TM-002': listed('signals', 'Дополнить карту сигналов паспорта object.json'),
  'TM-003': listed('signals', 'Получить телеметрию с сигналами'),
  'TM-005': listed('signals', 'Восстановить поток и выгрузить свежие данные'),
  'TM-006': listed('signals', 'Восстановить полноту за 48 ч'),
  'TM-007': listed('signals', 'Запросить в правильных единицах'),
  // Знак обратный почти во всех интервалах – это не выбросы, а другая конвенция знака в источнике
  'TM-008': (d) => {
    const sys = list(d.systematic);
    return sys.length ? `Исправить знак ${short(sys)} в источнике телеметрии и выгрузить заново` : listed('signals', 'Исправить знаки и диапазоны в telemetry.csv')(d);
  },
  'TM-011': listed('owners', 'Проверить связь и сигналы батарей'),
  'MH-002': listed('missingMonths', 'Получить полную выгрузку за недостающие месяцы', (m) => (m.length > 3 ? `${m[0]} … ${m.at(-1)} (${m.length})` : all(m))),
  'MH-004': (d) => {
    const i = d.interval as { from?: string; to?: string } | null;
    return i?.from ? `Получить выгрузку за пропущенный интервал ${day(i.from)} – ${day(i.to)}` : undefined;
  },
  'MH-007': listed('fields', 'Запросить выгрузку в kWh', all),
  'MH-008': signViolations,
  'DB-011': dashboardBlock,
  'DB-012': dashboardBlock,
  'DB-013': dashboardBlock,
  'DB-014': dashboardBlock,
  'CT-001': listed('commands', 'Повторить тест управления', all),
  'CT-006': listed('commands', 'Повторить тест управления', all),
  'CT-011': listed('assets', 'Отправить тестовую команду', all),
  'CT-012': listed('assets', 'Повторить тест управления', all),
  'CT-013': listed('assets', 'Повторить тест управления', all),
  'CT-014': listed('assets', 'Повторить тест управления', all),
  'CT-015': listed('assets', 'Повторить тест управления', all),
  'CT-017': listed('assets', 'Повторить тест после паузы', all),
};

export function specificAction(ruleId: string, details: Record<string, unknown> | undefined): string | undefined {
  return details ? SPECIFIC_ACTIONS[ruleId]?.(details) : undefined;
}
