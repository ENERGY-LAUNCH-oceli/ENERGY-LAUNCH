import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLaunchStore } from '@/store';
import { router } from './router';

export function App() {
  const initPortfolio = useLaunchStore((s) => s.initPortfolio);

  useEffect(() => {
    initPortfolio();
  }, [initPortfolio]);

  return (
    <TooltipProvider delayDuration={200}>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}
