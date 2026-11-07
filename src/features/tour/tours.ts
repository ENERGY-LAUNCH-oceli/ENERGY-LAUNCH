import { ROUTES } from '@/app/routes';
import { OBJECT_CATALOG } from '@/data/objects';
import { closeDialogs, fillIfEmpty, findVisible, press, setValue, sleep, typeInto, waitFor } from './demo';

/**
 * Туры «Обучения»: отдельный тур на каждый блок сайта. Шаг подсвечивает элемент и объясняет его,
 * при необходимости сам переходит на нужную страницу, нажимает кнопку или печатает пример в поле.
 * В туре ничего не сохраняется: форма нового объекта заполняется для показа и закрывается в конце.
 */

export interface TourCtx {
  objectId: string;
  signal: AbortSignal;
}

export interface TourStep {
  title: string;
  text: string;
  /** Куда перейти перед шагом (путь с параметрами). */
  route?: (ctx: TourCtx) => string;
  /** Что подсветить; нет элемента на экране (узкий экран, нет данных) – карточка по центру. */
  target?: string;
  /** Действие перед показом: открыть окно, напечатать пример. */
  before?: (ctx: TourCtx) => Promise<void> | void;
}

export interface TourDef {
  id: string;
  title: string;
  steps: TourStep[];
  /** Вернуть страницу как было: закрыть форму, очистить поиск. */
  cleanup?: () => void;
}

/* ---------- Новый объект: тур сам заполняет форму ---------- */

const DEMO = { name: 'Солнечный парк «Пример»', kind: 'Солнечная электростанция', street: 'Rue Exemple 1', city: 'Гент', postal: '9000', offtake: '54143000000000008', injection: '541445687468568586', pv: '12', battery: '4' };

const FORM = '#create-object-form';

/** Открыть форму «Новый объект» (если закрыта) и заполнить поля прошлых шагов – шаг можно открыть кнопкой «Назад». */
async function form(ctx: TourCtx, upTo: number) {
  if (!findVisible(FORM)) {
    press(await waitFor('[data-testid="add-object"]', ctx.signal));
    await waitFor(FORM, ctx.signal);
    await sleep(250, ctx.signal);
  }
  const fields: [number, string, string][] = [
    [1, '#obj-name', DEMO.name],
    [3, '#obj-kind', DEMO.kind],
    [4, '#obj-street', DEMO.street],
    [4, '#obj-city', DEMO.city],
    [4, '#obj-postalCode', DEMO.postal],
    [7, '#obj-eanInjection', DEMO.injection],
    [8, '#obj-pvCount', DEMO.pv],
    [8, '#obj-batteryCount', DEMO.battery],
  ];
  for (const [n, sel, v] of fields) if (n < upTo) fillIfEmpty(sel, v);
  if (upTo > 6) {
    fillIfEmpty('#obj-eanOfftake', DEMO.offtake);
    await sleep(80, ctx.signal);
    const fix = findVisible('[data-testid="eanOfftake-fix"]');
    if (fix) {
      press(fix);
      await sleep(150, ctx.signal);
    }
  }
}

const createObject: TourDef = {
  id: 'objects',
  title: 'Как создать новый объект',
  cleanup: closeDialogs,
  steps: [
    {
      route: () => ROUTES.objects,
      before: closeDialogs,
      target: '[data-testid="add-object"]',
      title: 'Кнопка «Добавить объект»',
      text: 'Новый объект начинается здесь, в разделе «Объекты». Нажмите «Далее» – мы откроем форму и заполним её за вас.',
    },
    {
      before: async (c) => {
        await form(c, 1);
        await typeInto('#obj-name', DEMO.name, c.signal);
      },
      target: '#obj-name',
      title: 'Название',
      text: 'Как объект называют в компании. Поле обязательное.',
    },
    {
      before: (c) => form(c, 2),
      target: '#obj-code',
      title: 'Код подставился сам',
      text: 'Код строится из названия латиницей. Его можно изменить – главное, чтобы он был уникальным в портфеле.',
    },
    {
      before: async (c) => {
        await form(c, 3);
        await typeInto('#obj-kind', DEMO.kind, c.signal);
      },
      target: `${FORM} fieldset:nth-of-type(1)`,
      title: 'Тип и ответственный',
      text: 'Тип объекта – для справки. «Ответственный за запуск» подставлен из вашей роли: он отвечает за этапы этого объекта.',
    },
    {
      before: async (c) => {
        await form(c, 4);
        await typeInto('#obj-street', DEMO.street, c.signal);
        await typeInto('#obj-city', DEMO.city, c.signal);
        await typeInto('#obj-postalCode', DEMO.postal, c.signal);
      },
      target: `${FORM} fieldset:nth-of-type(2)`,
      title: 'Адрес',
      text: 'Город обязателен, улица и индекс – по желанию. Адрес попадает в паспорт объекта (object.json).',
    },
    {
      before: async (c) => {
        await form(c, 5);
        await typeInto('#obj-eanOfftake', DEMO.offtake, c.signal);
      },
      target: '#obj-eanOfftake',
      title: 'EAN точки отбора',
      text: 'EAN – 18-значный код точки подключения из договора с сетевой компанией или из счёта. Мы ввели 17 цифр – форма сама посчитала контрольную цифру.',
    },
    {
      before: async (c) => {
        await form(c, 6);
        fillIfEmpty('#obj-eanOfftake', DEMO.offtake);
      },
      target: '[data-testid="eanOfftake-fix"]',
      title: '«Подставить контрольную цифру»',
      text: 'Последняя цифра EAN – контрольная по стандарту GS1. Если её не хватает или она неверная, нажмите эту ссылку – код станет правильным. Нажмём за вас на следующем шаге.',
    },
    {
      before: async (c) => {
        await form(c, 7);
        await typeInto('#obj-eanInjection', DEMO.injection, c.signal);
      },
      target: `${FORM} fieldset:nth-of-type(3)`,
      title: 'EAN точки отдачи',
      text: 'Второй код – для выдачи энергии в сеть. Он обязательно отличается от кода отбора; оба – по 18 цифр.',
    },
    {
      before: async (c) => {
        await form(c, 8);
        await typeInto('#obj-pvCount', DEMO.pv, c.signal);
        await typeInto('#obj-batteryCount', DEMO.battery, c.signal);
      },
      target: `${FORM} fieldset:nth-of-type(4)`,
      title: 'Оборудование',
      text: 'Сколько солнечных установок и батарей – до 2 000 каждого типа. Под полями видно, какие активы появятся в паспорте: PV1…PV12, Battery1…Battery4.',
    },
    {
      before: (c) => form(c, 9),
      target: '[data-testid="create-object-submit"]',
      title: 'Осталось нажать «Создать объект»',
      text: 'Откроется карточка запуска нового объекта, а дальше – загрузка истории счётчиков. В обучении мы ничего не создаём: нажмите «Готово», и форма закроется. Теперь попробуйте сами!',
    },
  ],
};

/* ---------- Остальные блоки ---------- */

const launch = (c: TourCtx) => ROUTES.objectSection(c.objectId, 'launch');

const overview: TourDef = {
  id: 'overview',
  title: 'Центр запуска: что требует внимания',
  cleanup: () => {
    const el = findVisible('[aria-label="Поиск объекта по названию или ID"]') as HTMLInputElement | null;
    if (el?.value) setValue(el, '');
  },
  steps: [
    { route: () => ROUTES.overview, target: '[data-tour="overview-stats"]', title: 'Готовность портфеля', text: 'Сколько объектов полностью готовы, в работе, заблокированы и ждут проверки. Цифры считаются из статусов этапов – вручную их не поменять.' },
    { target: '[data-tour="attention"]', title: 'Что требует внимания', text: 'Объекты с препятствиями и устаревшими проверками, самые срочные – сверху. Строка ведёт прямо к проблеме.' },
    { target: '[aria-label="Фильтр по статусу"]', title: 'Фильтр по статусу', text: 'Покажите только заблокированные, только готовые или те, что ждут проверки.' },
    {
      before: (c) => typeInto('[aria-label="Поиск объекта по названию или ID"]', OBJECT_CATALOG[0]?.code ?? 'OBJ', c.signal),
      target: '[aria-label="Поиск объекта по названию или ID"]',
      title: 'Поиск',
      text: 'Ищет по названию и коду объекта – мы ввели код первого объекта.',
    },
    {
      before: (c) => typeInto('[aria-label="Поиск объекта по названию или ID"]', '', c.signal),
      target: 'section[aria-label="Объекты"]',
      title: 'Строки объектов',
      text: 'Статус каждого этапа, прогресс, препятствия и время последней проверки. Нажмите строку – откроется карточка запуска.',
    },
    { target: 'button[aria-label="Текущий объект"]', title: 'Текущий объект', text: 'Название в шапке – объект, с которым вы работаете. Нажмите, чтобы переключиться: прогресс каждого объекта хранится отдельно.' },
    { target: 'button[aria-label^="Профиль"]', title: 'Роль', text: 'Меню профиля: демонстрационные роли «Инженер запуска», «Оператор» и «Ответственный за приёмку». От роли зависит, какие действия разрешены.' },
    { target: '[data-testid="storage-indicator"]', title: 'Где хранятся данные', text: '«PostgreSQL · сохранено» – каждое изменение записано на сервер и переживёт перезагрузку страницы.' },
  ],
};

const launchCard: TourDef = {
  id: 'launch',
  title: 'Карточка запуска и этапы',
  steps: [
    { route: launch, target: '[data-tour="object-tabs"]', title: 'Разделы объекта', text: 'Паспорт, запуск, четыре этапа, журнал и протокол. Точка у этапа – его статус: серая – не начат, синяя – в работе, красная – заблокирован, зелёная – завершён.' },
    { target: '[data-tour="launch-stages"]', title: 'Четыре этапа по порядку', text: 'История счётчиков → телеметрия → управление → дашборды. Следующий этап открывается только после завершения предыдущего.' },
    { target: '[data-tour="next-action"]', title: 'Следующее действие', text: 'Самое важное, что нужно сделать сейчас. Кнопка ведёт на страницу этапа.' },
    { target: '[data-tour="stage-workspace"]', title: 'Рабочая область этапа', text: 'Проверки выбранного этапа, препятствия с объяснением и подтверждения. Выберите другой этап карточкой выше.' },
    { target: 'section[aria-label="Журнал"]', title: 'Журнал объекта', text: 'Последние действия по объекту: кто, когда и с какой версией правил. Полный журнал – на вкладке «Журнал».' },
  ],
};

const history: TourDef = {
  id: 'history',
  title: 'Этап 1: история счётчиков',
  steps: [
    { route: (c) => ROUTES.objectSection(c.objectId, 'history'), target: '[data-tour="stage-bar"]', title: 'Этап 1 · История счётчиков', text: 'Номер, название и статус этапа. Ниже – сколько проверок пройдено, с ошибками и ожидают.' },
    { target: '[data-tour="stage-actions"]', title: 'Действия этапа', text: '«Начать этап» → «Запустить проверки» → «Подтвердить требования» → «Завершить этап». Кнопки появляются по мере продвижения; завершить можно, только когда проверки пройдены и требования подтверждены.' },
    { target: '#mh-upload', title: 'Загрузка invoice.csv', text: 'Перетащите официальную выгрузку или выберите файл: 24 месяца с шагом 15 минут, время в UTC. Новая загрузка – новая версия, прежняя остаётся в истории, а начатый этап перепроверяется сам.' },
    { target: '[data-tour="next-action"]', title: 'Что исправить', text: 'Если проверка нашла проблему, здесь сказано, что сделать: например, получить выгрузку за недостающие месяцы.' },
    { target: '[data-tour="check-blocks"]', title: 'Результаты проверок', text: 'Покрытие 24 месяцев, полнота интервалов, дубли, единицы и знаки, время, EAN. Каждый блок – группа правил набора v1.5.0.' },
    { target: '#mh-coverage', title: 'Покрытие по месяцам', text: 'Какие месяцы есть в выгрузке, а каких не хватает.' },
    { target: '#mh-issues', title: 'Найденные проблемы', text: 'Каждая проблема – с правилом, местом в файле и тем, как её исправить.' },
  ],
};

const telemetry: TourDef = {
  id: 'telemetry',
  title: 'Этап 2: телеметрия и паспорт',
  steps: [
    { route: (c) => ROUTES.objectSection(c.objectId, 'telemetry'), target: '[data-tour="stage-bar"]', title: 'Этап 2 · Телеметрия', text: 'Открывается после завершения этапа 1. Проверяется поток данных установленных активов за 48 часов до точки проверки.' },
    { target: '#tm-inputs', title: 'Входные данные', text: 'telemetry.csv – сигналы активов, и паспорт объекта (object.json) с картой сигналов. Исправленный паспорт можно загрузить здесь же.' },
    { target: '#tm-passport', title: 'Паспорт и активы', text: 'Какие активы есть у объекта и какие сигналы от каждого ожидаются.' },
    { target: '#tm-signals', title: 'Карта сигналов', text: 'Найдены ли в файле обязательные сигналы каждого актива, свежие ли они (не старше 30 минут) и в правильных ли единицах.' },
    { target: '#tm-heatmap', title: 'Тепловая карта качества', text: 'Полнота по каждому сигналу и интервалу: нужно не меньше 99 %. Пробелы видны сразу – нажмите ячейку, чтобы увидеть подробности.' },
    { target: '#tm-issues', title: 'Найденные проблемы', text: 'Что не так с потоком и как исправить. После новой загрузки проверка повторяется автоматически.' },
  ],
};

const control: TourDef = {
  id: 'control',
  title: 'Этап 3: тесты управления',
  steps: [
    { route: (c) => ROUTES.objectSection(c.objectId, 'control'), target: '[data-tour="control-sandbox"]', title: 'Только тестовый контур', text: 'Команды уходят в локальный имитатор контроллера – реальное оборудование не управляется.' },
    { target: '[data-tour="stage-bar"]', title: 'Этап 3 · Управление', text: 'Открывается после телеметрии. Требует успешного теста каждого управляемого актива.' },
    { target: '#ct-assets', title: 'Управляемые активы', text: 'Батареи (заряд и разряд) и солнечные установки (ограничение мощности) с результатом последнего теста каждого.' },
    { target: '#ct-test', title: 'Тестовая команда', text: 'Выберите актив, мощность и сценарий имитатора и нажмите «Отправить тестовую команду». Тест засчитывается, когда подтверждены три события: отправка, приём контроллером за ≤ 5 с и изменение мощности в допуске за ≤ 60 с.' },
    { target: '#ct-commands', title: 'Журнал команд', text: 'Все отправленные команды по времени. Нажмите команду – увидите события и причину результата. После тестов – «Запустить проверки» этапа.' },
  ],
};

const dashboards: TourDef = {
  id: 'dashboards',
  title: 'Этап 4: дашборды и приёмка',
  steps: [
    { route: (c) => `${ROUTES.objectSection(c.objectId, 'dashboards')}?tab=panel`, target: '[data-tour="stage-bar"]', title: 'Этап 4 · Финальные дашборды', text: 'Последний этап: рабочая панель объекта, её публикация и приёмка.' },
    { target: '[data-testid="current-role"]', title: 'Ваша роль', text: 'Настраивать панель и принимать её могут разные роли. Роль переключается в меню профиля справа вверху.' },
    { route: (c) => `${ROUTES.objectSection(c.objectId, 'dashboards')}?tab=builder`, target: '#db-tabs', title: 'Конструктор', text: 'Соберите панель из обязательных групп виджетов. Изменения копятся в черновике; кнопка публикации фиксирует версию.' },
    { route: (c) => `${ROUTES.objectSection(c.objectId, 'dashboards')}?tab=acceptance`, target: '#db-tabs', title: 'Приёмка', text: 'Ответственный за приёмку проверяет каждый блок опубликованной версии и принимает или отклоняет панель. После приёмки этап 4 можно завершить.' },
    { route: (c) => `${ROUTES.objectSection(c.objectId, 'dashboards')}?tab=panel`, target: '#db-tabs', title: 'Панель', text: 'Так опубликованную панель видит эксплуатация. Когда все четыре этапа завершены – объект готов к эксплуатации.' },
  ],
};

const blockers: TourDef = {
  id: 'blockers',
  title: 'Препятствия и следующее действие',
  steps: [
    { route: () => ROUTES.blockers, target: '[data-testid="blocker-filters"]', title: 'Все препятствия', text: 'Незакрытые проблемы всех объектов. Фильтры – по объекту, этапу, критичности и статусу.' },
    { target: '[data-testid="blockers-table"]', title: 'Таблица препятствий', text: 'Нажмите строку – откроется разбор: что произошло, какое правило нарушено, какие данные использовались и как исправить.' },
    { route: launch, target: '[data-testid="blocker-next-action"]', title: 'Ссылка на исправление', text: 'У препятствия «Следующее действие» – ссылка: она откроет страницу этапа и подсветит нужный блок.' },
    { title: 'Обойти нельзя', text: 'Препятствие закрывается только исправленными данными и повторной проверкой. Обязательные проверки через интерфейс не отключаются, а отсутствие данных никогда не считается успехом.' },
  ],
};

const audit: TourDef = {
  id: 'audit',
  title: 'Журнал, аудит и протокол',
  steps: [
    { route: () => ROUTES.auditTrail, target: '[data-testid="audit-table"]', title: 'Журнал аудита', text: 'Все действия: этапы, проверки, загрузки, подтверждения, команды, публикации и отказы в доступе. Записи только добавляются – их нельзя изменить или удалить.' },
    {
      before: async (c) => {
        press(await waitFor('[data-testid="audit-table"] tbody tr', c.signal, 3000));
      },
      target: '[data-testid="audit-replay"]',
      title: 'Состояние на момент записи',
      text: 'Мы выбрали запись – вот статусы этапов, последние прогоны и открытые препятствия на тот момент. Решения воспроизводимы по журналу.',
    },
    { route: (c) => ROUTES.objectSection(c.objectId, 'protocol'), target: '[data-testid="protocol"]', title: 'Протокол запуска', text: 'Итог по этапам, проверкам и подтверждениям с хешами файлов. Кнопка печати сохраняет протокол в PDF.' },
  ],
};

const scenarios: TourDef = {
  id: 'scenarios',
  title: 'Демо-сценарии',
  steps: [
    { route: () => ROUTES.scenarios, target: '[data-testid="scenario-metrics"]', title: 'Метрики качества', text: 'Сколько сценариев пройдено, верность статусов, найденные препятствия и ложные завершения.' },
    { target: '[data-testid="run-all"]', title: 'Запустить все', text: 'Одиннадцать сценариев ТЗ подряд, каждый – в своей песочнице. Портфель объектов не меняется.' },
    { target: '[data-testid="run-scenario"]', title: 'Один сценарий', text: 'Запустите сценарий отдельно и сравните фактический результат с ожидаемым поведением из ТЗ.' },
  ],
};

const settings: TourDef = {
  id: 'settings',
  title: 'Настройки, данные и подсказки',
  steps: [
    { route: () => ROUTES.settings, target: '[data-tour="settings-appearance"]', title: 'Внешний вид', text: 'Светлая или тёмная тема и акцентный цвет. Быстрое переключение темы – кнопка с луной внизу боковой панели.' },
    { target: '[data-tour="settings-storage"]', title: 'Хранилище', text: 'Где сохраняются объекты, ход запуска и журнал: PostgreSQL на сервере. Без сервера – только в браузере до перезагрузки.' },
    { target: '[data-testid="storage-indicator"]', title: 'Индикатор сохранения', text: 'Всегда видно, записано ли последнее изменение.' },
    { title: 'Правая кнопка мыши', text: 'Своё меню: действия с объектом под курсором, навигация, печать, тема, обучение по текущей странице и «Помощь» – задать вопрос по сайту. Меню браузера – Shift + правая кнопка.' },
    { title: 'Горячие клавиши', text: 'Ctrl + B – свернуть или развернуть навигацию (на русской раскладке тоже). В туре: ← → – шаги, Esc – закрыть.' },
  ],
};

export const TOURS: Record<string, TourDef> = Object.fromEntries([createObject, overview, launchCard, history, telemetry, control, dashboards, blockers, audit, scenarios, settings].map((t) => [t.id, t]));

/** Урок для текущей страницы – пункт контекстного меню «Обучение по этой странице». */
export function tourForPath(pathname: string): string | null {
  const m = /^\/objects\/[^/]+(?:\/([^/]+))?/.exec(pathname);
  if (m) {
    const section = m[1];
    if (!section) return 'objects';
    if (section === 'protocol') return 'audit';
    return TOURS[section] ? section : null;
  }
  const map: Record<string, string> = { '/overview': 'overview', '/objects': 'objects', '/blockers': 'blockers', '/evidence': 'blockers', '/audit': 'audit', '/scenarios': 'scenarios', '/settings': 'settings' };
  return map[pathname.replace(/\/+$/, '')] ?? null;
}
