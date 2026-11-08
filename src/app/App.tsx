import { useCallback, useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { OfflineOverlay } from '@/components/errors/OfflineOverlay';
import { appRole, useAuth } from '@/store/auth-store';
import { Preloader } from '@/components/layout/Preloader';
import { TooltipProvider } from '@/components/ui/tooltip';
import { env } from '@/config/env';
import type { Case4Progress } from '@/data/case4';
import { useLaunchStore } from '@/store';
import { router } from './router';
import { isStatusCatalog, StandaloneStatus, standaloneStatus } from './StandaloneStatus';

export function App() {
  const bootstrap = useLaunchStore((s) => s.bootstrap);
  const commit = useLaunchStore((s) => s.commitBootstrap);
  const prepared = useLaunchStore((s) => s.dataPrepared);
  const ready = useLaunchStore((s) => s.currentObjectId !== null);
  const [progress, setProgress] = useState<Case4Progress | null>(null);
  // Страница ошибки, открытая по адресу, – сразу и без прелоадера; данные портфеля ей не нужны
  const standalone = useMemo(() => (typeof window === 'undefined' ? null : standaloneStatus(window.location.pathname)), []);
  // В e2e-сборке прелоадер не показывается – он перекрывал бы элементы тестам; справочнику кодов он тоже не нужен
  const [preloader, setPreloader] = useState(() => env.preloader && !standalone && !(typeof window !== 'undefined' && isStatusCatalog(window.location.pathname)));
  const hide = useCallback(() => setPreloader(false), []);
  // Данные забираются в паузе анимации (надпись уже на экране) – без рывков во время бега тока
  const hold = useCallback(() => void commit(), [commit]);

  const auth = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const required = useAuth((s) => s.required);
  // Окно входа: по адресу /login или когда сервер требует вход для всего сайта; иначе – демо-режим
  const wantsLogin = typeof window !== 'undefined' && window.location.pathname === '/login';
  const loginScreen = (auth === 'setup' || auth === 'login') && (required || wantsLogin);
  const allowed = auth !== 'loading' && !loginScreen && !(wantsLogin && auth === 'off');
  useEffect(() => {
    void useAuth.getState().check();
  }, []);
  // Данные грузятся только после входа (или когда вход не используется)
  useEffect(() => {
    if (allowed && !standalone) void bootstrap(setProgress);
  }, [allowed, standalone, bootstrap]);
  useEffect(() => {
    if (user) useLaunchStore.getState().setIdentity(user.name, appRole(user.role));
  }, [user, ready]);
  useEffect(() => {
    if (!preloader && prepared && !ready) void commit();
  }, [preloader, prepared, ready, commit]);

  if (standalone) {
    return (
      <>
        <StandaloneStatus info={standalone} />
        <OfflineOverlay />
      </>
    );
  }
  if (auth === 'loading') return <OfflineOverlay />;
  if (loginScreen || (wantsLogin && auth === 'off')) {
    return (
      <>
        <AuthScreen />
        <OfflineOverlay />
      </>
    );
  }

  const status = progress && progress.total ? `Проверка набора · ${progress.label} · ${progress.done}/${progress.total}` : undefined;
  return (
    <>
      {ready && (
        <TooltipProvider delayDuration={200}>
          <RouterProvider router={router} />
        </TooltipProvider>
      )}
      {preloader && <Preloader ready={prepared} canExit={ready} {...(status ? { status } : {})} onHold={hold} onDone={hide} />}
      <OfflineOverlay />
    </>
  );
}
