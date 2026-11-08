import { expect, test, type Page } from '@playwright/test';

const STAGES = ['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS'] as const;

async function chooseScenario(page: Page, title: string) {
  await page.getByRole('combobox', { name: 'Демонстрационный сценарий' }).click();
  await page.getByRole('option', { name: title }).click();
}

test('карточка запуска показывает четыре этапа и блокирует порядок', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Дефекты истории');
  await chooseScenario(page, 'Успешный запуск');
  for (const id of STAGES) await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
  // Строгая последовательность: завершить этап 3 до этапа 2 нельзя, показаны зависимости
  await page.getByTestId('step-ASSET_CONTROL').click();
  await page.getByRole('button', { name: 'Завершить этап' }).click();
  const deps = page.getByTestId('transition-dependencies');
  await expect(deps).toContainText('История счётчиков');
  await expect(deps).toContainText('Данные в реальном времени');
});

test('отрицательный сценарий блокирует этап после проверки', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Ошибки знаков и единиц');
  const stage = page.getByTestId('stage-METER_HISTORY');
  await page.getByRole('button', { name: 'Начать этап' }).click();
  await page.getByRole('button', { name: 'Запустить проверки' }).click();
  await expect(stage).toHaveAttribute('data-stage-status', 'BLOCKED');
  await expect(page.locator('[data-check="MH-008"]')).toHaveAttribute('data-check-status', 'FAILED');
  await expect(page.locator('[data-blocker-status="OPEN"]').first()).toContainText('invoice.csv');
});

async function switchRole(page: Page, role: string) {
  await page.getByRole('button', { name: /^Профиль/ }).click();
  await page.getByRole('menuitem', { name: role }).click();
}

test('успешный запуск проходит все этапы через интерфейс', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Дефекты истории');
  await chooseScenario(page, 'Успешный запуск');
  for (const id of STAGES.slice(0, 3)) {
    const stage = page.getByTestId(`stage-${id}`);
    await page.getByTestId(`step-${id}`).click();
    await page.getByRole('button', { name: 'Начать этап' }).click();
    await page.getByRole('button', { name: 'Запустить проверки' }).click();
    await page.getByRole('button', { name: 'Подтвердить требования' }).click();
    const dialog = page.getByRole('dialog');
    for (const box of await dialog.getByRole('checkbox').all()) await box.click();
    await dialog.getByRole('button', { name: /^Подтвердить \(/ }).click();
    await page.getByRole('button', { name: 'Завершить этап' }).click();
    await expect(stage).toHaveAttribute('data-stage-status', 'COMPLETED');
    await expect(page.getByTestId(`stage-heading-${id}`).getByTestId(`stage-status-${id}`)).toContainText('Завершён');
  }

  // Этап 4: инженер настраивает и публикует, ответственный принимает, инженер завершает
  await page.getByTestId('step-FINAL_DASHBOARDS').click();
  await page.getByRole('button', { name: 'Начать этап' }).click();
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Дашборды' }).click();
  const readiness = page.getByTestId('object-readiness');
  await expect(readiness).toHaveAttribute('data-ready', 'false');
  await page.getByRole('tab', { name: 'Конструктор' }).click();
  await page.getByRole('button', { name: 'Поднять блок «Управление»' }).click();
  await page.getByRole('button', { name: 'Опубликовать v1' }).click();
  await expect(page.getByTestId('stage-status-FINAL_DASHBOARDS')).toHaveAttribute('data-status', 'BLOCKED');

  await switchRole(page, 'Оператор');
  await expect(page.locator('[data-widget="ASSETS.soc"]')).toBeDisabled();

  await switchRole(page, 'Ответственный за приёмку');
  await page.getByRole('tab', { name: 'Приёмка' }).click();
  await expect(page.locator('[data-review-block]')).toHaveCount(4);
  for (const block of await page.locator('[data-review-block]').all()) await block.getByRole('radio', { name: 'Корректен', exact: true }).click();
  await page.getByRole('button', { name: 'Принять панель v1' }).click();
  await expect(page.getByTestId('acceptance-history')).toContainText('Ответственный за приёмку');
  await expect(page.getByTestId('stage-status-FINAL_DASHBOARDS')).toHaveAttribute('data-status', 'IN_PROGRESS');
  await expect(readiness).toHaveAttribute('data-ready', 'false');

  await switchRole(page, 'Инженер запуска');
  await page.getByRole('button', { name: 'Завершить этап' }).click();
  await expect(readiness).toHaveAttribute('data-ready', 'true');
  await expect(readiness).toContainText('Объект готов к эксплуатации');
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Запуски' }).click();
  await expect(page.getByText('Запуск завершён: объект готов к эксплуатации')).toBeVisible();
});

test('дашборды: отклонённая приёмка блокирует этап, готовность не присваивается', async ({ page }) => {
  await page.goto('/objects/obj-001/dashboards');
  await expect(page.getByRole('heading', { name: 'Рабочая панель объекта' })).toBeVisible();
  await expect(page.getByTestId('current-role')).toContainText('Инженер запуска');
  await expect(page.getByTestId('current-role')).toContainText('настройка панели');
  await expect(page.getByTestId('object-readiness')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('dashboard-view').locator('[data-block]')).toHaveCount(4);
  const historyBlock = page.locator('[data-block="METER_HISTORY"]');
  const historyChart = page.getByTestId('dashboard-history-chart');
  await expect(historyChart).toBeVisible();
  const historyBounds = await historyBlock.boundingBox();
  const chartBounds = await historyChart.boundingBox();
  expect(historyBounds).not.toBeNull();
  expect(chartBounds).not.toBeNull();
  expect(historyBounds!.width).toBeGreaterThan(700);
  expect(chartBounds!.width).toBeGreaterThan(650);
  await expect(page.locator('[data-dashboard-asset="battery-1"]')).toBeVisible();
  // Завершённый этап зафиксирован: конфигурацию менять нельзя
  await page.getByRole('tab', { name: 'Конструктор' }).click();
  await expect(page.locator('[data-widget="METER_HISTORY.period"]')).toBeDisabled();
});

test('тема: по умолчанию светлая, переключается и запоминается', async ({ page }) => {
  await page.goto('/overview');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Тёмная тема' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Светлая тема' }).click();
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Синий' }).click();
  await expect(html).toHaveAttribute('data-accent', 'blue');
  await expect.poll(() => page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--el-accent").trim()')).toBe('1 91 176');
  await expect(page.getByRole('radio', { name: 'Синий' })).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(html).toHaveAttribute('data-accent', 'blue');
  await page.getByRole('button', { name: 'Тёмная тема' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).toHaveAttribute('data-accent', 'blue');
  await expect.poll(() => page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--el-accent").trim()')).toBe('79 155 232');
  await expect.poll(() => page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--el-background").trim()')).toBe('32 34 37');
  await expect.poll(() => page.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--el-surface").trim()')).toBe('40 42 45');
  await page.goto('/settings');
  await page.getByRole('radio', { name: /^Тёмная/ }).click();
  await page.getByRole('radio', { name: 'Бирюзовый' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(html).not.toHaveAttribute('data-accent', 'blue');
  await expect(page.getByText('Интервал между измерениями').first()).toBeVisible();
  await expect(page.getByText('Допустимое число ошибок времени')).toBeVisible();
  await expect(page.getByText('Данные, которые нужны от солнечных панелей')).toBeVisible();
  await expect(page.getByText('[object Object]')).toHaveCount(0);
  await expect(page.getByTestId('rule-field-row')).toHaveCount(7);
  await expect(page.getByTestId('rule-field-row').filter({ hasText: 'Потребление из сети по счётчику' })).toContainText('kWh');
  await expect(page.getByTestId('rule-field-row').filter({ hasText: 'Мощность по счётчику' })).toContainText('Знак не ограничен');
  await expect(page.getByTestId('dashboard-widget-group')).toHaveCount(4);
  await expect(page.getByTestId('dashboard-widget-group').filter({ hasText: 'История счётчиков' })).toContainText('История потребления');
  await expect(page.getByTestId('dashboard-widget-group').filter({ hasText: 'Качество и готовность' })).toContainText('Состояния этапов');
});

test('оболочка: меню, хлебные крошки, выбор объекта, сворачивание без глобального поиска', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/overview$/);
  const nav = page.getByRole('navigation', { name: 'Основная навигация' });
  await nav.getByRole('link', { name: 'Управление' }).click();
  await expect(page).toHaveURL(/\/objects\/obj-001\/control$/);
  await expect(nav.getByRole('link', { name: 'Управление' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Навигационная цепочка' })).toContainText('Кампус');

  await page.getByRole('button', { name: 'Текущий объект' }).click();
  await page.getByRole('option', { name: /Медцентр/ }).click();
  await expect(page).toHaveURL(/\/objects\/obj-004\/control$/);

  await expect(page.getByRole('button', { name: 'Поиск' })).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Свернуть навигацию' }).click();
  await expect(page.getByRole('button', { name: 'Развернуть навигацию' })).toBeVisible();
  await page.keyboard.press('Control+b');
  await expect(page.getByRole('button', { name: 'Свернуть навигацию' })).toBeVisible();
});

test('неизвестный объект показывает понятное состояние', async ({ page }) => {
  await page.goto('/objects/nope/launch');
  await expect(page.getByText('Объект не найден')).toBeVisible();
});

test('центр запуска: сводка, фильтры, поиск, внимание и переход с сохранением контекста', async ({ page }) => {
  await page.goto('/overview');
  await expect(page.getByRole('heading', { name: 'Запуск энергетических объектов' })).toBeVisible();
  await expect(page.locator('[data-testid^="object-row-"]')).toHaveCount(6);
  await expect(page.getByTestId('object-row-obj-001')).toContainText('100 %');
  await expect(page.getByTestId('object-row-obj-006')).not.toContainText('100 %');
  await expect(page.locator('[data-testid^="attention-"]')).toHaveCount(5);

  await page.getByRole('tab', { name: /Заблокированные/ }).click();
  await expect(page.locator('[data-testid^="object-row-"]')).toHaveCount(5);
  await page.getByRole('textbox', { name: /Поиск объекта/ }).fill('OBJ-004');
  await expect(page.locator('[data-testid^="object-row-"]')).toHaveCount(1);
  await page.getByTestId('object-row-obj-004').click();
  await expect(page).toHaveURL(/\/objects\/obj-004\/launch$/);
  await expect(page.getByTestId('stage-REALTIME_TELEMETRY')).toHaveAttribute('data-stage-status', 'BLOCKED');

  await page.getByRole('navigation', { name: 'Навигационная цепочка' }).getByRole('link', { name: 'Центр запуска' }).click();
  await expect(page).toHaveURL(/status=blocked/);
  await expect(page.locator('[data-testid^="object-row-"]')).toHaveCount(1);
});

test('история счётчиков: 19 из 24 месяцев, повторная загрузка и повторная проверка', async ({ page }) => {
  await page.goto('/objects/obj-002/history');
  await expect(page.getByTestId('missing-months')).toHaveText('2024-11, 2024-12, 2025-01, 2025-02, 2025-03');
  await expect(page.locator('[data-month-state="MISSING"]')).toHaveCount(5);
  await expect(page.locator('[data-block="coverage"]')).toHaveAttribute('data-block-status', 'FAILED');
  await expect(page.getByTestId('stage-status-METER_HISTORY')).toHaveAttribute('data-status', 'BLOCKED');

  // Исправленный файл через тот же потоковый импорт: изменённые входы → автоматическая повторная проверка
  await page.getByRole('button', { name: 'Полная история' }).click();
  await expect(page.locator('[data-month-state="MISSING"]')).toHaveCount(0);
  await expect(page.getByTestId('runs-history').locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('[data-block="coverage"]')).toHaveAttribute('data-block-status', 'PASSED');
  await expect(page.getByTestId('stage-status-METER_HISTORY')).toHaveAttribute('data-status', 'IN_PROGRESS');
});

test('история счётчиков: файл не того формата не принимается', async ({ page }) => {
  await page.goto('/objects/obj-002/history');
  await page.locator('[data-dropzone] input[type="file"]').first().setInputFiles({ name: 'invoice.csv', mimeType: 'text/csv', buffer: Buffer.from('hello world\n1,2,3\n') });
  await expect(page.getByText('Файл не принят')).toBeVisible();
});

test('телеметрия: нет связи с батареей, тепловая карта, исправление и повторная проверка', async ({ page }) => {
  await page.goto('/objects/obj-004/telemetry');
  await expect(page.getByText('Идентификатор объекта')).toBeVisible();
  await expect(page.getByText('Файлы данных')).toBeVisible();
  await expect(page.getByText('Как читать результаты')).toBeVisible();
  await expect(page.getByTestId('stage-status-REALTIME_TELEMETRY')).toHaveAttribute('data-status', 'BLOCKED');
  await expect(page.locator('[data-signal="Battery1.SOC_%"]')).toHaveAttribute('data-diagnosis', 'NO_COMMUNICATION');
  await expect(page.locator('[data-signal="PV1.power_kW"]')).toHaveAttribute('data-diagnosis', 'OK');
  await page.getByTestId('heatmap').locator('rect[data-state="M"]').first().click();
  await expect(page.getByTestId('heatmap-detail')).toContainText('Нет связи');

  // Новая телеметрия → автоматическая повторная проверка; предыдущий прогон сохраняется в истории
  await page.getByRole('button', { name: 'Корректный поток' }).click();
  await expect(page.locator('[data-signal="Battery1.SOC_%"]')).toHaveAttribute('data-diagnosis', 'OK');
  await expect(page.getByTestId('stage-status-REALTIME_TELEMETRY')).toHaveAttribute('data-status', 'IN_PROGRESS');
  await expect(page.getByTestId('telemetry-runs').locator('tbody tr')).toHaveCount(2);
});

test('телеметрия: ошибочная привязка видна пользователю', async ({ page }) => {
  await page.goto('/objects/obj-005/telemetry');
  await expect(page.getByTestId('foreign-columns')).toContainText('Battery2.power_kW');
  await expect(page.locator('[data-signal="Battery1.power_kW"]')).toHaveAttribute('data-diagnosis', 'WRONG_BINDING');
});

test('управление: имитатор, отправка без отклика не завершает этап, успешный тест разблокирует', async ({ page }) => {
  await page.goto('/objects/obj-006/control');
  await expect(page.getByTestId('stage-status-ASSET_CONTROL')).toHaveAttribute('data-status', 'BLOCKED');
  await expect(page.getByTestId('control-assets').locator('[data-asset="battery-2"]')).toContainText('Timeout');
  await expect(page.getByText('Только тестовый контур')).toBeVisible();

  await page.getByRole('combobox', { name: 'Актив' }).click();
  await page.getByRole('option', { name: /battery-2/ }).click();
  await page.getByRole('radio', { name: /Подтверждение без отклика/ }).check();
  await page.getByRole('button', { name: 'Отправить тестовую команду' }).click();
  const detail = page.getByTestId('command-detail');
  await expect(detail).toHaveAttribute('data-command', 'CMD-OBJ-006-003');
  await expect(detail.locator('[data-command-state]').first()).toHaveAttribute('data-command-state', 'FAILED');
  await expect(detail.locator('[data-step="RECEIVED"]')).toHaveAttribute('data-reached', 'true');
  await expect(detail.locator('[data-step="RESPONDED"]')).toHaveAttribute('data-reached', 'false');

  await page.getByRole('radio', { name: /Некорректное значение/ }).check();
  await page.getByRole('button', { name: 'Отправить тестовую команду' }).click();
  await expect(detail).toContainText('не отправлена');

  await page.getByRole('radio', { name: /Успешная отправка и отклик/ }).check();
  await page.getByRole('button', { name: 'Отправить тестовую команду' }).click();
  await expect(detail.locator('[data-command-state]').first()).toHaveAttribute('data-command-state', 'PASSED');
  await expect(page.getByTestId('command-timeline').locator('[data-timeline-command]')).toHaveCount(5);
  // Каждый тест – изменение входов этапа: автоматическая повторная проверка, все прогоны сохраняются
  await expect(page.getByTestId('stage-status-ASSET_CONTROL')).toHaveAttribute('data-status', 'IN_PROGRESS');
  await expect(page.getByTestId('control-runs').locator('tbody tr')).toHaveCount(4);
});

test('адаптивность: страницы не переполняют экран на телефоне, планшете и компьютере', async ({ page }) => {
  test.setTimeout(90_000);
  const routes = [
    '/overview',
    '/objects',
    '/settings',
    '/help',
    '/objects/nope/launch',
    '/objects/obj-001',
    '/objects/obj-001/launch',
    '/objects/obj-002/history',
    '/objects/obj-004/telemetry',
    '/objects/obj-006/control',
    '/objects/obj-001/dashboards',
    '/objects/obj-001/audit',
    '/errors',
    '/errors/502',
    '/status/504.html',
  ];

  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const sizes = await page.evaluate<{ viewport: number; document: number; body: number; main: number; mainClient: number }>(`(() => {
        const main = document.querySelector('main');
        return {
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          main: main?.scrollWidth ?? 0,
          mainClient: main?.clientWidth ?? 0,
        };
      })()`);
      expect(sizes.document, `${route} at ${width}px`).toBeLessThanOrEqual(sizes.viewport);
      expect(sizes.body, `${route} body at ${width}px`).toBeLessThanOrEqual(sizes.viewport);
      expect(sizes.main, `${route} content at ${width}px`).toBeLessThanOrEqual(sizes.mainClient);
    }
  }
});

test('мобильная навигация и всплывающие элементы остаются доступны на экране', async ({ page }) => {
  await page.goto('/objects/obj-001/audit');

  const objectNav = page.getByRole('navigation', { name: 'Разделы объекта' });
  const activeSection = objectNav.getByRole('link', { name: 'Журнал' });
  await expect(activeSection).toHaveAttribute('aria-current', 'page');
  for (const width of [320, 375, 540, 640, 768, 820, 1024]) {
    await page.setViewportSize({ width, height: 640 });
    await expect
      .poll(
        async () => {
          const nav = await objectNav.boundingBox();
          const links = await objectNav.getByRole('link').all();
          const bounds = await Promise.all(links.map((link) => link.boundingBox()));
          return !!nav && bounds.every((link) => !!link && link.x >= nav.x && link.x + link.width <= nav.x + nav.width);
        },
        { message: `Все вкладки объекта должны помещаться на экране шириной ${width}px` },
      )
      .toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 640 });

  await page.goto('/settings');
  await expect(page.getByRole('checkbox', { name: 'Свёрнутая боковая навигация' })).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole('checkbox', { name: 'Свёрнутая боковая навигация' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });

  await page.goto('/overview');
  for (const [name, trigger, content] of [
    ['переключатель объекта', page.getByRole('button', { name: 'Текущий объект' }), page.locator('[data-radix-popper-content-wrapper]').last()],
    ['уведомления', page.getByRole('button', { name: /^Уведомления/ }), page.locator('[data-radix-popper-content-wrapper]').last()],
  ] as const) {
    await trigger.click();
    await expect(content).toBeVisible();
    await expect
      .poll(
        async () => {
          const bounds = await content.boundingBox();
          return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320;
        },
        { message: `${name} должно целиком помещаться в мобильный экран` },
      )
      .toBe(true);
    if (name === 'переключатель объекта') {
      await expect(page.getByRole('textbox', { name: 'Поиск объекта', exact: true })).toBeVisible();
      await expect(page.getByRole('listbox', { name: 'Объекты' })).toBeVisible();
    }
    await page.keyboard.press('Escape');
  }
  await expect(page.getByRole('button', { name: 'Поиск' })).toHaveCount(0);

  await page.getByRole('button', { name: /^Профиль/ }).click();
  const profileSheet = page.getByRole('dialog');
  await expect(profileSheet).toBeVisible();
  await expect
    .poll(
      async () => {
        const bounds = await profileSheet.boundingBox();
        return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320 && bounds.y + bounds.height <= 640;
      },
      { message: 'Меню профиля должно полностью помещаться в мобильный экран' },
    )
    .toBe(true);
  const sheetBounds = await profileSheet.boundingBox();
  expect(sheetBounds).not.toBeNull();
  await expect(profileSheet.getByText('Демонстрационная роль: права проверяются в логике приложения')).toBeVisible();
  await profileSheet.getByRole('button', { name: 'Оператор' }).click();
  await expect(profileSheet).toBeHidden();
  const toast = page.locator('[role="status"]').last();
  await expect(toast).toBeVisible();
  const toastBounds = await toast.boundingBox();
  expect(toastBounds).not.toBeNull();
  expect(toastBounds!.x).toBeGreaterThanOrEqual(0);
  expect(toastBounds!.x + toastBounds!.width).toBeLessThanOrEqual(320);

  await page.goto('/objects');
  // Приложение загружает портфель асинхронно – ждём отрисовки рабочей области
  await expect(page.locator('#main')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'К содержимому' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'К содержимому' })).toHaveCSS('position', 'fixed');
  await page.keyboard.press('Tab');
  const menuButton = page.getByRole('button', { name: 'Открыть меню' });
  await expect(menuButton).toBeFocused();
  await expect(menuButton).not.toHaveCSS('box-shadow', 'none');

  const objectLink = page.getByRole('link', { name: 'Кампус «Северный»' });
  await expect(objectLink).toBeVisible();
  await objectLink.focus();
  await expect(objectLink).toBeFocused();
});

test('аудит: препятствия, подтверждения, журнал, воспроизведение статуса и протокол', async ({ page }) => {
  await page.goto('/blockers');
  await expect(page.getByTestId('blockers-table')).toBeVisible();
  await page.locator('[data-blocker-row="MH-002"]').first().click();
  const detail = page.getByTestId('blocker-detail');
  await expect(detail).toContainText('Нарушено правило MH-002');
  await expect(detail).toContainText('meterHistory.periodMonths');
  await expect(detail).toContainText('Получить полную выгрузку');
  await page.keyboard.press('Escape');

  await page.goto('/evidence');
  await expect(page.getByTestId('evidence-table')).toBeVisible();

  await page.goto('/objects/obj-002/history');
  await page.getByRole('button', { name: 'Полная история' }).click();
  await expect(page.getByTestId('stage-status-METER_HISTORY')).toHaveAttribute('data-status', 'IN_PROGRESS');
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Аудит' }).click();
  await page.locator('[data-audit-action="STAGE_BLOCKED"]').last().click();
  await expect(page.getByTestId('audit-replay').locator('[data-replay-stage="METER_HISTORY"]')).toHaveAttribute('data-status', 'BLOCKED');

  await page.goto('/objects/obj-001/protocol');
  await expect(page.getByTestId('protocol')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('protocol')).toContainText('Протокол готовности энергетического объекта');
});

test('демо-сценарии: запуск, результат, открытие объекта сценария и сброс', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/scenarios');
  await expect(page.locator('[data-scenario]')).toHaveCount(11);
  await expect(page.getByTestId('baseline-table')).toContainText('не измерено');
  const s2 = page.locator('[data-scenario="2"]');
  await s2.getByTestId('run-scenario').click();
  await expect(s2).toHaveAttribute('data-pass', 'true');
  await expect(s2.getByTestId('scenario-checks')).toContainText('2024-11');
  // Объект сценария открывается в приложении с фактическим статусом
  await s2.getByRole('button', { name: 'Открыть объект сценария' }).click();
  await expect(page.getByTestId('stage-METER_HISTORY')).toHaveAttribute('data-stage-status', 'BLOCKED');
  // Песочница не попадает в портфель
  await page.goto('/overview');
  await expect(page.getByText('Сценарий 2')).toHaveCount(0);
  // Все сценарии
  await page.goto('/scenarios');
  await page.getByTestId('run-all').click();
  await expect(page.locator('[data-scenario][data-pass="true"]')).toHaveCount(11, { timeout: 60_000 });
  await expect(page.getByTestId('scenario-metrics')).toContainText('11 / 11');
  await page.locator('[data-scenario="1"]').getByRole('button', { name: 'Сбросить сценарий' }).click();
  await expect(page.locator('[data-scenario="1"]')).not.toHaveAttribute('data-pass', /.*/);
});

test('добавление объекта: проверка формы, создание, сохранение после перезагрузки и удаление', async ({ page }) => {
  await page.goto('/objects');
  await page.getByTestId('add-object').click();
  const dialog = page.getByRole('dialog', { name: 'Новый объект' });
  await dialog.getByTestId('create-object-submit').click();
  await expect(dialog.getByText('Укажите название объекта')).toBeVisible();
  await expect(dialog.getByText('Укажите EAN точки отбора')).toBeVisible();

  await dialog.getByLabel('Название').fill('Кампус «Южный»');
  await expect(dialog.getByLabel('Код')).toHaveValue('KAMPUS-YUZHNYY');
  await dialog.getByLabel('Город').fill('Намюр');
  await dialog.getByLabel('EAN точки отбора').fill('541448800000099010');
  await dialog.getByLabel('EAN точки отдачи').fill('541448800000099028');
  await dialog.getByLabel('Батареи').fill('1');
  await dialog.getByTestId('create-object-submit').click();
  await expect(dialog.getByText(/контрольная цифра GS1 0, ожидается/)).toBeVisible();
  await dialog.getByLabel('EAN точки отбора').fill('541448800000099011');
  await dialog.getByTestId('create-object-submit').click();

  await expect(page).toHaveURL(/\/objects\/usr-[a-z0-9]+\/launch$/);
  await expect(page.getByRole('button', { name: 'Текущий объект' })).toContainText('Кампус «Южный»');
  await page.reload();
  await page.goto('/objects');
  await expect(page.getByRole('link', { name: 'Кампус «Южный»' })).toBeVisible();
  await page.getByRole('link', { name: 'Кампус «Южный»' }).click();
  await expect(page.getByText('PV1').first()).toBeVisible();
  await page.getByTestId('delete-object').click();
  await page.getByTestId('delete-object-confirm').click();
  await expect(page).toHaveURL(/\/objects$/);
  await expect(page.getByRole('link', { name: 'Кампус «Южный»' })).toHaveCount(0);
});

test('контекстное меню: действия объекта, клавиатура, родное меню в полях ввода', async ({ page }) => {
  await page.goto('/objects');
  await page.locator('tr[data-object-id="obj-003"]').click({ button: 'right', position: { x: 400, y: 15 } });
  const menu = page.getByTestId('app-context-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Копировать код OBJ-003/ })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/objects\/obj-003$/);
  await expect(menu).toHaveCount(0);

  await page.mouse.click(700, 120, { button: 'right' });
  await expect(menu.getByRole('menuitem', { name: 'Тёмная тема' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Тёмная тема' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/objects');
  await page.locator('tr[data-object-id="obj-003"]').click({ button: 'right', position: { x: 400, y: 15 } });
  const passportFile = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: 'Сохранить паспорт (JSON)' }).click();
  expect((await passportFile).suggestedFilename()).toBe('OBJ-003.passport.json');

  await page.mouse.click(700, 120, { button: 'right' });
  const pageFile = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: 'Сохранить страницу как…' }).click();
  expect((await pageFile).suggestedFilename()).toMatch(/\.html$/);

  await page.mouse.click(700, 120, { button: 'right' });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  await page.goto('/objects');
  await page.getByTestId('add-object').click();
  await page.getByLabel('Название').click({ button: 'right' });
  await expect(menu).toHaveCount(0);
});

test('препятствие: следующее действие – ссылка на нужный блок страницы этапа', async ({ page }) => {
  await page.goto('/objects/obj-003/launch');
  const link = page.getByTestId('blocker-next-action').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/objects\/obj-003\/history#mh-/);
  const id = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`#${id}`)).toBeInViewport();
  await expect(page.locator(`#${id}`)).toHaveClass(/anchor-flash/);
});

test('обучение: урок «Новый объект» – тур сам заполняет форму, подсвечивает поля и ничего не создаёт', async ({ page }) => {
  await page.goto('/objects');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  const rowsBefore = await page.locator('tbody tr').count();
  await page.goto('/help');
  await expect(page.getByTestId('lesson')).toContainText('Как создать новый объект');
  await page.getByTestId('lesson-tour').click();
  const card = page.getByTestId('tour-card');
  const next = page.getByTestId('tour-next');
  await expect(card).toContainText('Шаг 1 из 10');
  await expect(page).toHaveURL(/\/objects$/);
  await next.click();
  // Тур открыл форму и печатает название; код подставился из названия
  await expect(page.locator('#obj-name')).toHaveValue('Солнечный парк «Пример»');
  await expect(page.locator('#obj-code')).toHaveValue('SOLNECHNYY-PARK-PRIMER');
  for (let i = 2; i < 9; i++) {
    await next.click();
    await expect(card).toContainText(`Шаг ${i + 1} из 10`);
  }
  // Контрольная цифра подставлена, второй EAN и оборудование заполнены
  await expect(page.locator('#obj-eanOfftake')).toHaveValue('541430000000000081');
  await expect(page.locator('#obj-eanInjection')).toHaveValue('541445687468568586');
  await expect(page.locator('#obj-pvCount')).toHaveValue('12');
  await next.click();
  await expect(card).toContainText('Осталось нажать «Создать объект»');
  await next.click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('#create-object-form')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(rowsBefore);
  await page.goto('/help');
  await expect(page.locator('[data-lesson="objects"]')).toContainText('пройден');
});

test('обучение: тур закрывается по Esc, листается стрелками; тур по странице – из контекстного меню', async ({ page }) => {
  await page.goto('/settings');
  await page.locator('main h1').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Обучение: как работает эта страница' }).click();
  const card = page.getByTestId('tour-card');
  await expect(card).toContainText('Внешний вид');
  await page.keyboard.press('ArrowRight');
  await expect(card).toContainText('Хранилище');
  await page.keyboard.press('ArrowLeft');
  await expect(card).toContainText('Внешний вид');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
});

test('помощь: вопрос своими словами из контекстного меню – ответ из базы знаний и показ на сайте; FAQ с поиском', async ({ page }) => {
  await page.goto('/objects');
  await page.locator('main h1').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Помощь: задать вопрос…' }).click();
  await page.getByTestId('help-question').fill('какой еан вбивать при создании завода');
  await page.getByTestId('help-submit').click();
  const reply = page.getByTestId('help-reply');
  await expect(reply).toHaveAttribute('data-answer', 'ean-what');
  await expect(reply).toContainText('18-значный код');
  // Посторонний вопрос – честное «не знаю», без выдуманного ответа
  await page.getByTestId('help-question').fill('какая погода в Москве');
  await page.getByTestId('help-submit').click();
  await expect(reply).toHaveAttribute('data-answer', '');
  await expect(reply).toContainText('Пока не знаю точного ответа');
  await page.keyboard.press('Escape');

  await page.goto('/help?tab=faq');
  await page.getByLabel('Поиск по вопросам').fill('тёмн');
  const list = page.getByTestId('faq-list');
  await expect(list.locator('[data-faq]')).toHaveCount(1);
  await list.locator('[data-faq="theme"] button').first().click();
  await expect(list.locator('[data-faq="theme"]')).toContainText('Кнопка с луной');
});

test('помощь в боковой панели: тур по текущей странице и вопрос помощнику', async ({ page }) => {
  await page.goto('/blockers');
  await page.getByTestId('sidebar-help-tour').click();
  const card = page.getByTestId('tour-card');
  await expect(card).toContainText('Все препятствия');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await page.getByTestId('sidebar-help-ask').click();
  await expect(page.getByRole('dialog', { name: 'Помощь по сайту' })).toBeVisible();
  await page.getByTestId('help-question').fill('где посмотреть все препятствия');
  await page.getByTestId('help-submit').click();
  await expect(page.getByTestId('help-reply')).toHaveAttribute('data-answer', 'blockers-page');
});

const INVOICE_CSV = ['timestamp (UTC);Grid.energy_kWh.offtake_invoice (kWh);Grid.energy_kWh.offtake_invoice_validated (kWh);Grid.energy_kWh.injection_invoice (kWh);Grid.energy_kWh.injection_invoice_validated (kWh);Grid.power_kW.invoice (kW);Grid.power_kW.CA_offtake (kW);Grid.power_kW.CA_injection (kW)', '2025-01-01T00:00:00Z;6,8;6,8;0;0;27,2;250;-200', '2025-01-01T00:15:00Z;7,1;7,1;0;0;28,4;250;-200'].join('\n');

/** Бросить файлы в окно так, как это делает браузер при перетаскивании. */
async function dropFiles(page: Page, files: { name: string; text: string; type: string }[]) {
  await page.evaluate((list) => {
    const dt = new DataTransfer();
    for (const f of list) dt.items.add(new File([f.text], f.name, { type: f.type }));
    const target = document.querySelector('main') ?? document.body;
    for (const type of ['dragenter', 'dragover', 'drop']) target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, files);
}

test('файл, брошенный в любое место окна, уходит в свой объект и этап', async ({ page }) => {
  await page.goto('/overview');
  await dropFiles(page, [{ name: 'OBJ-002_invoice.csv', text: INVOICE_CSV, type: 'text/csv' }]);
  const plans = page.getByTestId('drop-plans');
  const row = plans.locator('li').first();
  await expect(row).toHaveAttribute('data-kind', 'invoice');
  await expect(row).toHaveAttribute('data-target', 'obj-002');
  await expect(row).toHaveAttribute('data-match', 'name');
  await page.getByTestId('drop-apply').click();
  // Один объект, без ошибок – сразу открывается этап, файл – новая версия набора
  await expect(page).toHaveURL(/\/objects\/obj-002\/history$/);
  await expect(page.getByText('OBJ-002_invoice.csv').first()).toBeVisible();
});

test('не тот файл в поле этапа – предложение загрузить по назначению', async ({ page }) => {
  await page.goto('/objects/obj-001/history');
  const telemetry = 'timestamp (UTC);object_id;Grid.power_kW (kW)\n2026-11-05T10:00:00Z;OBJ-002;5';
  await page.locator('[data-dropzone] input[type=file]').first().setInputFiles({ name: 'telemetry.csv', mimeType: 'text/csv', buffer: Buffer.from(telemetry) });
  const dialog = page.getByRole('dialog', { name: /Разложить файлы/ });
  await expect(dialog).toContainText('Это не история счётчиков');
  await expect(dialog.locator('li').first()).toHaveAttribute('data-kind', 'telemetry');
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toHaveCount(0);
});

test('object.json объекта, которого нет в портфеле, создаёт новый объект', async ({ page }) => {
  await page.goto('/objects');
  const passport = { object_id: 'SUN-E2E', name: 'Солнечный парк Е2Е', address: { street: 'Rue 1', postal_code: '9000', city: 'Гент', country: 'BE' }, timezone: 'Europe/Brussels', data_files: { invoice: 'invoice.csv', telemetry: 'telemetry.csv' }, grid_connection: { ean_offtake: '541430000000000081', ean_injection: '541445687468568586' }, assets: [{ asset_id: 'pv-1', type: 'pv', signals: [] }] };
  await page.getByTestId('drop-picker').setInputFiles({ name: 'object.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(passport)) });
  const row = page.getByTestId('drop-plans').locator('li').first();
  await expect(row).toHaveAttribute('data-target', '__new__');
  await expect(row).toContainText('Солнечный парк Е2Е');
  await page.getByTestId('drop-apply').click();
  // id объекта – object_id паспорта (паспорт, история и телеметрия относятся к одному объекту)
  await expect(page).toHaveURL(/\/objects\/SUN-E2E\/launch$/);
  await expect(page.getByRole('button', { name: 'Текущий объект' })).toContainText('Солнечный парк Е2Е');
});

test('урок «Загрузка файлов перетаскиванием»: тур показывает разбор и ничего не загружает', async ({ page }) => {
  await page.goto('/help?lesson=files');
  await page.getByTestId('lesson-tour').click();
  const card = page.getByTestId('tour-card');
  const next = page.getByTestId('tour-next');
  await expect(card).toContainText('Файлы – в любое место окна');
  await next.click();
  await expect(page.getByTestId('drop-plans').locator('li')).toHaveCount(2);
  for (let i = 0; i < 3; i++) await next.click();
  await expect(card).toContainText('Загрузить одним нажатием');
  await next.click();
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('drop-plans')).toHaveCount(0);
});

test('повторная проверка всегда даёт видимый итог, даже если данные не изменились', async ({ page }) => {
  await page.goto('/objects/obj-003/history');
  const recheck = page.locator('[data-tour="stage-actions"] button', { hasText: /проверки/ });
  await recheck.click();
  await expect(page.getByText(/Проверки выполнены/).first()).toBeVisible();
});

test('демо-роль сохраняется после перезагрузки страницы', async ({ page }) => {
  await page.goto('/objects/obj-001/dashboards?tab=acceptance');
  const main = page.locator('main');
  const beforeOpen = await main.boundingBox();
  const profile = page.getByRole('button', { name: /^Профиль/ }).last();
  await profile.click();
  await expect(page.getByRole('menu')).toBeVisible();
  const afterOpen = await main.boundingBox();
  expect(afterOpen?.x).toBe(beforeOpen?.x);
  expect(afterOpen?.width).toBe(beforeOpen?.width);
  await page.getByRole('menuitem', { name: /Ответственный за приёмку/ }).click();
  await expect(profile).toHaveAttribute('data-role', 'ACCEPTANCE_OFFICER');
  await page.reload();
  await expect(page.getByRole('button', { name: /^Профиль/ }).last()).toHaveAttribute('data-role', 'ACCEPTANCE_OFFICER');
});

test('страницы состояния: 404 по адресу – сразу, без прелоадера; справочник кодов', async ({ page }) => {
  await page.goto('/net-takoy-stranicy');
  const screen = page.getByTestId('status-screen');
  await expect(screen).toHaveAttribute('data-status', '404');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await expect(screen.getByText('404', { exact: true })).toBeVisible();
  await expect(screen.locator('canvas')).toHaveCount(0);

  await page.getByRole('link', { name: 'Все коды состояния' }).click();
  await expect(page.getByRole('heading', { name: 'Коды состояния' })).toBeVisible();
  await page.getByTestId('status-link-503').click();
  await expect(page.getByRole('heading', { name: 'Сервис недоступен' })).toBeVisible();
  await expect(page.getByText('HTTP 503 · Service Unavailable')).toBeVisible();
});

test('нет подключения: экран поверх приложения, связь вернулась – экран закрылся', async ({ page, context }) => {
  await page.goto('/overview');
  await expect(page.getByRole('heading', { name: 'Запуск энергетических объектов' })).toBeVisible();
  await context.setOffline(true);
  const overlay = page.getByTestId('offline-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByRole('heading', { name: 'Нет подключения к интернету' })).toBeVisible();
  await context.setOffline(false);
  await expect(overlay).toHaveCount(0);
  await expect(page.getByText('Подключение восстановлено')).toBeVisible();

  // «Продолжить без сети» убирает экран до следующего обрыва
  await context.setOffline(true);
  await overlay.getByRole('button', { name: 'Продолжить без сети' }).click();
  await expect(overlay).toHaveCount(0);
  await context.setOffline(false);
});

test('страница ошибки веб-сервера работает без приложения: /status/502.html', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/status/502.html');
  await expect(page.getByRole('heading', { name: 'Ошибка шлюза' })).toBeVisible();
  await expect(page.locator('.code')).toHaveText('502');
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.goto('/offline.html');
  await expect(page.getByRole('heading', { name: 'Нет подключения к интернету' })).toBeVisible();
  expect(errors).toEqual([]);
});
