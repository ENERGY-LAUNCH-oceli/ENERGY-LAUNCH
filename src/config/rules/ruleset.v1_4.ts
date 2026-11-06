import type { RulesConfig } from '@/types';
import { DASHBOARD_CONFIG_TZ } from './dashboards';
import { RULESET_V1_3 } from './ruleset.v1_3';

/**
 * v1.4.0 – этап 4: конструктор рабочей панели из четырёх обязательных блоков, привязка к объекту,
 * публикация версии и приёмка ответственным (DB-010…DB-016). Приёмка заменяет подтверждение владельца
 * этапа 4: решение, автор, время, версия конфигурации и object_id сохраняются в приёмке.
 */
export const RULESET_V1_4: RulesConfig = {
  ...RULESET_V1_3,
  version: '1.4.0',
  effectiveFrom: '2026-11-06',
  description: 'Этапы 1–2 сверены с ТЗ; этап 3 – тесты через имитатор; этап 4 – рабочая панель и приёмка',
  dashboardConfig: DASHBOARD_CONFIG_TZ,
  confirmations: { ...RULESET_V1_3.confirmations, FINAL_DASHBOARDS: [] },
};
