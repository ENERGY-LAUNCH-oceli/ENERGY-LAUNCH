import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ObjectLayout } from '@/layouts/ObjectLayout';
import { DesignSystemPage } from '@/pages/DesignSystemPage';
import { LaunchPage } from '@/pages/LaunchPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ObjectAuditPage } from '@/pages/ObjectAuditPage';
import { ObjectPassportPage } from '@/pages/ObjectPassportPage';
import { ObjectsPage } from '@/pages/ObjectsPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StagePage } from '@/pages/StagePage';
import { ROUTES } from './routes';

export const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to={ROUTES.overview} replace /> },
      { path: 'overview', element: <OverviewPage /> },
      { path: 'objects', element: <ObjectsPage /> },
      {
        path: 'objects/:objectId',
        element: <ObjectLayout />,
        children: [
          { index: true, element: <ObjectPassportPage /> },
          { path: 'launch', element: <LaunchPage /> },
          { path: 'history', element: <StagePage stageId="METER_HISTORY" /> },
          { path: 'telemetry', element: <StagePage stageId="REALTIME_TELEMETRY" /> },
          { path: 'control', element: <StagePage stageId="ASSET_CONTROL" /> },
          { path: 'dashboards', element: <StagePage stageId="FINAL_DASHBOARDS" /> },
          { path: 'audit', element: <ObjectAuditPage /> },
        ],
      },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'design-system', element: <DesignSystemPage /> },
      { path: 'launch', element: <Navigate to={ROUTES.objectSection('building-1', 'launch')} replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
