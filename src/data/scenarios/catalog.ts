import { ACTIVE_RULESET } from '@/config/rules';
import { buildInvoiceDataset, DEMO_OBJECT, DEMO_OBJECT_ID, generateControlTests, generateDashboards, generateTelemetryDataset } from '@/data/mock';
import type { LaunchInputs, TestScenario } from '@/types';

const cfg = ACTIVE_RULESET;
const TELEMETRY_SIGNALS = ['sig-p', 'sig-q', 'sig-u', 'sig-f', 'sig-brk'];

const baseInputs = (): LaunchInputs => ({
  object: DEMO_OBJECT,
  invoice: buildInvoiceDataset({ objectId: DEMO_OBJECT_ID }),
  telemetry: generateTelemetryDataset({ periodStart: '2026-11-02T00:00:00.000Z', hours: cfg.telemetry.observationPeriodHours, frequencySec: cfg.telemetry.expectedFrequencySec, signalIds: TELEMETRY_SIGNALS, seed: 21 }),
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
    description: 'Поток телеметрии принадлежит другому объекту: идентификаторы сигналов не совпадают с картой сигналов.',
    tags: ['negative', 'telemetry'],
    build: () => {
      const foreign = generateTelemetryDataset({ periodStart: '2026-11-02T00:00:00.000Z', hours: cfg.telemetry.observationPeriodHours, frequencySec: cfg.telemetry.expectedFrequencySec, signalIds: TELEMETRY_SIGNALS, seed: 21 });
      return {
        inputs: { ...baseInputs(), telemetry: { ...foreign, measurements: foreign.measurements.map((m) => ({ ...m, signalId: `obj-foreign:${m.signalId}` })) } },
        expectations: [
          { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
          { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['TM-001', 'TM-002', 'TM-003', 'TM-004'] },
        ],
      };
    },
  },
  {
    id: 'telemetry-latency',
    title: 'Высокая задержка телеметрии',
    description: '10% сообщений доставляются с задержкой 120 с.',
    tags: ['negative', 'telemetry'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        telemetry: generateTelemetryDataset({ periodStart: '2026-11-02T00:00:00.000Z', hours: cfg.telemetry.observationPeriodHours, frequencySec: cfg.telemetry.expectedFrequencySec, signalIds: TELEMETRY_SIGNALS, lateRatio: 0.1, lateLatencySec: 120, seed: 21 }),
      },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['TM-004'] },
      ],
    }),
  },
  {
    id: 'missing-signal',
    title: 'Нет обязательного сигнала',
    description: 'По частоте сети (FREQUENCY) данные не поступают.',
    tags: ['negative', 'telemetry'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        telemetry: generateTelemetryDataset({ periodStart: '2026-11-02T00:00:00.000Z', hours: cfg.telemetry.observationPeriodHours, frequencySec: cfg.telemetry.expectedFrequencySec, signalIds: TELEMETRY_SIGNALS.filter((s) => s !== 'sig-f'), seed: 21 }),
      },
      expectations: [
        { stageId: 'METER_HISTORY', statusAfterValidation: 'IN_PROGRESS', failingRuleIds: [] },
        { stageId: 'REALTIME_TELEMETRY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['TM-001'] },
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
