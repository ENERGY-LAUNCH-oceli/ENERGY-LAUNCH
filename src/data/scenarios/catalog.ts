import { RULESET_V1 } from '@/config/rules';
import { DEMO_OBJECT, generateControlTests, generateDashboards, generateInvoiceDataset, generateTelemetryDataset } from '@/data/mock';
import type { LaunchInputs, TestScenario } from '@/types';

const cfg = RULESET_V1;
const TELEMETRY_SIGNALS = ['sig-p', 'sig-q', 'sig-u', 'sig-f', 'sig-brk'];

const baseInputs = (): LaunchInputs => ({
  object: DEMO_OBJECT,
  invoice: generateInvoiceDataset({ periodStart: '2026-10-01T00:00:00.000Z', days: cfg.meterHistory.checkPeriodDays, intervalMinutes: cfg.meterHistory.intervalMinutes, seed: 11 }),
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
    title: 'Пропуски в истории учёта',
    description: 'Сплошной пропуск 3 суток в интервальной истории: полнота ниже порога.',
    tags: ['negative', 'meter-history'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        invoice: generateInvoiceDataset({ periodStart: '2026-10-01T00:00:00.000Z', days: cfg.meterHistory.checkPeriodDays, intervalMinutes: cfg.meterHistory.intervalMinutes, gapRun: [480, 144], seed: 11 }),
      },
      expectations: [{ stageId: 'METER_HISTORY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['MH-003'] }],
    }),
  },
  {
    id: 'invoice-mismatch',
    title: 'Расхождение счёта и учёта',
    description: 'Объём по счёту завышен на 5% относительно учёта.',
    tags: ['negative', 'meter-history'],
    build: () => ({
      inputs: {
        ...baseInputs(),
        invoice: generateInvoiceDataset({ periodStart: '2026-10-01T00:00:00.000Z', days: cfg.meterHistory.checkPeriodDays, intervalMinutes: cfg.meterHistory.intervalMinutes, invoiceBiasPct: 5, seed: 11 }),
      },
      expectations: [{ stageId: 'METER_HISTORY', statusAfterValidation: 'BLOCKED', failingRuleIds: ['MH-005'] }],
    }),
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
