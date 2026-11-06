import type { RulesConfig } from '@/types';
import { CONTROL_TESTING_TZ } from './control';
import { RULESET_V1_2 } from './ruleset.v1_2';

/**
 * v1.3.0 – этап 3 (управление): вместо программы испытаний – тесты через локальный имитатор.
 * Команда считается успешной только после приёма контроллером и отклика фактической мощности
 * в ожидаемом интервале. Правила CT-010…CT-016; CT-001…CT-006 остаются за сессиями v1.0–v1.2.
 */
export const RULESET_V1_3: RulesConfig = {
  ...RULESET_V1_2,
  version: '1.3.0',
  effectiveFrom: '2026-11-06',
  description: 'Этапы 1–2 сверены с ТЗ; этап 3 – тесты управления через имитатор; этап 4 – предварительный',
  controlTesting: CONTROL_TESTING_TZ,
};
