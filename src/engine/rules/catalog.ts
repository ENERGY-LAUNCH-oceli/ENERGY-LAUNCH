import type { RuleId, StageId, ValidationRule } from '@/types';

/**
 * Каталог правил проверки. Метаданные правил отделены от реализации
 * (src/engine/validators) и от порогов (src/config/rules).
 */
const RULES = [
  // ── Этап 1. Meter History ──────────────────────────────────────────────
  {
    id: 'MH-001',
    stageId: 'METER_HISTORY',
    dimension: 'PRESENCE',
    title: 'Наличие данных',
    description: 'Загружены счёт и интервальная история по каждой точке поставки.',
    severity: 'CRITICAL',
    blocking: true,
  },
  {
    id: 'MH-002',
    stageId: 'METER_HISTORY',
    dimension: 'QUALITY',
    title: 'Шаг интервала',
    description: 'Шаг интервального учёта соответствует конфигурации.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'meterHistory.intervalMinutes',
  },
  {
    id: 'MH-003',
    stageId: 'METER_HISTORY',
    dimension: 'QUALITY',
    title: 'Полнота истории',
    description: 'Доля достоверных интервалов не ниже минимальной полноты.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'meterHistory.minCompletenessPct',
  },
  {
    id: 'MH-004',
    stageId: 'METER_HISTORY',
    dimension: 'PRESENCE',
    title: 'Глубина истории',
    description: 'Период истории покрывает требуемый период проверки.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'meterHistory.checkPeriodDays',
  },
  {
    id: 'MH-005',
    stageId: 'METER_HISTORY',
    dimension: 'QUALITY',
    title: 'Сверка со счётом',
    description: 'Расхождение объёма по счёту и по учёту в пределах допуска.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'meterHistory.invoiceTolerancePct',
  },
  {
    id: 'MH-006',
    stageId: 'METER_HISTORY',
    dimension: 'QUALITY',
    title: 'Непрерывные пропуски',
    description: 'Число подряд пропущенных интервалов не превышает предела.',
    severity: 'WARNING',
    blocking: false,
    configRef: 'meterHistory.maxConsecutiveGaps',
  },
  // ── Этап 2. Real-time Telemetry ───────────────────────────────────────
  {
    id: 'TM-001',
    stageId: 'REALTIME_TELEMETRY',
    dimension: 'PRESENCE',
    title: 'Обязательные сигналы',
    description: 'По каждому обязательному сигналу поступают данные.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'telemetry.requiredSignals',
  },
  {
    id: 'TM-002',
    stageId: 'REALTIME_TELEMETRY',
    dimension: 'QUALITY',
    title: 'Частота данных',
    description: 'Медианный период поступления в пределах допуска от ожидаемого.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'telemetry.expectedFrequencySec',
  },
  {
    id: 'TM-003',
    stageId: 'REALTIME_TELEMETRY',
    dimension: 'QUALITY',
    title: 'Полнота телеметрии',
    description: 'Доля полученных значений не ниже минимальной полноты.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'telemetry.minCompletenessPct',
  },
  {
    id: 'TM-004',
    stageId: 'REALTIME_TELEMETRY',
    dimension: 'QUALITY',
    title: 'Задержка доставки',
    description: 'Перцентиль задержки не превышает максимальную задержку.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'telemetry.maxLatencySec',
  },
  {
    id: 'TM-005',
    stageId: 'REALTIME_TELEMETRY',
    dimension: 'PRESENCE',
    title: 'Период наблюдения',
    description: 'Поток наблюдался не меньше требуемого периода.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'telemetry.observationPeriodHours',
  },
  {
    id: 'TM-006',
    stageId: 'REALTIME_TELEMETRY',
    dimension: 'PRESENCE',
    title: 'Уровень заряда батареи',
    description: 'Для объекта с батареей поступает сигнал SoC; без батареи — не применимо.',
    severity: 'CRITICAL',
    blocking: true,
  },
  // ── Этап 3. Asset Control ─────────────────────────────────────────────
  {
    id: 'CT-001',
    stageId: 'ASSET_CONTROL',
    dimension: 'FUNCTION',
    title: 'Покрытие команд',
    description: 'Испытаны все обязательные типы команд.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'control.requiredCommandTypes',
  },
  {
    id: 'CT-002',
    stageId: 'ASSET_CONTROL',
    dimension: 'FUNCTION',
    title: 'Время квитирования',
    description: 'Каждая команда квитирована не позже допустимого времени.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'control.maxAcknowledgeSec',
  },
  {
    id: 'CT-003',
    stageId: 'ASSET_CONTROL',
    dimension: 'FUNCTION',
    title: 'Время исполнения',
    description: 'Каждая команда исполнена не позже допустимого времени.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'control.maxExecutionSec',
  },
  {
    id: 'CT-004',
    stageId: 'ASSET_CONTROL',
    dimension: 'FUNCTION',
    title: 'Интервалы между командами',
    description: 'Интервалы между последовательными командами в допустимом диапазоне.',
    severity: 'WARNING',
    blocking: false,
    configRef: 'control.minIntervalBetweenCommandsSec',
  },
  {
    id: 'CT-005',
    stageId: 'ASSET_CONTROL',
    dimension: 'FUNCTION',
    title: 'Отработка уставки',
    description: 'Обратная связь по уставке в пределах допуска.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'control.setpointTolerancePct',
  },
  {
    id: 'CT-006',
    stageId: 'ASSET_CONTROL',
    dimension: 'FUNCTION',
    title: 'Отказы команд',
    description: 'Нет команд в статусе FAILED или TIMEOUT.',
    severity: 'CRITICAL',
    blocking: true,
  },
  // ── Этап 4. Final Dashboards ──────────────────────────────────────────
  {
    id: 'DB-001',
    stageId: 'FINAL_DASHBOARDS',
    dimension: 'PRESENCE',
    title: 'Обязательные блоки',
    description: 'Панели содержат все обязательные типы блоков.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'dashboards.requiredBlockTypes',
  },
  {
    id: 'DB-002',
    stageId: 'FINAL_DASHBOARDS',
    dimension: 'PRESENCE',
    title: 'Покрытие сигналов',
    description: 'Обязательные сигналы выведены на панели.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'dashboards.requiredSignals',
  },
  {
    id: 'DB-003',
    stageId: 'FINAL_DASHBOARDS',
    dimension: 'QUALITY',
    title: 'Целостность привязок',
    description: 'Все блоки ссылаются на существующие сигналы объекта.',
    severity: 'CRITICAL',
    blocking: true,
  },
  {
    id: 'DB-004',
    stageId: 'FINAL_DASHBOARDS',
    dimension: 'FUNCTION',
    title: 'Публикация',
    description: 'Панели опубликованы.',
    severity: 'CRITICAL',
    blocking: true,
    configRef: 'dashboards.requirePublished',
  },
] as const satisfies readonly ValidationRule[];

export type KnownRuleId = (typeof RULES)[number]['id'];

export const RULE_CATALOG: Readonly<Record<KnownRuleId, ValidationRule>> = Object.fromEntries(
  RULES.map((r) => [r.id, r]),
) as Record<KnownRuleId, ValidationRule>;

export function getRule(id: KnownRuleId): ValidationRule {
  return RULE_CATALOG[id];
}

export function getRulesForStage(stageId: StageId): ValidationRule[] {
  return RULES.filter((r) => r.stageId === stageId);
}

export function isKnownRule(id: RuleId): id is KnownRuleId {
  return id in RULE_CATALOG;
}
