import type { Blocker, BlockerStatus, InputRef, LaunchInputs, LaunchSession, RulesConfig, Severity, StageId, ValidationResult, ValidationSnapshot } from '@/types';
import { NEXT_ACTION_BY_RULE, specificAction } from '../next-action';
import { getRule, isKnownRule } from '../rules';
import { configValue, stageInputRefs, type ShaResolver } from './inputs';

export const BLOCKER_CATEGORIES = ['PRESENCE', 'QUALITY', 'BINDING', 'CONTROL', 'DASHBOARD', 'MANUAL'] as const;
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number];

export const CATEGORY_TITLE: Record<BlockerCategory, string> = {
  PRESENCE: 'Наличие данных',
  QUALITY: 'Качество данных',
  BINDING: 'Привязка к объекту',
  CONTROL: 'Контур управления',
  DASHBOARD: 'Дашборды и доступ',
  MANUAL: 'Ручное препятствие',
};

const BINDING_RULES = new Set(['MH-011', 'MH-012', 'TM-004', 'DB-010']);

/** Категория – из правила: привязка, управление, дашборды, затем измерение проверки (наличие / качество). */
export function blockerCategory(b: Pick<Blocker, 'ruleId' | 'source'>): BlockerCategory {
  if (b.source === 'MANUAL' || !b.ruleId || !isKnownRule(b.ruleId)) return 'MANUAL';
  if (BINDING_RULES.has(b.ruleId)) return 'BINDING';
  if (b.ruleId.startsWith('CT-')) return 'CONTROL';
  if (b.ruleId.startsWith('DB-')) return 'DASHBOARD';
  return getRule(b.ruleId).dimension === 'PRESENCE' ? 'PRESENCE' : 'QUALITY';
}

const STAGE_SOURCE: Record<StageId, string> = {
  METER_HISTORY: 'invoice.csv + object.json',
  REALTIME_TELEMETRY: 'telemetry.csv + object.json',
  ASSET_CONTROL: 'локальный имитатор контроллера',
  FINAL_DASHBOARDS: 'конфигурация рабочей панели',
};

const STAGE_TITLE: Record<StageId, string> = {
  METER_HISTORY: 'История счётчиков',
  REALTIME_TELEMETRY: 'Данные в реальном времени',
  ASSET_CONTROL: 'Управление',
  FINAL_DASHBOARDS: 'Финальные дашборды',
};

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const fmt = (iso?: string) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : '');

export interface BlockerRecord {
  blocker: Blocker;
  objectId: string;
  objectName: string;
  stageId: StageId;
  stageTitle: string;
  category: BlockerCategory;
  severity: Severity;
  status: BlockerStatus;
  description: string;
  /** Источник проблемы: файл / имитатор / конфигурация. */
  source: string;
  /** Затронутые поля. */
  fields: string[];
  /** Сигналы, активы, команды или интервал. */
  signals: string[];
  interval: string | null;
  detectedAt: string;
  nextAction: string;
  detail: {
    happened: string;
    why: string;
    expected: string | null;
    actual: string | null;
    dataUsed: InputRef[];
    rule: { id: string; title: string; description: string; version: string; configRef?: string; configValue?: unknown } | null;
    fix: string;
    recheck: string;
  };
}

/** Результат проверки, на котором открыто препятствие: последний снимок с этим правилом до момента открытия. */
function sourceResult(b: Blocker, session: LaunchSession, history: readonly ValidationSnapshot[]): { result?: ValidationResult; snapshot?: ValidationSnapshot } {
  const snaps = history.filter((s) => s.objectId === session.objectId && s.stageId === b.stageId && s.at <= (b.resolvedAt ?? '9999') && s.results.some((r) => r.ruleId === b.ruleId));
  const snapshot = snaps.filter((s) => s.at <= b.createdAt).at(-1) ?? snaps.at(-1);
  const result = snapshot?.results.find((r) => r.ruleId === b.ruleId) ?? session.stages[b.stageId].validationResults.find((r) => r.ruleId === b.ruleId);
  return { ...(result ? { result } : {}), ...(snapshot ? { snapshot } : {}) };
}

/** Полная запись препятствия: точная причина, использованные данные, правило, исправление, повторная проверка. */
export function blockerRecord(b: Blocker, session: LaunchSession, inputs: LaunchInputs, ruleset: RulesConfig, sha?: ShaResolver): BlockerRecord {
  const { result, snapshot } = sourceResult(b, session, inputs.validationHistory ?? []);
  const d = (result?.details ?? {}) as Record<string, unknown>;
  const rule = b.ruleId && isKnownRule(b.ruleId) ? getRule(b.ruleId) : null;
  const interval = d.interval as { from?: string; to?: string } | null | undefined;
  const months = list(d.missingMonths);
  const fields = [...list(d.fields), ...(d.blockId ? [String(d.blockId)] : [])];
  const signals = [...list(d.signals), ...list(d.assets), ...list(d.commands), ...list(d.foreign), ...list(d.unknownSignalIds)];
  const action = (b.ruleId && (specificAction(b.ruleId, result?.details) ?? NEXT_ACTION_BY_RULE[b.ruleId])) || 'Устранить причину и подтвердить устранение с обоснованием';
  const dataUsed = snapshot?.inputs ?? stageInputRefs(b.stageId, inputs, sha);
  const fileName = typeof d.fileName === 'string' ? d.fileName : null;
  const refValue = rule?.configRef ? configValue(ruleset, rule.configRef) : undefined;
  return {
    blocker: b,
    objectId: session.objectId,
    objectName: inputs.object.name,
    stageId: b.stageId,
    stageTitle: STAGE_TITLE[b.stageId],
    category: blockerCategory(b),
    severity: b.severity,
    status: b.status,
    description: b.description,
    source: fileName ? `${fileName}${b.stageId === 'METER_HISTORY' || b.stageId === 'REALTIME_TELEMETRY' ? ' + object.json' : ''}` : b.source === 'MANUAL' ? `вручную: ${b.createdBy}` : STAGE_SOURCE[b.stageId],
    fields,
    signals: months.length ? [...signals, ...months.map((m) => `месяц ${m}`)] : signals,
    interval: interval?.from ? `${fmt(interval.from)} – ${fmt(interval.to)}` : null,
    detectedAt: b.createdAt,
    nextAction: action,
    detail: {
      happened: result?.message ?? b.description,
      why: rule ? `Нарушено правило ${rule.id} «${rule.title}»: ${rule.description}` : `Ручное препятствие: ${b.description}`,
      expected: result?.expected !== undefined && result?.expected !== null ? String(result.expected) : null,
      actual: result?.actual !== undefined && result?.actual !== null ? String(result.actual) : null,
      dataUsed,
      rule: rule
        ? { id: rule.id, title: rule.title, description: rule.description, version: result?.rulesetVersion ?? session.rulesetVersion, ...(rule.configRef ? { configRef: rule.configRef } : {}), ...(refValue !== undefined ? { configValue: refValue } : {}) }
        : null,
      fix: action,
      recheck: rule
        ? `После исправления – «Запустить проверки» этапа «${STAGE_TITLE[b.stageId]}»; правило ${rule.id} должно получить Passed, препятствие закроется автоматически`
        : 'Снять препятствие с обоснованием после устранения',
    },
  };
}
