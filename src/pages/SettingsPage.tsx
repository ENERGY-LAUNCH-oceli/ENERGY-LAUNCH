import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { PageHeader, SectionHeader } from '@/components/common/PageHeader';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { accentThemes, themes, type AccentId, type ThemeId } from '@/design/tokens';
import { storageText } from '@/components/layout/StorageIndicator';
import { useStorageStatus } from '@/services/server-storage';
import { useLaunchStore, useUi } from '@/store';

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
  requireBatterySetpoint: 'Проверять управление батареей',
  requirePvCurtailment: 'Проверять ограничение солнечных панелей',
  requiredWidgets: 'Обязательные показатели на панели',
  requireAcceptance: 'Требовать приёмку панели',
  requiredBlockTypes: 'Обязательные блоки панели',
  requiredSignals: 'Показатели на панели',
  requirePublished: 'Требовать публикацию панели',
};

const RULE_HINTS: Record<string, string> = {
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

const FIELD_LABELS: Record<string, string> = {
  'Grid.energy_kWh.offtake_invoice': 'Потребление из сети по счётчику',
  'Grid.energy_kWh.offtake_invoice_validated': 'Подтверждённое потребление из сети',
  'Grid.energy_kWh.injection_invoice': 'Передача энергии в сеть по счётчику',
  'Grid.energy_kWh.injection_invoice_validated': 'Подтверждённая передача энергии в сеть',
  'Grid.power_kW.invoice': 'Мощность по счётчику',
  'Grid.power_kW.CA_offtake': 'Потребляемая мощность по данным оператора сети',
  'Grid.power_kW.CA_injection': 'Передаваемая мощность по данным оператора сети',
};

const WIDGET_LABELS: Record<string, string> = {
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

const GROUP_LABELS: Record<string, string> = {
  METER_HISTORY: 'История счётчиков',
  ASSETS: 'Оборудование',
  CONTROL: 'Управление',
  QUALITY_STATUS: 'Качество и готовность',
};

const formatRuleLabel = (key: string) => RULE_LABELS[key] ?? key;
const formatSignal = (signal: string) => SIGNAL_LABELS[signal] ?? VALUE_LABELS[signal] ?? signal;

function formatRuleValue(key: string, value: unknown): ReactNode {
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

const THEME_OPTIONS: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'light', label: 'Светлая', hint: 'Для дневной работы и печати протоколов' },
  { id: 'dark', label: 'Тёмная', hint: 'Для диспетчерской и длительной работы' },
];

const ACCENT_OPTIONS: { id: AccentId; label: string }[] = [
  { id: 'teal', label: 'Бирюзовый' },
  { id: 'blue', label: 'Синий' },
];

/** Мини-макет приложения в цветах выбранной темы и акцента. */
function ThemePreview({ theme, accent }: { theme: ThemeId; accent: AccentId }) {
  const c = themes[theme];
  const a = accentThemes[accent][theme];
  return (
    <span aria-hidden className="flex aspect-[16/9] w-full overflow-hidden rounded-md border" style={{ backgroundColor: c.background, borderColor: c.border }}>
      <span className="flex w-[26%] shrink-0 flex-col gap-1.5 border-r p-2" style={{ backgroundColor: c.surface, borderColor: c.border }}>
        <span className="mb-1 flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: a.accent }} />
          <span className="h-1 w-8 rounded-full" style={{ backgroundColor: c.textPrimary }} />
        </span>
        <span className="flex h-3 items-center rounded-sm px-1" style={{ backgroundColor: a.accentSubtle }}>
          <span className="h-1 w-3/4 rounded-full" style={{ backgroundColor: a.accentStrong }} />
        </span>
        {[70, 55, 80, 60].map((w) => (
          <span key={w} className="flex h-3 items-center px-1">
            <span className="h-1 rounded-full" style={{ width: `${w}%`, backgroundColor: c.textMuted, opacity: 0.6 }} />
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        <span className="flex items-center justify-between">
          <span className="h-1.5 w-1/3 rounded-full" style={{ backgroundColor: c.textPrimary }} />
          <span className="h-3 w-8 rounded-sm" style={{ backgroundColor: a.accent }} />
        </span>
        <span className="grid grid-cols-3 gap-1.5">
          {[c.success, a.accent, c.warning].map((dot, i) => (
            <span key={i} className="flex flex-col gap-1 rounded-sm border p-1.5" style={{ backgroundColor: c.surface, borderColor: c.border }}>
              <span className="h-1 w-3/5 rounded-full" style={{ backgroundColor: c.textMuted, opacity: 0.6 }} />
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />
                <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: c.textPrimary }} />
              </span>
            </span>
          ))}
        </span>
        <span className="relative flex-1 overflow-hidden rounded-sm border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <path d="M0 30 L12 26 L24 28 L36 18 L48 21 L60 12 L72 15 L84 8 L100 10 L100 40 L0 40 Z" fill={a.accent} opacity="0.14" />
            <path d="M0 30 L12 26 L24 28 L36 18 L48 21 L60 12 L72 15 L84 8 L100 10" fill="none" stroke={a.accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </span>
      </span>
    </span>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${on ? 'border-accent-strong bg-accent-strong' : 'border-border-strong bg-surface'}`}>
      {on && <span className="size-1.5 rounded-full bg-accent-foreground" />}
    </span>
  );
}

function GroupLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-body-sm font-medium">{title}</h3>
      <p className="text-caption text-text-muted">{description}</p>
    </div>
  );
}

const optionClass = (on: boolean) =>
  `transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${on ? 'border-accent-strong bg-accent-subtle/40' : 'border-border hover:border-border-strong hover:bg-surface-hover'}`;

function AppearanceSettings() {
  const theme = useUi((s) => s.theme);
  const accent = useUi((s) => s.accent);
  const setAppearance = useUi((s) => s.setAppearance);
  return (
    <Card>
      <CardContent className="grid gap-6 pt-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] xl:gap-0">
        <div className="flex min-w-0 flex-col gap-3 xl:pr-6">
          <GroupLabel title="Тема" description="Влияет на весь интерфейс. Быстрое переключение – внизу боковой панели." />
          <div role="radiogroup" aria-label="Тема" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {THEME_OPTIONS.map((o) => {
              const on = theme === o.id;
              return (
                <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => setAppearance(o.id, accent)} className={`flex flex-col gap-3 rounded-lg border p-2.5 text-left ${optionClass(on)}`}>
                  <ThemePreview theme={o.id} accent={accent} />
                  <span className="flex items-start gap-2.5 px-1 pb-0.5">
                    <RadioDot on={on} />
                    <span className="-mt-0.5 flex min-w-0 flex-col">
                      <span className="text-body-sm font-medium">{o.label}</span>
                      <span className="text-caption text-text-muted">{o.hint}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <GroupLabel title="Акцентный цвет" description="Кнопки, активные пункты, графики и фокус. Цвета статусов не меняются." />
          <div role="radiogroup" aria-label="Акцентный цвет" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {ACCENT_OPTIONS.map((o) => {
              const on = accent === o.id;
              const c = accentThemes[o.id][theme];
              return (
                <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => setAppearance(theme, o.id)} className={`flex items-center gap-3 rounded-lg border p-3 text-left ${optionClass(on)}`}>
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: c.accent }}>
                    {on && <Check className="size-4" style={{ color: c.accentForeground }} />}
                  </span>
                  <span className="min-w-0 flex-1 text-body-sm font-medium">{o.label}</span>
                  <span aria-hidden className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-sm px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: c.accentSubtle, color: c.accentStrong }}>
                      Этап
                    </span>
                    <span className="rounded-sm px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: c.accent, color: c.accentForeground }}>
                      Кнопка
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-auto rounded-md bg-surface-secondary px-3 py-2.5 text-caption text-text-muted">
            Сейчас: <span className="font-medium text-text-primary">{THEME_OPTIONS.find((t) => t.id === theme)?.label.toLowerCase()} тема</span>,{' '}
            <span className="font-medium text-text-primary">{ACCENT_OPTIONS.find((a) => a.id === accent)?.label.toLowerCase()} акцент</span>. Сохраняется в этом браузере.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageSettings() {
  const s = useStorageStatus();
  const t = storageText(s);
  const server = s.mode === 'server';
  const rows: [string, ReactNode][] = server
    ? [
        ['Хранилище', s.kind === 'pglite' ? 'Встроенный PostgreSQL (PGlite) – папка .data/pglite на сервере' : 'PostgreSQL – база из DATABASE_URL'],
        ['Что сохраняется', 'Объекты, добавленные вручную; входные данные и ход запуска каждого объекта; журнал аудита (только дополняется)'],
        ['Состояние', t.title],
        ['Последнее сохранение', s.savedAt ? new Date(s.savedAt).toLocaleString('ru-RU') : 'изменений после загрузки не было'],
      ]
    : [
        ['Хранилище', 'Браузер: объекты – localStorage, ход запуска – до перезагрузки страницы'],
        ['Как включить PostgreSQL', <span key="cmd">Запустите сервер <code className="font-mono text-caption">npm run api</code> и обновите страницу</span>],
      ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        {s.status === 'error' && <Alert tone="error" title="Последнее изменение не сохранено">{s.error}</Alert>}
        <dl className="grid gap-x-6 gap-y-3 text-body-sm sm:grid-cols-[minmax(160px,auto)_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-muted">{k}</dt>
              <dd className="min-w-0 text-text-primary">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const ruleset = useLaunchStore((s) => s.ruleset);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const context = useUi((s) => s.contextPanelOpen);
  const setContext = useUi((s) => s.setContextPanelOpen);
  const groups: [string, Record<string, unknown>][] = [
    ['Счётчики', ruleset.meterHistory as unknown as Record<string, unknown>],
    ['Телеметрия', ruleset.telemetry as unknown as Record<string, unknown>],
    ['Команды управления', ruleset.control as unknown as Record<string, unknown>],
    ...(ruleset.controlTesting ? [['Проверки управления', ruleset.controlTesting as unknown as Record<string, unknown>] as [string, Record<string, unknown>]] : []),
    ...(ruleset.dashboardConfig ? [['Состав итоговой панели', ruleset.dashboardConfig as unknown as Record<string, unknown>] as [string, Record<string, unknown>]] : []),
    ['Публикация панели', ruleset.dashboards as unknown as Record<string, unknown>],
  ];
  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Настройки" title="Настройки" description="Выберите внешний вид и посмотрите, какие условия проверяет система перед запуском объекта." />
      {ruleset.provisional && (
        <Alert tone="warning" title={`Набор правил v${ruleset.version} – предварительный`}>
          Значения ещё не сверены с ТЗ «Кейс 4» и паспортом OE-04 (см. docs/requirements-reconciliation.md).
        </Alert>
      )}
      <section>
        <SectionHeader eyebrow="Оформление" title="Внешний вид" description="Тема и акцентный цвет интерфейса." />
        <AppearanceSettings />
      </section>
      <section>
        <SectionHeader eyebrow="Проверки запуска" title={`Условия проверок · v${ruleset.version}`} description={`Действуют с ${ruleset.effectiveFrom}. Эти значения определяют, какие данные система считает корректными.`} />
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map(([title, values]) => (
            <Card key={title} className="min-w-0">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-body-sm">
                  {Object.entries(values).map(([k, v]) =>
                    k === 'fields' && Array.isArray(v) ? (
                      <div key={k} className="py-3">
                        <dt className="text-caption font-medium text-text-primary">{formatRuleLabel(k)}</dt>
                        <dd className="mt-1">
                          {RULE_HINTS[k] && <span className="text-caption text-text-muted">{RULE_HINTS[k]}</span>}
                          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                            {v.map((field) => (
                              <li key={field.field} data-testid="rule-field-row" className="min-w-0 rounded-sm border border-border bg-surface-secondary px-3 py-2.5">
                                <span className="block break-words text-body-sm font-medium text-text-primary">
                                  {FIELD_LABELS[field.field] ?? field.field}
                                </span>
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-caption text-text-secondary">{field.unit}</span>
                                  <span className="rounded-sm bg-surface-sunken px-2 py-0.5 text-caption text-text-secondary">
                                    {field.sign === 'NON_NEGATIVE' ? 'Не ниже 0' : field.sign === 'NON_POSITIVE' ? 'Не выше 0' : 'Знак не ограничен'}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    ) : k === 'requiredWidgets' && v && typeof v === 'object' && !Array.isArray(v) ? (
                      <div key={k} className="py-3">
                        <dt className="text-caption font-medium text-text-primary">{formatRuleLabel(k)}</dt>
                        <dd className="mt-1">
                          {RULE_HINTS[k] && <span className="text-caption text-text-muted">{RULE_HINTS[k]}</span>}
                          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                            {Object.entries(v).map(([group, widgets]) => (
                              <li key={group} data-testid="dashboard-widget-group" className="min-w-0 rounded-sm border border-border bg-surface-secondary p-3">
                                <h4 className="text-caption font-medium text-text-primary">{GROUP_LABELS[group] ?? group}</h4>
                                <ul className="mt-2 grid gap-1">
                                  {Array.isArray(widgets) && widgets.map((widget) => (
                                    <li key={String(widget)} className="break-words text-caption text-text-secondary">
                                      {WIDGET_LABELS[String(widget)] ?? String(widget)}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    ) : (
                      <div key={k} className="flex min-w-0 flex-col justify-between gap-1 py-2 sm:flex-row sm:gap-4">
                        <dt className="min-w-0 text-caption text-text-secondary">
                          {formatRuleLabel(k)}
                          {RULE_HINTS[k] && <span className="mt-0.5 block text-text-muted">{RULE_HINTS[k]}</span>}
                        </dt>
                        <dd className={`min-w-0 break-words font-medium ${k === 'requiredWidgets' ? 'text-body-sm' : 'text-left tabular sm:text-right'}`}>
                          {formatRuleValue(k, v)}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <SectionHeader eyebrow="Данные" title="Хранилище" description="Где сохраняются объекты, ход запуска и журнал аудита." />
        <StorageSettings />
      </section>
      <section>
        <SectionHeader eyebrow="Интерфейс" title="Рабочее пространство" />
        <Card>
          <CardContent className="flex flex-col gap-4 pt-5">
            <div className="hidden lg:block">
              <Checkbox label="Свёрнутая боковая навигация" description="Ctrl + B" checked={collapsed} onCheckedChange={toggle} />
            </div>
            <Checkbox label="Контекстная панель объекта" description="Справа на широких экранах" checked={context} onCheckedChange={(v) => setContext(v === true)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
