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

test('успешный запуск проходит все этапы через интерфейс', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Дефекты истории');
  await chooseScenario(page, 'Успешный запуск');
  for (const id of STAGES) {
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
  }
  await expect(page.getByText('Запуск завершён: объект готов к эксплуатации')).toBeVisible();
});

test('страница дизайн-системы отрисовывает все разделы', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/design-system');
  for (const h of ['Токены дизайна', 'Базовые компоненты', 'Специальные компоненты']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть Modal' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('оболочка: меню, хлебные крошки, выбор объекта, поиск, сворачивание', async ({ page }) => {
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

  await page.keyboard.press('Control+k');
  await page.getByRole('textbox', { name: 'Поиск' }).fill('MH-004');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/objects\/obj-004\/history$/);

  await page.getByRole('button', { name: 'Свернуть навигацию' }).click();
  await expect(page.getByRole('button', { name: 'Развернуть навигацию' })).toBeVisible();
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

  // Исправленный файл через тот же потоковый импорт (PapaParse)
  await page.getByRole('button', { name: 'Полная история' }).click();
  await expect(page.getByText('Результат проверки неактуален')).toBeVisible();
  await expect(page.locator('[data-block="coverage"]')).toHaveAttribute('data-block-status', 'STALE');
  await page.getByRole('button', { name: 'Завершить этап' }).click();
  await expect(page.getByText(/повторите проверку/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Повторить проверки' }).click();
  await expect(page.locator('[data-month-state="MISSING"]')).toHaveCount(0);
  await expect(page.getByTestId('runs-history').locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('[data-block="coverage"]')).toHaveAttribute('data-block-status', 'PASSED');
  await expect(page.getByTestId('stage-status-METER_HISTORY')).toHaveAttribute('data-status', 'IN_PROGRESS');
});

test('история счётчиков: файл не того формата не принимается', async ({ page }) => {
  await page.goto('/objects/obj-002/history');
  await page.locator('input[type="file"]').setInputFiles({ name: 'invoice.csv', mimeType: 'text/csv', buffer: Buffer.from('hello world\n1,2,3\n') });
  await expect(page.getByText('Файл не принят')).toBeVisible();
});

test('телеметрия: нет связи с батареей, тепловая карта, исправление и повторная проверка', async ({ page }) => {
  await page.goto('/objects/obj-004/telemetry');
  await expect(page.getByTestId('stage-status-REALTIME_TELEMETRY')).toHaveAttribute('data-status', 'BLOCKED');
  await expect(page.locator('[data-signal="Battery1.SOC_%"]')).toHaveAttribute('data-diagnosis', 'NO_COMMUNICATION');
  await expect(page.locator('[data-signal="PV1.power_kW"]')).toHaveAttribute('data-diagnosis', 'OK');
  await page.getByTestId('heatmap').locator('rect[data-state="M"]').first().click();
  await expect(page.getByTestId('heatmap-detail')).toContainText('Нет связи');

  await page.getByRole('button', { name: 'Корректный поток' }).click();
  await expect(page.getByText('Результат проверки неактуален')).toBeVisible();
  await page.getByRole('button', { name: 'Повторить проверки' }).click();
  await expect(page.locator('[data-signal="Battery1.SOC_%"]')).toHaveAttribute('data-diagnosis', 'OK');
  await expect(page.getByTestId('stage-status-REALTIME_TELEMETRY')).toHaveAttribute('data-status', 'IN_PROGRESS');
  await expect(page.getByTestId('telemetry-runs').locator('tbody tr')).toHaveCount(2);
});

test('телеметрия: ошибочная привязка видна пользователю', async ({ page }) => {
  await page.goto('/objects/obj-005/telemetry');
  await expect(page.getByTestId('foreign-columns')).toContainText('Battery2.power_kW');
  await expect(page.locator('[data-signal="Battery1.power_kW"]')).toHaveAttribute('data-diagnosis', 'WRONG_BINDING');
});
