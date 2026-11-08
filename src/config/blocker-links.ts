import { ROUTES, type ObjectSection } from '@/app/routes';
import type { StageId } from '@/types';

/** Якоря блоков на страницах этапов: куда ведёт «следующее действие» препятствия. */
export const ANCHORS = {
  // Этап 1 – история счётчиков
  mhUpload: 'mh-upload',
  mhCoverage: 'mh-coverage',
  mhCompleteness: 'mh-completeness',
  mhEan: 'mh-ean',
  mhFields: 'mh-fields',
  mhIssues: 'mh-issues',
  // Этап 2 – телеметрия
  tmInputs: 'tm-inputs',
  tmPassport: 'tm-passport',
  tmSignals: 'tm-signals',
  tmHeatmap: 'tm-heatmap',
  tmIssues: 'tm-issues',
  // Этап 3 – управление
  ctAssets: 'ct-assets',
  ctTest: 'ct-test',
  ctCommands: 'ct-commands',
  // Этап 4 – дашборды
  dbTabs: 'db-tabs',
} as const;

const STAGE_SECTION: Record<StageId, ObjectSection> = { METER_HISTORY: 'history', REALTIME_TELEMETRY: 'telemetry', ASSET_CONTROL: 'control', FINAL_DASHBOARDS: 'dashboards' };

interface Target {
  section: ObjectSection;
  anchor?: string;
  /** Вкладка страницы (дашборды: конструктор / приёмка). */
  tab?: string;
}

const A = ANCHORS;
const RULE_TARGET: Record<string, Target> = {
  'MH-001': { section: 'history', anchor: A.mhUpload },
  'MH-002': { section: 'history', anchor: A.mhCoverage },
  'MH-003': { section: 'history', anchor: A.mhCompleteness },
  'MH-004': { section: 'history', anchor: A.mhCompleteness },
  'MH-005': { section: 'history', anchor: A.mhIssues },
  'MH-006': { section: 'history', anchor: A.mhIssues },
  'MH-007': { section: 'history', anchor: A.mhFields },
  'MH-008': { section: 'history', anchor: A.mhFields },
  'MH-009': { section: 'history', anchor: A.mhFields },
  'MH-010': { section: 'history', anchor: A.mhFields },
  'MH-011': { section: 'history', anchor: A.mhEan },
  'MH-012': { section: 'history', anchor: A.mhUpload },
  'TM-001': { section: 'telemetry', anchor: A.tmPassport },
  'TM-002': { section: 'telemetry', anchor: A.tmSignals },
  'TM-003': { section: 'telemetry', anchor: A.tmSignals },
  'TM-004': { section: 'telemetry', anchor: A.tmSignals },
  'TM-005': { section: 'telemetry', anchor: A.tmSignals },
  'TM-006': { section: 'telemetry', anchor: A.tmHeatmap },
  'TM-007': { section: 'telemetry', anchor: A.tmIssues },
  'TM-008': { section: 'telemetry', anchor: A.tmIssues },
  'TM-009': { section: 'telemetry', anchor: A.tmIssues },
  'TM-010': { section: 'telemetry', anchor: A.tmIssues },
  'TM-011': { section: 'telemetry', anchor: A.tmSignals },
  'CT-001': { section: 'control', anchor: A.ctAssets },
  'CT-002': { section: 'control', anchor: A.ctCommands },
  'CT-003': { section: 'control', anchor: A.ctCommands },
  'CT-004': { section: 'control', anchor: A.ctCommands },
  'CT-005': { section: 'control', anchor: A.ctCommands },
  'CT-006': { section: 'control', anchor: A.ctCommands },
  'CT-010': { section: 'control', anchor: A.ctTest },
  'CT-011': { section: 'control', anchor: A.ctTest },
  'CT-012': { section: 'control', anchor: A.ctCommands },
  'CT-013': { section: 'control', anchor: A.ctCommands },
  'CT-014': { section: 'control', anchor: A.ctTest },
  'CT-015': { section: 'control', anchor: A.ctTest },
  'CT-016': { section: 'control', anchor: A.ctCommands },
  'CT-017': { section: 'control', anchor: A.ctCommands },
  'DB-004': { section: 'dashboards', anchor: A.dbTabs, tab: 'builder' },
  'DB-015': { section: 'dashboards', anchor: A.dbTabs, tab: 'builder' },
  'DB-016': { section: 'dashboards', anchor: A.dbTabs, tab: 'acceptance' },
};

/** Адрес блока, где устраняется препятствие: страница этапа + якорь (иначе – страница этапа). */
export function blockerHref(objectId: string, ruleId: string | undefined, stageId: StageId | undefined): string | undefined {
  const t: Target | undefined = (ruleId && RULE_TARGET[ruleId]) || (ruleId?.startsWith('DB-') ? { section: 'dashboards', anchor: A.dbTabs, tab: 'builder' } : undefined) || (stageId ? { section: STAGE_SECTION[stageId] } : undefined);
  if (!t) return undefined;
  return `${ROUTES.objectSection(objectId, t.section)}${t.tab ? `?tab=${t.tab}` : ''}${t.anchor ? `#${t.anchor}` : ''}`;
}
