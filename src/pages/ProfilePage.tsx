import { KeyRound, LogOut } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { AUDIT_ACTION_LABEL } from '@/config/labels';
import { findObject } from '@/data/objects';
import { notify } from '@/store';
import { ACCOUNT_ROLE_TITLE, authApi, useAuth, type MyStats } from '@/store/auth-store';
import { formatDateTime } from '@/utils/format';

export function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-surface px-4 py-3">
      <span className="text-caption text-text-muted">{label}</span>
      <span className="tabular text-h3">{value}</span>
      {hint && <span className="text-caption text-text-muted">{hint}</span>}
    </div>
  );
}

const dt = (v: string | null | undefined) => (v ? formatDateTime(v) : '–');
const actionLabel = (a: string) => (AUDIT_ACTION_LABEL as Record<string, string>)[a] ?? a;

/** Личный кабинет: профиль, свои метрики и действия из журнала аудита, смена пароля. */
export function ProfilePage() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [stats, setStats] = React.useState<MyStats | null>(null);
  const [pw, setPw] = React.useState({ current: '', next: '', repeat: '' });
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (user) void authApi.myStats().then(setStats, () => setStats(null));
  }, [user]);

  if (!user) return <EmptyState title="Вход не используется" description="Личный кабинет доступен, когда приложение работает с сервером и сотрудники заведены администратором." />;

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.next !== pw.repeat) return setPwError('Новые пароли не совпадают');
    setBusy(true);
    try {
      await authApi.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', repeat: '' });
      notify({ tone: 'success', title: 'Пароль изменён', description: 'Другие сеансы этой учётной записи завершены' });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Пароль не изменён');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="profile-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-label text-text-muted">Личный кабинет</span>
          <h1 className="text-h1">{user.name}</h1>
          <p className="text-body text-text-secondary">
            {ACCOUNT_ROLE_TITLE[user.role]} · логин <span className="font-mono">{user.login}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {user.role === 'ADMIN' && (
            <Button asChild variant="secondary">
              <Link to={ROUTES.admin}>Админ-панель</Link>
            </Button>
          )}
          <Button variant="ghost" onClick={() => void logout()}>
            <LogOut aria-hidden />
            Выйти
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Действий всего" value={stats?.actions ?? '–'} />
        <Metric label="За 7 дней" value={stats?.actions_7d ?? '–'} />
        <Metric label="Объектов в работе" value={stats?.objects ?? '–'} />
        <Metric label="Входов" value={stats?.login_count ?? '–'} hint={`последний: ${dt(stats?.last_login_at)}`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-h3">Мои последние действия</h2>
          {stats?.byAction.length ? (
            <div className="flex flex-wrap gap-2">
              {stats.byAction.map((a) => (
                <span key={a.action} className="rounded-sm bg-surface-sunken px-2 py-1 text-caption">
                  {actionLabel(a.action)} · <b className="tabular">{a.n}</b>
                </span>
              ))}
            </div>
          ) : null}
          {!stats ? (
            <p className="text-body-sm text-text-muted">Загрузка…</p>
          ) : stats.recent.length === 0 ? (
            <p className="text-body-sm text-text-muted">Пока нет действий: они появятся, когда вы начнёте работать с объектами.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border" data-testid="my-actions">
              {stats.recent.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-body-sm">
                  <span>
                    {actionLabel(e.action)}
                    {e.objectId && (
                      <>
                        {' · '}
                        <Link className="link-line text-accent-strong" to={ROUTES.object(e.objectId)}>
                          {findObject(e.objectId)?.name ?? e.objectId}
                        </Link>
                      </>
                    )}
                  </span>
                  <span className="tabular text-caption text-text-muted">{dt(e.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={(e) => void change(e)} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" data-testid="password-form">
          <h2 className="text-h3">Смена пароля</h2>
          <Field label="Текущий пароль" htmlFor="pw-current">
            <Input id="pw-current" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </Field>
          <Field label="Новый пароль" htmlFor="pw-next" hint="Не короче 8 символов">
            <Input id="pw-next" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          </Field>
          <Field label="Новый пароль ещё раз" htmlFor="pw-repeat">
            <Input id="pw-repeat" type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} required />
          </Field>
          {pwError && (
            <p role="alert" className="text-caption text-error">
              {pwError}
            </p>
          )}
          <Button type="submit" variant="accent" loading={busy}>
            <KeyRound aria-hidden />
            Сменить пароль
          </Button>
          <p className="text-caption text-text-muted">Учётная запись создана {dt(stats?.created_at)}.</p>
        </form>
      </div>
    </div>
  );
}
