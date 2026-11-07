import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppContextMenu } from '@/components/layout/AppContextMenu';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/layout/Toaster';
import { HelpAskDialog } from '@/features/help/HelpAskDialog';
import { TourHost } from '@/features/tour/TourHost';
import { useUi } from '@/store';

/** Оболочка рабочего пространства: навигация, шапка, рабочая область и уведомления. */
export function AppLayout() {
  const { pathname, hash, key } = useLocation();
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
  // Переход к блоку по якорю (#id): ждём, пока страница отрисует блок, прокручиваем и подсвечиваем
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    let frame = 0;
    let timer = 0;
    const deadline = performance.now() + 4000;
    const seek = () => {
      const target = document.getElementById(id);
      if (!target) {
        if (performance.now() < deadline) frame = requestAnimationFrame(seek);
        return;
      }
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      target.classList.remove('anchor-flash');
      void target.offsetWidth;
      target.classList.add('anchor-flash');
      timer = window.setTimeout(() => target.classList.remove('anchor-flash'), 1800);
    };
    // После прокрутки вверх при смене страницы
    frame = requestAnimationFrame(seek);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [hash, key]);
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
      <HelpAskDialog />
      <TourHost />
    </div>
  );
}
