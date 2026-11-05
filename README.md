# ENERGY LAUNCH

B2B SaaS-платформа сопровождения запуска энергетических объектов.
**Фаза 01** — технический фундамент: архитектура, доменная модель, движок проверок,
конечный автомат этапов, слой данных и минимальный каркас интерфейса.

> **Первоисточники требований:** ТЗ «Кейс 4. Запуск энергетического объекта на платформе»
> и паспорт кейса OE-04. В репозитории их нет, поэтому пороговые значения в
> `src/config/rules/ruleset.v1.ts` помечены `provisional: true` и **ждут сверки**.
> Если значения расходятся, создаётся новая версия набора правил (см. «Конфигурация правил»).

## Быстрый старт

```bash
npm install
cp .env.example .env.local   # необязательно
npm run dev                  # http://localhost:5173
```

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Dev-сервер Vite |
| `npm run build` | Проверка TypeScript (`tsc -b`) и production-сборка |
| `npm run typecheck` | Только проверка типов |
| `npm test` | Unit- и интеграционные тесты (Vitest) |
| `npm run test:e2e` | E2E-тесты (Playwright, сам собирает приложение и запускает preview) |

Требуется Node.js ≥ 20.19.

## Архитектура

Три независимых слоя; зависимости направлены только вниз.

```
Presentation  ─▶  Business Logic  ─▶  Data
(React, store)    (src/engine)        (src/services, src/data)
        └──────────────▶ src/types, src/schemas, src/config ◀──────┘
```

| Слой | Каталоги | Правило |
| --- | --- | --- |
| **Presentation** | `app/`, `pages/`, `layouts/`, `components/`, `features/`, `hooks/`, `store/` | Только отображение и вызов действий. Никаких порогов и проверок в компонентах. |
| **Business Logic** | `engine/state-machine`, `engine/validators`, `engine/rules`, `engine/dependencies` | Чистые типизированные функции, без React, IndexedDB и сети. Время и ID — через `EngineContext`. |
| **Data** | `services/` (Dexie, CSV-импорт, репозитории), `data/mock`, `data/scenarios` | Импорт, демо-данные, локальное хранилище. Валидация входа — схемами Zod. |
| Общее | `types/`, `schemas/`, `config/`, `utils/` | Доменные типы, Zod-схемы (сверяются с типами через `satisfies`), конфигурация. |

`store/launch-store.ts` (Zustand) — тонкий адаптер: вызывает функции движка, кладёт
результат в состояние и через `LaunchPersistence` пишет сессию и журнал аудита в IndexedDB.

### Структура `src/`

```
app/            точка сборки: App, router, routes, глобальные стили
components/     ui/ (shadcn/ui), layout/, common/
features/       objects, launch, invoice-validation, telemetry-validation,
                control-testing, dashboards, blockers, evidence, audit
pages/ layouts/ hooks/ store/
types/          доменные сущности
schemas/        Zod-схемы (импорт, хранилище, конфигурация)
data/           mock/ (демо-объект и генераторы), scenarios/ (TestScenario)
engine/         state-machine/, validators/, rules/, dependencies/
services/       db (Dexie), repositories, csv-import
config/         rules/ (версии наборов правил), env, stages
utils/
```

## Доменная модель (`src/types`)

`EnergyObject`, `ObjectPassport`, `GridConnection`, `Asset`, `AssetSignal`,
`InvoiceDataset`, `TelemetryDataset`, `Measurement`, `ValidationRule`, `ValidationResult`,
`LaunchStage`, `StageStatus`, `Blocker`, `Evidence`, `ControlCommand`, `ControlTest`,
`Dashboard`, `DashboardBlock`, `AuditEvent`, `LaunchSession`, `TestScenario`, а также
`RulesConfig`, `StageConfirmation`, `ConfirmationRequirement`, `LaunchInputs`.

Перечисления объявлены как `const`-массивы (`STAGE_IDS`, `STAGE_STATUSES`, …): из них
выводятся и TS-типы, и `z.enum` в схемах, поэтому у них один источник.

## Модель запуска — конечный автомат

Четыре последовательных этапа: **Meter History → Real-time Telemetry → Asset Control → Final Dashboards**.

```
NOT_STARTED ──START──▶ IN_PROGRESS ──COMPLETE──▶ COMPLETED (терминальный)
                          ▲     │
                  UNBLOCK │     │ BLOCK (открыт блокер)
                          │     ▼
                         BLOCKED
```

Операции (`src/engine/state-machine/machine.ts`) — чистые функции
`(session, …, ctx) → { ok, session | error, events: AuditEvent[] }`:
`startStage`, `applyValidationResults` (`validateStage`), `addManualBlocker`, `resolveBlocker`,
`addEvidence`, `addConfirmation`, `completeStage`.

Гарантии:

- этап нельзя **начать** и **завершить**, пока не завершён предыдущий (`PREVIOUS_STAGE_NOT_COMPLETED`);
- этап нельзя завершить, если: проверки не запускались (`VALIDATION_NOT_RUN`), провалено
  или пропущено блокирующее правило (`VALIDATION_FAILED`), есть открытые блокеры (`OPEN_BLOCKERS`),
  нет обязательных подтверждений с доказательствами допустимых типов (`MISSING_CONFIRMATIONS`);
- проваленное блокирующее правило автоматически открывает блокер и переводит этап в `BLOCKED`;
  повторная успешная проверка его закрывает. Вручную блокер проверки можно только снять с
  обоснованием (`WAIVED`), отметить его `RESOLVED` нельзя;
- сессия зафиксирована на версии правил; чужая версия отклоняется (`RULESET_MISMATCH`);
- каждое действие и каждый отказ записываются в журнал аудита, записи в нём только добавляются.

## Правила проверки

Метаданные: `src/engine/rules/catalog.ts`. Реализация: `src/engine/validators/*`.

| Этап | Правила |
| --- | --- |
| Meter History | MH-001 наличие данных · MH-002 шаг интервала · MH-003 полнота · MH-004 глубина истории · MH-005 сверка счёт/учёт · MH-006 подряд пропуски (warning) |
| Real-time Telemetry | TM-001 обязательные сигналы · TM-002 частота · TM-003 полнота · TM-004 задержка (перцентиль) · TM-005 период наблюдения |
| Asset Control | CT-001 покрытие команд · CT-002 квитирование · CT-003 исполнение · CT-004 интервалы между командами (warning) · CT-005 отработка уставки · CT-006 отказы |
| Final Dashboards | DB-001 обязательные блоки · DB-002 покрытие сигналов · DB-003 целостность привязок · DB-004 публикация |

## Конфигурация правил

`src/config/rules/ruleset.v1.ts` — единственное место, где хранятся пороги:

| Параметр | Ключ |
| --- | --- |
| Частота данных | `meterHistory.intervalMinutes`, `telemetry.expectedFrequencySec`, `telemetry.frequencyTolerancePct` |
| Минимальная полнота | `meterHistory.minCompletenessPct`, `telemetry.minCompletenessPct` |
| Максимальная задержка | `telemetry.maxLatencySec`, `telemetry.latencyPercentile` |
| Период проверки | `meterHistory.checkPeriodDays`, `telemetry.observationPeriodHours` |
| Допустимые интервалы команд | `control.min/maxIntervalBetweenCommandsSec`, `control.maxAcknowledgeSec`, `control.maxExecutionSec` |
| Обязательные сигналы | `telemetry.requiredSignals`, `dashboards.requiredSignals` |
| Требования к подтверждениям | `confirmations.<STAGE>[]` — роль, допустимые типы доказательств, минимум |

Как изменить правила: скопировать файл в `ruleset.vX.Y.Z.ts`, поменять `version`, зарегистрировать
его в `RULESETS` (`src/config/rules/index.ts`). Старые версии не удаляются: созданные сессии
продолжают работать на своей версии. Версию можно выбрать через `VITE_RULESET_VERSION`.
Внешний JSON с правилами проверяется функцией `parseRuleset()` (Zod).

## Демо-сценарии

`src/data/scenarios/catalog.ts`: `happy-path`, `meter-gaps`, `invoice-mismatch`, `telemetry-latency`,
`missing-signal`, `control-timeout`, `dashboard-unpublished`. В каждом сценарии заданы входные данные
и ожидаемый исход по этапам. `tests/unit/scenarios.test.ts` прогоняет все сценарии через движок.
Демо-объект и его реквизиты условные.

## Импорт CSV

`src/services/csv-import.ts` (PapaParse + Zod). Каждая строка проверяется схемой, ошибки возвращаются
с номером строки, и импорт при этом не прерывается.

- Измерения: `timestamp, signal_id, value, unit, quality?, received_at?`
- Счёт: `metering_point_id, period_start, period_end, energy_kwh, tariff_zone?`

## Оболочка приложения (фаза 03)

| Маршрут | Экран |
| --- | --- |
| `/overview` | Портфель запусков (6 объектов) |
| `/objects` | Реестр объектов |
| `/objects/:id` | Паспорт объекта |
| `/objects/:id/launch` | Карточка запуска |
| `/objects/:id/history` · `telemetry` · `control` · `dashboards` | Рабочие страницы четырёх этапов |
| `/objects/:id/audit` | Журнал переходов |
| `/settings` | Правила проверок и настройки интерфейса |
| `/design-system` | Витрина дизайн-системы |

- Боковая навигация из 8 разделов сворачивается до иконок (`Ctrl+B`, состояние запоминается); на узких экранах открывается как выдвижная панель.
- Шапка: хлебные крошки, глобальный поиск (`Ctrl+K`: разделы, объекты, этапы, правила), выбор объекта с поиском, статус запуска, время последней проверки, уведомления, профиль.
- Разделы объекта: контекстная навигация по этапам со статусами и правая контекстная панель (следующее действие, этапы, последние события) на широких экранах.
- Уведомления: всплывающие сообщения и история в колокольчике (блокировки, завершения этапов, отклонённые переходы).
- Каждый объект хранит собственную сессию запуска; переключение объекта не сбрасывает состояние других.

## Дизайн-система

Визуальный язык Oceli Energy (Manrope, `#052849`, `#018A98`, кнопки-«пилюли»). Токены — `src/design/tokens.ts`,
витрина всех компонентов и состояний — `/design-system`, описание и анализ референса — `docs/design-system.md`.
Расхождения с ТЗ и паспортом OE-04 — `docs/requirements-reconciliation.md`.

## Зависимости и дорожная карта

В фазе 01 установлены только библиотеки, которые уже используются в коде: React, TypeScript, Vite,
Tailwind CSS, shadcn/ui (Radix Slot, CVA, tailwind-merge, lucide-react), React Router, Zustand, Zod,
Dexie, PapaParse, date-fns, Vitest, Playwright; с фазы 02 — Radix UI (Dialog, Select, Tabs, Tooltip, Checkbox, Radio), TanStack Table, шрифты Manrope и JetBrains Mono (@fontsource).

Остальные библиотеки из стека добавляются в тех фазах, где они понадобятся:

| Библиотека | Где понадобится |
| --- | --- |
| React Hook Form (+ `@hookform/resolvers` для Zod) | формы паспорта объекта, подтверждений, блокеров |
| Apache ECharts | графики телеметрии и истории учёта, итоговые панели |
| Framer Motion | анимации переходов этапов |

Следующие шаги: сверить пороги с ТЗ и паспортом OE-04, сделать страницы этапов (импорт, отчёт
проверок, подтверждения, доказательства), реестр объектов, итоговые панели.
