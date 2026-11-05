export type ObjectSection = 'launch' | 'history' | 'telemetry' | 'control' | 'dashboards' | 'audit';

export const ROUTES = {
  root: '/',
  overview: '/overview',
  objects: '/objects',
  settings: '/settings',
  designSystem: '/design-system',
  object: (id: string) => `/objects/${encodeURIComponent(id)}`,
  objectSection: (id: string, section: ObjectSection) => `/objects/${encodeURIComponent(id)}/${section}`,
} as const;
