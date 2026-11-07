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
  object: (id: string) => `/objects/${encodeURIComponent(id)}`,
  objectSection: (id: string, section: ObjectSection) => `/objects/${encodeURIComponent(id)}/${section}`,
} as const;
