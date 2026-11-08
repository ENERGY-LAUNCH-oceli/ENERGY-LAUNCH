import { getRuleset } from '@/config/rules';
import { getRulesForStage } from '@/engine/rules/catalog';
import { STAGE_IDS, type StageId } from '@/types';

/** Цель ТЗ 6.1 п. 5: сокращение медианного времени проверки не менее 30 %. */
export const TIME_REDUCTION_TARGET_PCT = 30;

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export interface TimeRow {
  /** Ручная проверка по чек-листу, мин (фактический замер). */
  manualMin?: number | undefined;
  /** Проверка с прототипом, мин: замер инженера, иначе время прогона сценария. */
  protoMin?: number | undefined;
}

export interface TimeReduction {
  /** Сценариев с обоими значениями. */
  measured: number;
  total: number;
  manualMedianMin: number | null;
  protoMedianMin: number | null;
  /** ΔT = (Tручн − Tпрот) / Tручн × 100 %; null – не измерено (нужны все сценарии и Tручн > 0). */
  deltaPct: number | null;
  passed: boolean | null;
}

/**
 * ТЗ 6.1 п. 5: ΔT по медианам на одинаковых сценариях. Значения не подставляются: пока ручное время
 * не замерено по всем сценариям, метрика «не измерено».
 */
export function timeReduction(rows: readonly TimeRow[]): TimeReduction {
  const ok = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v) && v > 0;
  const both = rows.filter((r) => ok(r.manualMin) && ok(r.protoMin));
  const complete = rows.length > 0 && both.length === rows.length;
  const tm = complete ? median(both.map((r) => r.manualMin!)) : null;
  const tp = complete ? median(both.map((r) => r.protoMin!)) : null;
  const deltaPct = tm && tp !== null ? Math.round(((tm - tp) / tm) * 1000) / 10 : null;
  return { measured: both.length, total: rows.length, manualMedianMin: tm, protoMedianMin: tp, deltaPct, passed: deltaPct === null ? null : deltaPct >= TIME_REDUCTION_TARGET_PCT };
}

/** Разбор минут из поля ввода: «7,5» → 7.5; пусто или мусор – undefined. */
export function parseMinutes(v: string | undefined): number | undefined {
  const n = Number.parseFloat((v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const STAGE_TITLE: Record<StageId, string> = { METER_HISTORY: '1. История счётчиков', REALTIME_TELEMETRY: '2. Телеметрия', ASSET_CONTROL: '3. Управление активами', FINAL_DASHBOARDS: '4. Финальные дашборды' };
const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/**
 * Ручной чек-лист baseline (ТЗ 6.2): те же правила и подтверждения, что у прототипа, для выбранной версии набора.
 * Инженер отмечает результат и место препятствия, время засекается на странице сценариев.
 */
export function manualChecklistCsv(rulesetVersion?: string): string {
  const ruleset = getRuleset(rulesetVersion);
  const head = ['Этап', 'Пункт', 'Что проверить', 'Обязательный', 'Результат (пройдено / не пройдено / не применимо)', 'Где препятствие (интервалы, поля, актив, сигнал, причина)'];
  const rows: string[][] = [];
  for (const stage of STAGE_IDS) {
    for (const r of getRulesForStage(stage, ruleset.version)) rows.push([STAGE_TITLE[stage], r.id, `${r.title}. ${r.description}`, r.blocking ? 'да' : 'нет (предупреждение)', '', '']);
    for (const c of ruleset.confirmations[stage]) rows.push([STAGE_TITLE[stage], `Подтверждение: ${c.id}`, `${c.title} – подтверждает роль ${c.role}`, 'да', '', '']);
    rows.push([STAGE_TITLE[stage], 'Статус этапа', 'Итог этапа: не начат / в работе / заблокирован / завершён; этап не завершается при незакрытом предыдущем', 'да', '', '']);
  }
  return `\uFEFF${[`${cell(`Ручной чек-лист ENERGY LAUNCH · набор правил ${ruleset.version}`)}`, head.map(cell).join(';'), ...rows.map((r) => r.map(cell).join(';'))].join('\n')}\n`;
}
