import { expect, test } from '@playwright/test';

test('приложение открывает страницу запуска с четырьмя этапами', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/launch$/);
  for (const id of ['METER_HISTORY', 'REALTIME_TELEMETRY', 'ASSET_CONTROL', 'FINAL_DASHBOARDS']) {
    await expect(page.getByTestId(`stage-${id}`)).toBeVisible();
  }
  // Последующий этап нельзя начать до завершения предыдущего
  await expect(page.getByTestId('stage-REALTIME_TELEMETRY').getByRole('button', { name: 'Начать этап' })).toBeDisabled();
});

test('отрицательный сценарий блокирует этап после проверки', async ({ page }) => {
  await page.goto('/launch');
  await page.getByLabel('Демонстрационный сценарий').selectOption('invoice-mismatch');
  const stage = page.getByTestId('stage-METER_HISTORY');
  await stage.getByRole('button', { name: 'Начать этап' }).click();
  await stage.getByRole('button', { name: 'Запустить проверки' }).click();
  await expect(stage.locator('[data-status="BLOCKED"]')).toBeVisible();
  await expect(stage).toContainText('MH-005');
});
