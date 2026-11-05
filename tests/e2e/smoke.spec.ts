import { expect, test, type Page } from '@playwright/test';

const STAGES = ['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS'] as const;

async function chooseScenario(page: Page, title: string) {
  await page.getByRole('combobox', { name: 'Демонстрационный сценарий' }).click();
  await page.getByRole('option', { name: title }).click();
}

test('карточка запуска показывает четыре этапа и блокирует порядок', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/launch$/);
  for (const id of STAGES) await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
  await expect(page.getByTestId('stage-REALTIME_TELEMETRY').getByRole('button', { name: 'Начать этап' })).toBeDisabled();
});

test('отрицательный сценарий блокирует этап после проверки', async ({ page }) => {
  await page.goto('/launch');
  await chooseScenario(page, 'Расхождение счёта и учёта');
  const stage = page.getByTestId('stage-METER_HISTORY');
  await stage.getByRole('button', { name: 'Начать этап' }).click();
  await stage.getByRole('button', { name: 'Запустить проверки' }).click();
  await expect(stage).toHaveAttribute('data-stage-status', 'BLOCKED');
  await expect(page.getByRole('region', { name: 'Препятствия' })).toContainText('MH-005');
  await expect(stage.getByRole('button', { name: 'Завершить' })).toBeDisabled();
});

test('успешный запуск проходит все этапы через интерфейс', async ({ page }) => {
  await page.goto('/launch');
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
  await expect(page.getByText('Объект готов к эксплуатации')).toBeVisible();
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
