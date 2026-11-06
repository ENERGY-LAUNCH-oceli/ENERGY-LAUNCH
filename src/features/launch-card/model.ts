import type { CheckStatus } from '@/config/labels';
import { NEXT_ACTION_BY_RULE, getRulesForStage, specificAction } from '@/engine';
import type { Blocker, LaunchInputs, LaunchSession, StageId, ValidationResult, ValidationRule } from '@/types';

/** Источник данных этапа (файлы набора кейса). */
export const STAGE_SOURCE: Record<StageId, string> = {
  METER_HISTORY: 'invoice.csv',
  REALTIME_TELEMETRY: 'telemetry.csv',
  ASSET_CONTROL: 'тестовый контур (control-test.json)',
  FINAL_DASHBOARDS: 'dashboards.json',
};

export interface CheckView {
  rule: ValidationRule;
  status: CheckStatus;
  result?: ValidationResult;
}

export interface StageStats {
  checks: CheckView[];
  passed: number;
  failed: number;
  warnings: number;
  pending: number;
  applicable: number;
  /** Доля пройденных применимых проверок; 100 только если пройдены все. */
  percent: number;
}

/** Все проверки этапа: выполненные – с результатом, ещё не выполненные – Pending. */
export function stageStats(session: LaunchSession, stageId: StageId): StageStats {
  const results = session.stages[stageId].validationResults;
  const checks: CheckView[] = getRulesForStage(stageId, session.rulesetVersion).map((rule) => {
    const result = results.find((r) => r.ruleId === rule.id);
    // Недоступный источник – отдельный статус, а не «нет данных» и не успех
    const status: CheckStatus = !result ? 'PENDING' : result.details?.unavailable ? 'UNAVAILABLE' : result.status;
    return { rule, status, ...(result ? { result } : {}) };
  });
  const count = (...s: CheckStatus[]) => checks.filter((c) => s.includes(c.status)).length;
  const applicable = checks.length - count('NOT_APPLICABLE');
  const passed = count('PASSED');
  return {
    checks,
    passed,
    failed: count('FAILED'),
    warnings: count('WARNING'),
    pending: count('PENDING', 'SKIPPED', 'UNAVAILABLE'),
    applicable,
    percent: applicable ? Math.floor((passed / applicable) * 100) : 0,
  };
}

export interface ObstacleView {
  blocker: Blocker;
  location: { label: string; value: string }[];
  nextAction?: string;
}

const day = (iso?: string) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '');

/** Препятствие с точным местом: файл, объект, поле или сигнал, интервал, критичность (ТЗ 3.1.3). */
export function obstacleView(blocker: Blocker, session: LaunchSession, inputs: LaunchInputs): ObstacleView {
  const result = session.stages[blocker.stageId].validationResults.find((r) => r.ruleId === blocker.ruleId);
  const d = (result?.details ?? {}) as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]).map(String) : []);
  const fields = [...arr('signals'), ...arr('fields'), ...arr('commands')];
  const months = arr('missingMonths');
  const foreign = arr('unknownSignalIds');
  const interval = d.interval as { from?: string; to?: string } | null | undefined;
  const location = [
    { label: 'Файл', value: STAGE_SOURCE[blocker.stageId] },
    { label: 'Объект', value: `${inputs.object.code} · ${inputs.object.name}` },
    ...(fields.length ? [{ label: blocker.stageId === 'ASSET_CONTROL' ? 'Команды' : 'Поле / сигнал', value: fields.join(', ') }] : []),
    ...(months.length ? [{ label: 'Недостающие месяцы', value: months.join(', ') }] : []),
    ...(foreign.length ? [{ label: 'В потоке', value: foreign.slice(0, 3).join(', ') + (foreign.length > 3 ? '…' : '') }] : []),
    ...(interval?.from ? [{ label: 'Интервал (UTC)', value: `${day(interval.from)} – ${day(interval.to)}` }] : []),
    { label: 'Критичность', value: blocker.severity === 'CRITICAL' ? 'Критично – блокирует этап' : blocker.severity === 'WARNING' ? 'Предупреждение' : 'Информация' },
  ];
  const action = blocker.ruleId ? (specificAction(blocker.ruleId, result?.details) ?? NEXT_ACTION_BY_RULE[blocker.ruleId]) : undefined;
  return { blocker, location, ...(action ? { nextAction: action } : {}) };
}
