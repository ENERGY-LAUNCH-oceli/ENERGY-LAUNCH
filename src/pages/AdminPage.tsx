import { KeyRound, RefreshCw, UserPlus } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { notify } from '@/store';
import { ACCOUNT_ROLE_TITLE, ACCOUNT_ROLES, authApi, useAuth, type AccountRole, type AdminSummary, type AdminUser } from '@/store/auth-store';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { Metric } from './ProfilePage';

const ROLE_OPTIONS = ACCOUNT_ROLES.map((r) => ({ value: r, label: ACCOUNT_ROLE_TITLE[r] }));
const dt = (v: string | null) => (v ? formatDateTime(v) : '–');

/** Пароль для нового сотрудника: 12 символов без похожих букв и цифр. */
function generatePassword(): string {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(rnd, (n) => abc[n % abc.length]).join('');
}

/** Админ-панель: сотрудники, логины и пароли, отключение, роли; метрики активности. */
export function AdminPage() {
  const me = useAuth((s) => s.user);
  const [data, setData] = React.useState<{ users: AdminUser[]; summary: AdminSummary } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ login: '', name: '', role: 'LAUNCH_ENGINEER' as AccountRole, password: generatePassword() });
  const [busy, setBusy] = React.useState(false);
  const [issued, setIssued] = React.useState<{ login: string; password: string } | null>(null);

  const load = React.useCallback(() => {
    authApi.users().then(setData, (e: unknown) => setError(e instanceof Error ? e.message : 'Нет доступа'));
  }, []);
  React.useEffect(() => {
    if (me?.role === 'ADMIN') load();
  }, [me, load]);

  if (!me) return <EmptyState title="Вход не используется" description="Админ-панель доступна, когда приложение работает с сервером." />;
  if (me.role !== 'ADMIN') return <EmptyState title="Только для администратора" description="Обратитесь к администратору, чтобы изменить права." />;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.createUser(form);
      setIssued({ login: form.login.trim().toLowerCase(), password: form.password });
      setForm({ login: '', name: '', role: 'LAUNCH_ENGINEER', password: generatePassword() });
      notify({ tone: 'success', title: 'Сотрудник добавлен', description: 'Передайте логин и пароль сотруднику' });
      load();
    } catch (err) {
      notify({ tone: 'error', title: 'Сотрудник не добавлен', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const update = async (u: AdminUser, patch: Parameters<typeof authApi.updateUser>[1], done: string) => {
    try {
      await authApi.updateUser(u.id, patch);
      notify({ tone: 'success', title: done, description: u.name });
      load();
    } catch (err) {
      notify({ tone: 'error', title: 'Не изменено', description: err instanceof Error ? err.message : String(err) });
    }
  };

  const resetPassword = (u: AdminUser) => {
    const password = generatePassword();
    void update(u, { password }, 'Пароль сброшен').then(() => setIssued({ login: u.login, password }));
  };

  const s = data?.summary;
  return (
    <div className="flex flex-col gap-6" data-testid="admin-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-label text-text-muted">Администрирование</span>
          <h1 className="text-h1">Сотрудники</h1>
          <p className="max-w-3xl text-body text-text-secondary">Учётные записи, роли и активность. Пароли хранятся только в виде хеша – посмотреть их нельзя, можно выдать новый.</p>
        </div>
        <Button variant="secondary" onClick={load}>
          <RefreshCw aria-hidden />
          Обновить
        </Button>
      </header>

      {error && <p className="text-body-sm text-error">{error}</p>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="admin-metrics">
        <Metric label="Сотрудников" value={s?.users ?? '–'} />
        <Metric label="Активны за 7 дней" value={s?.active_7d ?? '–'} hint="входили в систему" />
        <Metric label="Действий за 24 ч" value={s?.actions_24h ?? '–'} />
        <Metric label="Открытых сеансов" value={s?.sessions ?? '–'} />
        <Metric label="Отключены" value={s?.disabled ?? '–'} />
      </section>

      <div className="grid gap-6 min-[1800px]:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={(e) => void create(e)} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5" data-testid="create-user-form">
          <h2 className="text-h3">Новый сотрудник</h2>
          <Field label="Имя и фамилия" htmlFor="u-name" hint="Так сотрудник подписан в журнале аудита">
            <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Логин" htmlFor="u-login" hint="Латиница, цифры, точка, дефис; 3–40 символов">
            <Input id="u-login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} required autoComplete="off" />
          </Field>
          <Field label="Роль" htmlFor="u-role">
            <Select id="u-role" value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AccountRole })} options={ROLE_OPTIONS} />
          </Field>
          <Field label="Пароль" htmlFor="u-password" hint="Сгенерирован автоматически, можно заменить (не короче 8 символов)">
            <div className="flex gap-2">
              <Input id="u-password" className="font-mono" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
              <Button type="button" variant="secondary" size="icon" aria-label="Сгенерировать пароль" onClick={() => setForm({ ...form, password: generatePassword() })}>
                <RefreshCw />
              </Button>
            </div>
          </Field>
          <Button type="submit" variant="accent" loading={busy}>
            <UserPlus aria-hidden />
            Добавить сотрудника
          </Button>
          {issued && (
            <div className="rounded-md border border-success-border bg-success-subtle px-3 py-2 text-caption" data-testid="issued-credentials">
              Передайте сотруднику (больше не покажется):
              <div className="mt-1 font-mono text-body-sm">
                логин: <b>{issued.login}</b>
                <br />
                пароль: <b>{issued.password}</b>
              </div>
            </div>
          )}
        </form>

        <section className="min-w-0 overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[880px] text-left text-body-sm" data-testid="users-table">
            <thead className="border-b border-border text-label text-text-muted">
              <tr>
                <th className="px-4 py-3">Сотрудник</th>
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3">Действий</th>
                <th className="px-4 py-3">Объектов</th>
                <th className="px-4 py-3">Последний вход</th>
                <th className="px-4 py-3">Последнее действие</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.users ?? []).map((u) => (
                <tr key={u.id} data-login={u.login} className={cn(u.disabled && 'opacity-55')}>
                  <td className="px-4 py-3">
                    <div className="whitespace-nowrap font-medium">{u.name}</div>
                    <div className="font-mono text-caption text-text-muted">
                      {u.login}
                      {u.disabled ? ' · отключён' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select aria-label={`Роль ${u.login}`} value={u.role} onValueChange={(v) => void update(u, { role: v as AccountRole }, 'Роль изменена')} options={ROLE_OPTIONS} disabled={u.id === me.id} />
                  </td>
                  <td className="tabular px-4 py-3">
                    {u.actions}
                    <div className="text-caption text-text-muted">за 7 дней: {u.actions_7d}</div>
                  </td>
                  <td className="tabular px-4 py-3">{u.objects}</td>
                  <td className="px-4 py-3 text-caption">
                    {dt(u.last_login_at)}
                    <div className="text-text-muted">входов: {u.login_count}</div>
                  </td>
                  <td className="px-4 py-3 text-caption">{dt(u.last_action_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => resetPassword(u)}>
                        <KeyRound aria-hidden />
                        Новый пароль
                      </Button>
                      {u.id !== me.id && (
                        <Button size="sm" variant={u.disabled ? 'secondary' : 'danger'} onClick={() => void update(u, { disabled: !u.disabled }, u.disabled ? 'Сотрудник включён' : 'Сотрудник отключён')}>
                          {u.disabled ? 'Включить' : 'Отключить'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
