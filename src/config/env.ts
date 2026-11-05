import { DEFAULT_RULESET_VERSION } from './rules';

/** Типизированный доступ к переменным окружения (см. .env.example). */
export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'ENERGY LAUNCH',
  dataMode: (import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'demo') as 'demo' | 'local',
  dbName: import.meta.env.VITE_DB_NAME || 'energy-launch',
  rulesetVersion: import.meta.env.VITE_RULESET_VERSION || DEFAULT_RULESET_VERSION,
  debugStateMachine: import.meta.env.VITE_DEBUG_STATE_MACHINE === 'true',
} as const;
