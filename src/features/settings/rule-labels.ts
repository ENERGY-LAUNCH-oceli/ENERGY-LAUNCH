/**
 * Подписи и форматирование параметров набора правил для страницы настроек: ключи конфигурации
 * (src/config/rules) – понятным языком, значения – с единицами. Новый параметр – новая строка словаря.
 */
const RULE_LABELS: Record<string, string> = {
  intervalMinutes: 'Интервал между измерениями',
  periodMonths: 'Глубина истории',
  minCompletenessPct: 'Минимальная полнота данных',
  maxDuplicates: 'Допустимое число дубликатов',
  maxInvalidTimestamps: 'Допустимое число ошибок времени',
  validatedTolerancePct: 'Допустимое расхождение данных',
  unitRatioThreshold: 'Порог проверки единиц',
  fields: 'Проверяемые данные',
  eanLength: 'Количество цифр в коде точки учёта',
  checkPoint: 'Момент проверки',
  timezone: 'Часовой пояс',
  windowHours: 'Период проверки',
  maxAgeMinutes: 'Максимальный возраст показаний',
  requiredGrid: 'Данные, которые нужны от сети',
  requiredPv: 'Данные, которые нужны от солнечных панелей',
  requiredBattery: 'Данные, которые нужны от батарей',
  maxAbsPowerKw: 'Максимальная мощность',
  maxEnergyKwhPerInterval: 'Максимум энергии за интервал',
  maxSocJumpPct: 'Допустимое изменение заряда батареи',
  setpointToleranceKw: 'Допуск управления мощностью',
  requiredCommandTypes: 'Проверяемые команды',
  maxAcknowledgeSec: 'Время подтверждения команды',
  maxExecutionSec: 'Время выполнения команды',
  minIntervalBetweenCommandsSec: 'Минимальная пауза между командами',
  maxIntervalBetweenCommandsSec: 'Максимальная пауза между командами',
  setpointTolerancePct: 'Допуск отклонения мощности',
  ackTimeoutSec: 'Время ожидания подтверждения',
  responseWindowSec: 'Время ожидания реакции оборудования',
  observationSec: 'Длительность наблюдения',
  toleranceKw: 'Допуск по мощности',
  tolerancePct: 'Допуск по мощности',
  minStepKw: 'Минимальное изменение мощности для теста',
  minCommandIntervalSec: 'Пауза между командами одному активу',
  requireBatterySetpoint: 'Проверять управление батареей',
  requirePvCurtailment: 'Проверять ограничение солнечных панелей',
  requiredWidgets: 'Обязательные показатели на панели',
  requireAcceptance: 'Требовать приёмку панели',
  requiredBlockTypes: 'Обязательные блоки панели',
  requiredSignals: 'Показатели на панели',
  requirePublished: 'Требовать публикацию панели',
};

export const RULE_HINTS: Record<string, string> = {
  intervalMinutes: 'Как часто должны поступать показания.',
  periodMonths: 'За какой срок проверяем историю.',
  minCompletenessPct: 'Минимальная доля полученных данных.',
  maxDuplicates: 'Повторяющиеся строки сверх этого числа считаются ошибкой.',
  maxInvalidTimestamps: 'Строки с неверным временем сверх этого числа считаются ошибкой.',
  validatedTolerancePct: 'Насколько могут отличаться исходные и проверенные показания.',
  unitRatioThreshold: 'Помогает найти энергию, ошибочно записанную в других единицах.',
  fields: 'Значения, которые должны быть в файле счётчика.',
  eanLength: 'Проверка кода точки учёта.',
  checkPoint: 'Момент, относительно которого оценивается актуальность данных.',
  maxAgeMinutes: 'Показания старше этого срока считаются устаревшими.',
  maxSocJumpPct: 'Слишком резкое изменение заряда отмечается как подозрительное.',
  setpointToleranceKw: 'Допустимая разница между отправленной и принятой командой.',
  maxAcknowledgeSec: 'Сколько ждём ответа контроллера о получении команды.',
  maxExecutionSec: 'Сколько ждём выполнения команды.',
  requiredWidgets: 'Показатели, которые обязательно должны быть в каждом блоке.',
  requiredSignals: 'Данные, которые панель должна показывать.',
};

const VALUE_LABELS: Record<string, string> = {
  ACTIVE_POWER_SETPOINT: 'Уставка активной мощности',
  REACTIVE_POWER_SETPOINT: 'Уставка реактивной мощности',
  POWER_LIMIT: 'Ограничение мощности',
  STOP: 'Остановка',
  START: 'Запуск',
  BREAKER_OPEN: 'Открытие выключателя',
  BREAKER_CLOSE: 'Закрытие выключателя',
  KPI: 'Ключевые показатели',
  TIME_SERIES: 'Графики показателей',
  TABLE: 'Таблица данных',
  STATUS: 'Состояния оборудования',
  ALERTS: 'Предупреждения',
  MAP: 'Схема объекта',
  ACTIVE_POWER: 'Активная мощность',
  REACTIVE_POWER: 'Реактивная мощность',
  ENERGY_EXPORT: 'Передача энергии в сеть',
  BREAKER_STATE: 'Состояние выключателя',
};

const SIGNAL_LABELS: Record<string, string> = {
  'Grid.power_kW': 'Мощность сети',
  'Grid.energy_kWh.offtake': 'Энергия, полученная из сети',
  'Grid.energy_kWh.injection': 'Энергия, переданная в сеть',
  '{asset}.power_kW': 'Мощность оборудования',
  '{asset}.energy_kWh.production': 'Выработка солнечной панели',
  '{asset}.power_kW.setpoint_received': 'Принятая уставка мощности',
  '{asset}.power_kW.setpoint_sent': 'Отправленная уставка мощности',
  '{asset}.setpoint_sent': 'Отправленная команда управления',
  '{asset}.energy_kWh.charge': 'Заряд батареи',
  '{asset}.energy_kWh.discharge': 'Разряд батареи',
  '{asset}.SOC_%': 'Уровень заряда батареи',
};

export const FIELD_LABELS: Record<string, string> = {
  'Grid.energy_kWh.offtake_invoice': 'Потребление из сети по счётчику',
  'Grid.energy_kWh.offtake_invoice_validated': 'Подтверждённое потребление из сети',
  'Grid.energy_kWh.injection_invoice': 'Передача энергии в сеть по счётчику',
  'Grid.energy_kWh.injection_invoice_validated': 'Подтверждённая передача энергии в сеть',
  'Grid.power_kW.invoice': 'Мощность по счётчику',
  'Grid.power_kW.CA_offtake': 'Потребляемая мощность по данным оператора сети',
  'Grid.power_kW.CA_injection': 'Передаваемая мощность по данным оператора сети',
};

export const WIDGET_LABELS: Record<string, string> = {
  offtake_history: 'История потребления',
  injection_history: 'История передачи энергии',
  contract_limits: 'Договорные лимиты',
  period: 'Выбранный период',
  data_quality: 'Качество данных',
  pv_list: 'Солнечные панели',
  battery_list: 'Батареи',
  current_power: 'Текущая мощность',
  soc: 'Уровень заряда',
  telemetry_freshness: 'Актуальность показаний',
  equipment_state: 'Состояние оборудования',
  control_assets: 'Оборудование под управлением',
  last_commands: 'Последние команды',
  test_results: 'Результаты тестов',
  confirmations: 'Подтверждения',
  loop_state: 'Состояние контура управления',
  history_quality: 'Качество истории показаний',
  telemetry_quality: 'Качество телеметрии',
  open_blockers: 'Нерешённые препятствия',
  check_results: 'Результаты проверок',
  stage_statuses: 'Состояния этапов',
};

export const GROUP_LABELS: Record<string, string> = {
  METER_HISTORY: 'История счётчиков',
  ASSETS: 'Оборудование',
  CONTROL: 'Управление',
  QUALITY_STATUS: 'Качество и готовность',
};

export const formatRuleLabel = (key: string) => RULE_LABELS[key] ?? key;
const formatSignal = (signal: string) => SIGNAL_LABELS[signal] ?? VALUE_LABELS[signal] ?? signal;

export function formatRuleValue(key: string, value: unknown): string {
  if (key === 'requiredGrid' || key === 'requiredPv' || key === 'requiredBattery') {
    return Array.isArray(value) ? value.map(formatSignal).join(', ') : String(value);
  }
  if (Array.isArray(value)) return value.map((item) => VALUE_LABELS[String(item)] ?? String(item)).join(', ');
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'string' && key === 'checkPoint') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  }
  if (typeof value === 'string' && key === 'timezone' && value === 'UTC') return 'Всемирное время (UTC)';
  if (typeof value === 'number') {
    if (key === 'unitRatioThreshold') return `${value} раз`;
    if (key.endsWith('Minutes') || key.endsWith('Sec')) return `${value} ${key.endsWith('Sec') ? 'с' : 'мин'}`;
    if (key.endsWith('Hours')) return `${value} ч`;
    if (key.endsWith('Months')) return `${value} мес.`;
    if (key.endsWith('Pct')) return `${value}%`;
    if (key.endsWith('Kw')) return `${value} кВт`;
    if (key.endsWith('KwhPerInterval')) return `${value} кВт·ч`;
  }
  return String(value);
}
