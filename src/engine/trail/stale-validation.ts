import type { LaunchInputs, StageId } from '@/types';

/**
 * Результат последней проверки этапа неактуален, если после неё изменились его входы (ТЗ 2.2 п. 4):
 * новая версия выгрузки, телеметрии или паспорта, новые тесты управления. Возвращает причину для отказа
 * в завершении этапа или null, если проверка соответствует текущим данным.
 */
export function staleValidationReason(stageId: StageId, inputs: LaunchInputs | null | undefined): string | null {
  if (!inputs) return null;
  if (stageId === 'METER_HISTORY') {
    const run = inputs.invoiceRuns?.at(-1);
    if (inputs.invoice && run && run.datasetVersion !== inputs.invoice.version) return `Загружена версия v${inputs.invoice.version}, а проверялась v${run.datasetVersion}: повторите проверку`;
  }
  if (stageId === 'REALTIME_TELEMETRY') {
    const run = inputs.telemetryRuns?.at(-1);
    const data = inputs.telemetry?.version ?? 0;
    const passport = inputs.passport?.version ?? 0;
    if (run && (data !== run.datasetVersion || passport !== run.passportVersion)) return `Телеметрия или паспорт изменены после проверки (данные v${data}, паспорт v${passport}): повторите проверку`;
  }
  if (stageId === 'ASSET_CONTROL') {
    const run = inputs.controlRuns?.at(-1);
    const commands = inputs.controlCommands?.length ?? 0;
    if (run && commands !== run.commandsCount) return `После проверки выполнены новые тесты управления (${commands - run.commandsCount}): повторите проверку`;
  }
  return null;
}
