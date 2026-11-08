export type ObjectSection = 'launch' | 'history' | 'telemetry' | 'control' | 'dashboards' | 'audit' | 'protocol';

export const ROUTES = {
  root: '/',
  overview: '/overview',
  objects: '/objects',
  settings: '/settings',
  blockers: '/blockers',
  evidence: '/evidence',
  auditTrail: '/audit',
  scenarios: '/scenarios',
  help: '/help',
  /** Коды состояния HTTP и «нет подключения»: /errors, /errors/:code. */
  statusCodes: '/errors',
  /** Личный кабинет и админ-панель (вход через сервер). */
  me: '/me',
  admin: '/admin',
  object: (id: string) => `/objects/${encodeURIComponent(id)}`,
  objectSection: (id: string, section: ObjectSection) => `/objects/${encodeURIComponent(id)}/${section}`,
} as const;
