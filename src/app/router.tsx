import type * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ObjectLayout } from '@/layouts/ObjectLayout';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { ROUTES } from './routes';

/** Страницы грузятся по маршруту: обзор – в основном пакете, остальное – отдельными чанками. */
const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) =>
  async () => ({ Component: (await load())[name] as React.ComponentType });

export const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <AppLayout />,
    // Первый показ ленивой страницы: пока её чанк грузится, рисовать нечего (как и без этого свойства) –
    // явный пустой fallback убирает предупреждение React Router «No HydrateFallback element provided» в консоли
    HydrateFallback: () => null,
    children: [
      { index: true, element: <Navigate to={ROUTES.overview} replace /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'objects', lazy: page(() => import('@/pages/ObjectsPage'), 'ObjectsPage') },
      {
        path: 'objects/:objectId',
        element: <ObjectLayout />,
        children: [
          { index: true, lazy: page(() => import('@/pages/ObjectPassportPage'), 'ObjectPassportPage') },
          { path: 'launch', lazy: page(() => import('@/pages/LaunchPage'), 'LaunchPage') },
          { path: 'history', lazy: page(() => import('@/pages/InvoiceValidationPage'), 'InvoiceValidationPage') },
          { path: 'telemetry', lazy: page(() => import('@/pages/TelemetryValidationPage'), 'TelemetryValidationPage') },
          { path: 'control', lazy: page(() => import('@/pages/ControlTestingPage'), 'ControlTestingPage') },
          { path: 'dashboards', lazy: page(() => import('@/pages/DashboardsPage'), 'DashboardsPage') },
          { path: 'audit', lazy: page(() => import('@/pages/ObjectAuditPage'), 'ObjectAuditPage') },
          { path: 'protocol', lazy: page(() => import('@/pages/ProtocolPage'), 'ProtocolPage') },
        ],
      },
      { path: 'settings', lazy: page(() => import('@/pages/SettingsPage'), 'SettingsPage') },
      { path: 'blockers', lazy: page(() => import('@/pages/BlockersPage'), 'BlockersPage') },
      { path: 'evidence', lazy: page(() => import('@/pages/EvidencePage'), 'EvidencePage') },
      { path: 'audit', lazy: page(() => import('@/pages/AuditTrailPage'), 'AuditTrailPage') },
      { path: 'scenarios', lazy: page(() => import('@/pages/ScenariosPage'), 'ScenariosPage') },
      { path: 'help', lazy: page(() => import('@/pages/HelpPage'), 'HelpPage') },
      { path: 'me', lazy: page(() => import('@/pages/ProfilePage'), 'ProfilePage') },
      { path: 'admin', lazy: page(() => import('@/pages/AdminPage'), 'AdminPage') },
      { path: 'errors', lazy: page(() => import('@/pages/StatusCodesPage'), 'StatusCodesPage') },
      { path: 'errors/:code', lazy: page(() => import('@/pages/StatusCodesPage'), 'StatusCodePage') },
      { path: 'launch', element: <Navigate to={ROUTES.objectSection('obj-001', 'launch')} replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
