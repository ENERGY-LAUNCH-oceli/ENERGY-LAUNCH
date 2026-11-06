import { expect, test, type Page } from '@playwright/test';

const STAGES = ['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS'] as const;

async function chooseScenario(page: Page, title: string) {
  await page.getByRole('combobox', { name: 'Демонстрационный сценарий' }).click();
  await page.getByRole('option', { name: title }).click();
}

test('карточка запуска показывает четыре этапа и блокирует порядок', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Пропуски в истории учёта');
  await chooseScenario(page, 'Успешный запуск');
  for (const id of STAGES) await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
  await expect(page.getByTestId('stage-REALTIME_TELEMETRY').getByRole('button', { name: 'Начать этап' })).toBeDisabled();
});

test('отрицательный сценарий блокирует этап после проверки', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Расхождение счёта и учёта');
  const stage = page.getByTestId('stage-METER_HISTORY');
  await stage.getByRole('button', { name: 'Начать этап' }).click();
  await stage.getByRole('button', { name: 'Запустить проверки' }).click();
  await expect(stage).toHaveAttribute('data-stage-status', 'BLOCKED');
  await expect(page.getByRole('region', { name: 'Препятствия' })).toContainText('MH-005');
  await expect(stage.getByRole('button', { name: 'Завершить' })).toBeDisabled();
});

test('успешный запуск проходит все этапы через интерфейс', async ({ page }) => {
  await page.goto('/objects/obj-001/launch');
  await chooseScenario(page, 'Пропуски в истории учёта');
  await chooseScenario(page, 'Успешный запуск');
  for (const id of STAGES) {
    const stage = page.getByTestId(`stage-${id}`);
    await stage.getByRole('button', { name: 'Начать этап' }).click();
    await stage.getByRole('button', { name: 'Запустить проверки' }).click();
    await stage.getByRole('button', { name: 'Подробнее' }).click();
    await page.getByRole('tabpanel').getByRole('button', { name: 'Подтвердить требования' }).click();
    const dialog = page.getByRole('dialog');
    for (const box of await dialog.getByRole('checkbox').all()) await box.click();
    await dialog.getByRole('button', { name: /^Подтвердить \(/ }).click();
    await stage.getByRole('button', { name: 'Завершить' }).click();
    await expect(stage).toHaveAttribute('data-stage-status', 'COMPLETED');
  }
  await expect(page.getByRole('region', { name: 'Прогресс запуска' })).toContainText('Объект готов к эксплуатации');
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
