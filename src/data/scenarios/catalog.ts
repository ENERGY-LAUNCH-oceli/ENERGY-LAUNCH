
import { buildInvoiceDataset, buildTelemetryDataset, DEMO_OBJECT, DEMO_OBJECT_ID, demoPassport, generateControlTests, generateDashboards, type TelemetryGenOptions } from '@/data/mock';
import type { LaunchInputs, TestScenario } from '@/types';


/** Паспорт демо-объекта: одна PV-установка и одна батарея. */
export const DEMO_PASSPORT = demoPassport({ objectId: DEMO_OBJECT_ID, name: 'Демо-объект', city: 'Брюссель', ean: { offtake: '541448800000000017', injection: '541448800000000024' }, assets: [{ id: 'pv-1', type: 'pv', prefix: 'PV1' }, { id: 'battery-1', type: 'battery', prefix: 'Battery1' }] });
const telemetry = (o: TelemetryGenOptions = {}) => buildTelemetryDataset(DEMO_PASSPORT, o);

const baseInputs = (): LaunchInputs => ({
  object: DEMO_OBJECT,
  invoice: buildInvoiceDataset({ objectId: DEMO_OBJECT_ID }),
  passport: DEMO_PASSPORT,
  telemetry: telemetry(),
  controlTests: generateControlTests({ startAt: '2026-11-03T09:00:00.000Z', intervalSec: 120 }),
  dashboards: generateDashboards({ published: true }),
});

interface ScenarioDescriptor {
  id: string;
  title: string;
  description: string;
  tags: string[];
  build: () => Pick<TestScenario, 'inputs' | 'expectations'>;
}

/** Каталог демонстрационных и тестовых сценариев. Данные генерируются лениво. */
const DESCRIPTORS: ScenarioDescriptor[] = [
  {
    id: 'happy-path',
    title: 'Успешный запуск',
    description: 'Все данные соответствуют правилам; все этапы проходят проверки.',
    tags: ['demo', 'positive'],
    build: () => ({
      inputs: baseInputs(),
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'ASSET_CONTROL', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'FINAL_DASHBOARDS', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
      ],
    }),
  },
  {
    id: 'meter-gaps',
    title: 'Дефекты истории',
    description: 'Заявлены 24 месяца, но есть пропуск 3 суток, дубли временных меток и блок значений в Wh.',
    tags: ['negative', 'meter-history'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        invoice: buildInvoiceDataset({ objectId: DEMO_OBJECT_ID, gaps: [['2025-06-10T00:00:00Z', 288]], duplicates: 4, mixedUnitRows: 8, seed: 7 }),
      },
      expectations: [{ stageId: 'METER_HISTORY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['MH-004', 'MH-005', 'MH-007'] }],
    }),
  },
  {
    id: 'invoice-mismatch',
    title: 'Ошибки знаков и единиц',
    description: 'Колонка выдачи в Wh, у части интервалов перевёрнут знак мощности.',
    tags: ['negative', 'meter-history'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        invoice: buildInvoiceDataset({ objectId: DEMO_OBJECT_ID, signErrors: 6, wrongUnit: { field: 'Grid.energy_kWh.injection_invoice', unit: 'Wh' }, seed: 9 }),
      },
      expectations: [{ stageId: 'METER_HISTORY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['MH-007', 'MH-008'] }],
    }),
  },
  {
    id: 'short-history',
    title: 'Короткая история',
    description: 'Официальная история покрывает только 19 из 24 месяцев.',
    tags: ['negative', 'meter-history'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        invoice: buildInvoiceDataset({ objectId: DEMO_OBJECT_ID, missingFirstMonths: 5 }),
      },
      expectations: [{ stageId: 'METER_HISTORY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['MH-002', 'MH-004'] }],
    }),
  },
  {
    id: 'wrong-binding',
    title: 'Ошибочная привязка',
    description: 'В telemetry.csv — данные другого объекта: батарея подписана как Battery2, object_id чужой.',
    tags: ['negative', 'telemetry'],
    build: () => ({
      inputs: { ...baseInputs(), telemetry: telemetry({ renamePrefix: { from: 'Battery1', to: 'Battery2' }, objectIdInFile: 'OBJ-FOREIGN-07' }) },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['TM-003', 'TM-004', 'TM-005', 'TM-006', 'TM-011'] },
      ],
    }),
  },
  {
    id: 'telemetry-latency',
    title: 'Устаревшая телеметрия',
    description: 'Поток прервался за 90 минут до точки проверки.',
    tags: ['negative', 'telemetry'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        telemetry: telemetry({ staleMinutes: 90 }),
      },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['TM-005', 'TM-006', 'TM-011'] },
      ],
    }),
  },
  {
    id: 'missing-signal',
    title: 'Нет телеметрии батареи',
    description: 'История принята, но установленная батарея не передаёт данные: колонки есть, значений нет.',
    tags: ['negative', 'telemetry'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        telemetry: telemetry({ silentAssets: ['Battery1'] }),
      },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['TM-003', 'TM-005', 'TM-006', 'TM-011'] },
      ],
    }),
  },
  {
    id: 'control-timeout',
    title: 'Отказ команды управления',
    description: 'Команда STOP не исполнена (TIMEOUT).',
    tags: ['negative', 'control'],
    build: () => ({
      inputs: { ...baseInputs(), controlTests: generateControlTests({ startAt: '2026-11-03T09:00:00.000Z', intervalSec: 120, timeoutType: 'STOP' }) },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'ASSET_CONTROL', statusAfterValidation: 'BLOCKED', failingRuleIds: ['CT-001', 'CT-003', 'CT-006'] },
      ],
    }),
  },
  {
    id: 'dashboard-unpublished',
    title: 'Панели не готовы',
    description: 'Нет блока событий (ALERTS), панели не опубликованы.',
    tags: ['negative', 'dashboards'],
    build: () => ({
      inputs: { ...baseInputs(), dashboards: generateDashboards({ published: false, omitAlerts: true }) },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'ASSET_CONTROL', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'FINAL_DASHBOARDS', statusAfterValidation: 'BLOCKED', failingRuleIds: ['DB-001', 'DB-004'] },
      ],
    }),
  },
];

export type ScenarioSummary = Omit<ScenarioDescriptor, 'build'>;

export const SCENARIO_LIST: ScenarioSummary[] = DESCRIPTORS.map(({ build: _build, ...rest }) => rest);

export const DEFAULT_SCENARIO_ID = 'happy-path';

export function loadScenario(id: string): TestScenario {
  const d = DESCRIPTORS.find((s) => s.id === id);
  if (!d) throw new Error(`Сценарий не найден: ${id}`);
  const { build, ...meta } = d;
  return { ...meta, ...build() };
}
