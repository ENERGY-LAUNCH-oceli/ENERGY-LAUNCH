import { Link, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { CLASS_TITLE, OFFLINE_INFO, STATUS_CODES, statusClass, statusInfo, type StatusClass, type StatusInfo } from '@/errors/codes';
import { STATUS_ANIMATIONS } from '@/errors/animations';
import { cn } from '@/utils/cn';
import { NotFoundPage, StatusPageView } from './NotFoundPage';

/** /errors/:code – страница любого кода состояния; /errors/offline – «нет подключения». */
export function StatusCodePage() {
  const { code = '' } = useParams();
  const info = code === 'offline' ? OFFLINE_INFO : /^\d{3}$/.test(code) ? statusInfo(Number(code)) : null;
  if (!info) return <NotFoundPage />;
  // key: при переходе между кодами – новая анимация, как при обновлении страницы
  return <StatusPageView key={code} info={info} />;
}

const GROUPS: StatusClass[] = ['info', 'success', 'redirect', 'client', 'server'];

function CodeCard({ info, to }: { info: StatusInfo; to: string }) {
  const cls = statusClass(info.code);
  const failing = cls === 'client' || cls === 'server' || cls === 'offline';
  return (
    <li>
      <Link to={to} data-testid={`status-link-${info.code || 'offline'}`} className="flex h-full flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-hover">
        <span className={cn('font-mono text-body font-semibold tabular', failing ? 'text-error' : 'text-accent-strong')}>{info.code || '—'}</span>
        <span className="text-body-sm font-medium">{info.title}</span>
        <span className="truncate font-mono text-caption text-text-muted">{info.name}</span>
      </Link>
    </li>
  );
}

/** /errors – все коды состояния HTTP (реестр IANA) и «нет подключения». */
export function StatusCodesPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="text-label text-text-muted">Справочник</span>
        <h1 className="text-h1">Коды состояния</h1>
        <p className="max-w-3xl text-body-lg text-text-secondary">
          Все коды HTTP из реестра IANA и экран «Нет подключения». У каждой страницы своя анимация из {STATUS_ANIMATIONS.length} вариантов – при обновлении она меняется. Ошибки, которые отдаёт
          веб-сервер до загрузки приложения, показываются теми же страницами: <span className="font-mono text-body-sm">/status/&lt;код&gt;.html</span>.
        </p>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">{CLASS_TITLE.offline}</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          <CodeCard info={OFFLINE_INFO} to={`${ROUTES.statusCodes}/offline`} />
        </ul>
      </section>
      {GROUPS.map((g) => (
        <section key={g} className="flex flex-col gap-3">
          <h2 className="text-h3">{CLASS_TITLE[g]}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {STATUS_CODES.filter((x) => statusClass(x.code) === g).map((x) => (
              <CodeCard key={x.code} info={x} to={`${ROUTES.statusCodes}/${x.code}`} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
