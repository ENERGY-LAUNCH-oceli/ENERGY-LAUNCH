import type { DashboardBlockConfig, DashboardBlockId } from '@/types';

export interface Option {
  id: string;
  label: string;
}

export interface WidgetDef extends Option {
  /** Чем виджет подтверждает обязательное содержимое блока (ТЗ фазы 09, п. 1). */
  hint: string;
  /** Виджет нужен только при наличии актива этого типа в паспорте. */
  requiresAsset?: 'PV' | 'BATTERY';
}

export interface BlockDef {
  id: DashboardBlockId;
  title: string;
  description: string;
  widgets: WidgetDef[];
  metrics: Option[];
  periods: Option[];
  filters: Option[];
  defaults: Pick<DashboardBlockConfig, 'metrics' | 'period' | 'filter'>;
}

/** Каталог разрешённых виджетов, показателей, периодов и фильтров каждого блока. */
export const BLOCK_CATALOG: Record<DashboardBlockId, BlockDef> = {
  METER_HISTORY: {
    id: 'METER_HISTORY',
    title: 'История учёта',
    description: 'Официальные данные счётчика: потребление, выдача, договорные ограничения, период и качество.',
    widgets: [
      { id: 'offtake_history', label: 'История потребления', hint: 'Grid.energy_kWh.offtake_invoice по месяцам' },
      { id: 'injection_history', label: 'История выдачи в сеть', hint: 'Grid.energy_kWh.injection_invoice по месяцам' },
      { id: 'contract_limits', label: 'Договорные ограничения', hint: 'Grid.power_kW.CA_offtake / CA_injection' },
      { id: 'period', label: 'Период', hint: 'Окно истории и фактическое покрытие' },
      { id: 'data_quality', label: 'Качество исходных данных', hint: 'Полнота, пропуски, дубли' },
      { id: 'monthly_table', label: 'Таблица по месяцам', hint: 'Дополнительно: значения по месяцам' },
    ],
    metrics: [
      { id: 'offtake', label: 'Потребление' },
      { id: 'injection', label: 'Выдача' },
    ],
    periods: [
      { id: '24M', label: '24 месяца' },
      { id: '12M', label: '12 месяцев' },
      { id: '6M', label: '6 месяцев' },
    ],
    filters: [
      { id: 'ALL', label: 'Все месяцы' },
      { id: 'ISSUES', label: 'Только с замечаниями' },
    ],
    defaults: { metrics: ['offtake', 'injection'], period: '24M', filter: 'ALL' },
  },
  ASSETS: {
    id: 'ASSETS',
    title: 'Текущие активы',
    description: 'PV и батареи паспорта: мощность, SoC, актуальность телеметрии и состояние.',
    widgets: [
      { id: 'pv_list', label: 'Список PV', hint: 'PV-установки из object.json', requiresAsset: 'PV' },
      { id: 'battery_list', label: 'Список батарей', hint: 'Батареи из object.json', requiresAsset: 'BATTERY' },
      { id: 'current_power', label: 'Текущая мощность', hint: '{asset}.power_kW на точке проверки' },
      { id: 'soc', label: 'SoC', hint: '{asset}.SOC_% батарей', requiresAsset: 'BATTERY' },
      { id: 'telemetry_freshness', label: 'Актуальность телеметрии', hint: 'Возраст последнего значения' },
      { id: 'equipment_state', label: 'Состояние оборудования', hint: 'Диагноз сигналов этапа 2' },
      { id: 'completeness', label: 'Полнота за 48 ч', hint: 'Дополнительно: полнота потока' },
    ],
    metrics: [
      { id: 'power', label: 'Мощность' },
      { id: 'soc', label: 'SoC' },
    ],
    periods: [
      { id: 'CHECKPOINT', label: 'На точке проверки' },
      { id: '48H', label: 'Окно 48 ч' },
    ],
    filters: [
      { id: 'ALL', label: 'Все активы' },
      { id: 'PV', label: 'Только PV' },
      { id: 'BATTERY', label: 'Только батареи' },
    ],
    defaults: { metrics: ['power', 'soc'], period: 'CHECKPOINT', filter: 'ALL' },
  },
  CONTROL: {
    id: 'CONTROL',
    title: 'Управление',
    description: 'Управляемые активы, последние команды, результаты тестов, подтверждения, состояние контура.',
    widgets: [
      { id: 'control_assets', label: 'Управляемые активы', hint: 'Активы с сигналами уставки' },
      { id: 'last_commands', label: 'Последние команды', hint: 'Журнал тестовых команд' },
      { id: 'test_results', label: 'Результаты тестов', hint: 'Последний тест каждого актива' },
      { id: 'confirmations', label: 'Подтверждения', hint: 'Подтверждения этапа 3' },
      { id: 'loop_state', label: 'Состояние контура управления', hint: 'Итог этапа 3' },
      { id: 'response_chart', label: 'График отклика', hint: 'Дополнительно: setpoint и факт последней команды' },
    ],
    metrics: [
      { id: 'setpoint', label: 'Setpoint' },
      { id: 'actual', label: 'Факт' },
    ],
    periods: [
      { id: 'LAST_5', label: 'Последние 5' },
      { id: 'LAST_10', label: 'Последние 10' },
      { id: 'ALL', label: 'Все команды' },
    ],
    filters: [
      { id: 'ALL', label: 'Все результаты' },
      { id: 'PASSED', label: 'Только Passed' },
      { id: 'NOT_PASSED', label: 'Только неуспешные' },
    ],
    defaults: { metrics: ['setpoint', 'actual'], period: 'LAST_5', filter: 'ALL' },
  },
  QUALITY_STATUS: {
    id: 'QUALITY_STATUS',
    title: 'Качество данных и статус запуска',
    description: 'Качество истории и телеметрии, незакрытые препятствия, результаты проверок, статус этапов.',
    widgets: [
      { id: 'history_quality', label: 'Качество истории', hint: 'Этап 1: полнота, покрытие' },
      { id: 'telemetry_quality', label: 'Качество телеметрии', hint: 'Этап 2: полнота, сигналы' },
      { id: 'open_blockers', label: 'Незакрытые препятствия', hint: 'Открытые блокеры всех этапов' },
      { id: 'check_results', label: 'Результаты проверок', hint: 'Пройдено / ошибки / предупреждения' },
      { id: 'stage_statuses', label: 'Статус всех этапов', hint: 'Этапы 1–4' },
      { id: 'audit_feed', label: 'Последние события', hint: 'Дополнительно: журнал' },
    ],
    metrics: [
      { id: 'failed', label: 'Ошибки' },
      { id: 'warnings', label: 'Предупреждения' },
    ],
    periods: [{ id: 'CURRENT', label: 'Текущее состояние' }],
    filters: [
      { id: 'ALL', label: 'Все этапы' },
      { id: 'OPEN', label: 'Только с препятствиями' },
    ],
    defaults: { metrics: ['failed', 'warnings'], period: 'CURRENT', filter: 'ALL' },
  },
};
