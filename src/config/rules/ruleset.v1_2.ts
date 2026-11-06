import type { RulesConfig } from '@/types';
import { RULESET_V1_1 } from './ruleset.v1_1';
import { TELEMETRY_TZ } from './telemetry';

/**
 * v1.2.0 — этап 2 (телеметрия) сверен с ТЗ: паспорт object.json, обязательные сигналы Grid/PV/Battery,
 * актуальность ≤ 30 мин, полнота ≥ 99 % за 48 ч по каждому сигналу. Этапы 3–4 — предварительные.
 */
export const RULESET_V1_2: RulesConfig = {
  ...RULESET_V1_1,
  version: '1.2.0',
  effectiveFrom: '2026-11-06',
  description: 'Этапы 1–2 сверены с ТЗ «Кейс 4» (ред. 0.4); этапы 3–4 — предварительные',
  telemetry: TELEMETRY_TZ,
};
