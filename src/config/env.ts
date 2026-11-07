import { DEFAULT_RULESET_VERSION } from './rules';

/** Типизированный доступ к переменным окружения (см. .env.example). */
export const env = {
  appName: import.meta.env.VITE_APP_NAME ?? 'ENERGY LAUNCH',
  dataMode: (import.meta.env.VITE_DATA_MODE === 'local' ? 'local' : 'demo') as 'demo' | 'local',
  dbName: import.meta.env.VITE_DB_NAME || 'energy-launch',
  rulesetVersion: import.meta.env.VITE_RULESET_VERSION || DEFAULT_RULESET_VERSION,
  /** auto – набор кейса 4 из public/case4, если он есть; synthetic – всегда синтетический портфель (e2e). */
  dataset: (import.meta.env.VITE_DATASET === 'synthetic' ? 'synthetic' : 'auto') as 'auto' | 'synthetic',
  debugStateMachine: import.meta.env.VITE_DEBUG_STATE_MACHINE === 'true',
  /** Заставка при старте; в e2e-сборке (--mode e2e) выключена – она перекрывала бы элементы тестам. */
  preloader: import.meta.env.MODE !== 'e2e',
  /** auto – PostgreSQL через API, если сервер запущен, иначе браузер; server – только сервер; browser – без сервера (e2e). */
  storage: (import.meta.env.VITE_STORAGE === 'server' || import.meta.env.VITE_STORAGE === 'browser' ? import.meta.env.VITE_STORAGE : 'auto') as 'auto' | 'server' | 'browser',
  /** Адрес API хранилища (в разработке Vite проксирует /api на сервер, в Docker – nginx). */
  apiUrl: (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, ''),
} as const;
