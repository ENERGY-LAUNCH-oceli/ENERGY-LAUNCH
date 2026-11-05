import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEFAULT_OBJECT_ID } from '@/data/objects';
import { useLaunchStore } from '@/store';
import { router } from './router';

export function App() {
  const hasObject = useLaunchStore((s) => s.currentObjectId !== null);
  const selectObject = useLaunchStore((s) => s.selectObject);

  useEffect(() => {
    if (!useLaunchStore.getState().currentObjectId) selectObject(DEFAULT_OBJECT_ID);
  }, [hasObject, selectObject]);

  return (
    <TooltipProvider delayDuration={200}>
      <RouterProvider router={router} />
    </TooltipProvider>
  );
}
