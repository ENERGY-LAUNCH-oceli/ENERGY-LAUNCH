import type { DashboardConfigRules } from '@/types';

/** Этап 4 (фаза 09): обязательные виджеты четырёх блоков рабочей панели и приёмка. */
export const DASHBOARD_CONFIG_TZ: DashboardConfigRules = {
  requiredWidgets: {
    METER_HISTORY: ['offtake_history', 'injection_history', 'contract_limits', 'period', 'data_quality'],
    ASSETS: ['pv_list', 'battery_list', 'current_power', 'soc', 'telemetry_freshness', 'equipment_state'],
    CONTROL: ['control_assets', 'last_commands', 'test_results', 'confirmations', 'loop_state'],
    QUALITY_STATUS: ['history_quality', 'telemetry_quality', 'open_blockers', 'check_results', 'stage_statuses'],
  },
  requireAcceptance: true,
};
