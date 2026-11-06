import { useCallback, useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Preloader } from '@/components/layout/Preloader';
import { TooltipProvider } from '@/components/ui/tooltip';
import { env } from '@/config/env';
import type { Case4Progress } from '@/data/case4';
import { useLaunchStore } from '@/store';
import { router } from './router';

export function App() {
  const bootstrap = useLaunchStore((s) => s.bootstrap);
  const commit = useLaunchStore((s) => s.commitBootstrap);
  const prepared = useLaunchStore((s) => s.dataPrepared);
  const ready = useLaunchStore((s) => s.currentObjectId !== null);
  const [progress, setProgress] = useState<Case4Progress | null>(null);
  // В e2e-сборке (синтетический портфель) прелоадер не показывается – он перекрывал бы элементы тестам
  const [preloader, setPreloader] = useState(env.dataset !== 'synthetic');
  const hide = useCallback(() => setPreloader(false), []);
  // Данные забираются в паузе анимации (надпись уже на экране) – без рывков во время бега тока
  const hold = useCallback(() => void commit(), [commit]);

  useEffect(() => {
    void bootstrap(setProgress);
  }, [bootstrap]);
  useEffect(() => {
    if (!preloader && prepared && !ready) void commit();
  }, [preloader, prepared, ready, commit]);

  const status = progress && progress.total ? `Проверка набора · ${progress.label} · ${progress.done}/${progress.total}` : undefined;
  return (
    <>
      {ready && (
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
        </TooltipProvider>
      )}
      {preloader && <Preloader ready={prepared} canExit={ready} {...(status ? { status } : {})} onHold={hold} onDone={hide} />}
    </>
  );
}
