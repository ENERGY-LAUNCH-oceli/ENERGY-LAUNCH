import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { matchRoutes } from 'react-router-dom';
import { StatusScreen } from '@/components/errors/StatusScreen';
import { Button } from '@/components/ui/button';
import { OFFLINE_INFO, statusInfo, type StatusInfo } from '@/errors/codes';
import { router } from './router';

/**
 * Страница ошибки, открытая по адресу (404 или /errors/<код>): показывается сразу, без прелоадера
 * и без загрузки данных портфеля – как статические страницы веб-сервера. null – обычная страница сайта.
 */
export function standaloneStatus(pathname: string): StatusInfo | null {
  const m = /^\/errors\/([^/]+)\/?$/.exec(pathname);
  if (m) return m[1] === 'offline' ? OFFLINE_INFO : /^\d{3}$/.test(m[1]!) ? (statusInfo(Number(m[1])) ?? statusInfo(404)) : statusInfo(404);
  if (pathname === '/login') return null;
  const matches = matchRoutes(router.routes, pathname);
  const leaf = matches?.at(-1)?.route;
  return !matches || leaf?.path === '*' ? statusInfo(404) : null;
}

/** Справочник кодов – тоже без прелоадера (данные портфеля ему не нужны для показа). */
export const isStatusCatalog = (pathname: string) => /^\/errors\/?$/.test(pathname);

export function StandaloneStatus({ info }: { info: StatusInfo }) {
  return (
    <main className="min-h-dvh bg-background p-3">
      <div>
        <StatusScreen
          standalone
          info={info}
          actions={
            <>
              <Button asChild variant="accent">
                <a href="/overview">
                  <LayoutGrid aria-hidden />К обзору объектов
                </a>
              </Button>
              <Button variant="secondary" onClick={() => (window.history.length > 1 ? window.history.back() : window.location.assign('/overview'))}>
                <ArrowLeft aria-hidden />
                Назад
              </Button>
            </>
          }
          footer={
            <a href="/errors" className="link-line text-body-sm text-accent-strong">
              Все коды состояния
            </a>
          }
        />
      </div>
    </main>
  );
}
