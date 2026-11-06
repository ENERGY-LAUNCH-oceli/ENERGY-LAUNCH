import type { RulesConfig } from '@/types';
import { METER_HISTORY_TZ } from './meter-history';
import { RULESET_V1 } from './ruleset.v1';

/**
 * v1.1.0 – этап 1 (история счётчиков) сверен с ТЗ «Кейс 4» ред. 0.4:
 * 24 последовательных месяца, шаг 15 минут, дубли, единицы, знаки, EAN.
 * Этапы 2–4 пока унаследованы из v1.0.0 и остаются предварительными.
 */
export const RULESET_V1_1: RulesConfig = {
  ...RULESET_V1,
  version: '1.1.0',
  effectiveFrom: '2026-11-05',
  description: 'Этап 1 сверен с ТЗ «Кейс 4» (ред. 0.4); этапы 2–4 – предварительные',
  provisional: true,
  meterHistory: METER_HISTORY_TZ,
};
