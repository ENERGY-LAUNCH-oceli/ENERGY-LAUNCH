import type { RulesConfig } from '@/types';
import { CONTROL_TESTING_V1_6 } from './control';
import { RULESET_V1_5 } from './ruleset.v1_5';

/**
 * v1.6.0 – этап 3: интервалы команд (CT-017). Команда активу, отправленная раньше чем через
 * `minCommandIntervalSec` после результата предыдущей, фиксируется предупреждением: её отклик нельзя
 * однозначно отнести к ней. Остальные значения – как в 1.5.0.
 */
export const RULESET_V1_6: RulesConfig = {
  ...RULESET_V1_5,
  version: '1.6.0',
  effectiveFrom: '2026-11-08',
  description: 'Этап 3: проверка интервалов между командами одному активу',
  controlTesting: CONTROL_TESTING_V1_6,
};
