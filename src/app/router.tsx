import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuditPage } from '@/pages/AuditPage';
import { DesignSystemPage } from '@/pages/DesignSystemPage';
import { LaunchPage } from '@/pages/LaunchPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ObjectsPage } from '@/pages/ObjectsPage';
import { ROUTES } from './routes';

export const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to={ROUTES.launch} replace /> },
      { path: ROUTES.objects, element: <ObjectsPage /> },
      { path: ROUTES.launch, element: <LaunchPage /> },
      { path: ROUTES.audit, element: <AuditPage /> },
      { path: ROUTES.designSystem, element: <DesignSystemPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
