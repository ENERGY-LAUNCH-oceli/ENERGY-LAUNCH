import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEFAULT_SCENARIO_ID } from '@/data/scenarios';
import { useLaunchStore } from '@/store';
import { router } from './router';

export function App() {
  const hasSession = useLaunchStore((s) => s.session !== null);
  const loadScenario = useLaunchStore((s) => s.loadScenario);

  useEffect(() => {
    if (!hasSession) loadScenario(DEFAULT_SCENARIO_ID);
  }, [hasSession, loadScenario]);

  return (
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}
