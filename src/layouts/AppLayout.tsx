import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppContextMenu } from '@/components/layout/AppContextMenu';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/layout/Toaster';
import { useUi } from '@/store';

/** Оболочка рабочего пространства: навигация, шапка, рабочая область и уведомления. */
export function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    // Плавное появление новой страницы (не при первом показе – там заставка)
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = mainRef.current;
    if (!el) return;
    el.classList.remove('page-enter');
    void el.offsetWidth; // перезапуск анимации
    el.classList.add('page-enter');
  }, [pathname]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat) return;
      // Любая раскладка (Ctrl + B / Ctrl + И): физическая клавиша, виртуальный код (66 = B) или символ
      const key = (event.key ?? '').toLowerCase();
      if (event.code === 'KeyB' || event.keyCode === 66 || key === 'b' || key === 'и') {
        event.preventDefault();
        event.stopPropagation();
        useUi.getState().toggleSidebar();
      }
    };
    // Фаза перехвата: срабатывает раньше обработчиков элементов в фокусе
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
  return (
    <div className="flex min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        К содержимому
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main ref={mainRef} id="main" onAnimationEnd={(e) => e.target === e.currentTarget && e.currentTarget.classList.remove('page-enter')} className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
      <Toaster />
      <AppContextMenu />
    </div>
  );
}
