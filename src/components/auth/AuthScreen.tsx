import { Check, Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useAuth } from '@/store/auth-store';
import { cn } from '@/utils/cn';
import { AuthShowcase } from './AuthShowcase';
import { LanguageToggle } from '@/components/layout/LanguageToggle';

/** Поле пароля с кнопкой «Показать / скрыть». */
function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [shown, setShown] = React.useState(false);
  return (
    <div className="relative">
      <Input id={id} type={shown ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} required className="pr-10" />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text-primary"
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex items-center gap-1.5', ok ? 'text-success' : 'text-text-muted')}>
      {ok ? <Check className="size-3" aria-hidden /> : <span className="size-1 rounded-full bg-current" aria-hidden />}
      {children}
    </li>
  );
}

/** Окно входа. При первом запуске (сотрудников нет) – создание администратора. */
export function AuthScreen() {
  const status = useAuth((s) => s.status);
  const login = useAuth((s) => s.login);
  const setup = useAuth((s) => s.setup);
  const required = useAuth((s) => s.required);
  const first = status === 'setup';
  const [form, setForm] = React.useState({ login: '', name: '', password: '', repeat: '' });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const rules = { length: form.password.length >= 8, match: form.password.length > 0 && form.password === form.repeat, login: /^[a-z0-9._-]{3,40}$/i.test(form.login.trim()) };
  const ready = first ? rules.length && rules.match && rules.login && form.name.trim().length >= 2 : form.login.trim() !== '' && form.password !== '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (first && !rules.match) return setError('Пароли не совпадают');
    setBusy(true);
    try {
      if (first) await setup({ login: form.login, name: form.name, password: form.password });
      else await login(form.login, form.password);
      // После входа – личный кабинет; приложение загружается заново уже от имени сотрудника
      window.location.assign('/me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh w-full grid-cols-1 gap-3 bg-background p-3 lg:grid-cols-2">
      <AuthShowcase />

      {/* Форма – в стиле интерфейса: плоская панель, тонкая рамка, обычные размеры */}
      <section className="flex min-h-[calc(100dvh-1.5rem)] flex-col rounded-2xl border border-border bg-surface px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <LanguageToggle className="ml-auto" />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <form onSubmit={(e) => void submit(e)} data-testid="auth-form" className="flex w-full max-w-[360px] flex-col gap-4">
            <div className="mb-2 flex flex-col gap-1">
              <h1 className="text-h2">{first ? 'Первый запуск' : 'Вход'}</h1>
              <p className="text-body-sm text-text-secondary">{first ? 'Создайте учётную запись администратора.' : 'Логин и пароль выдаёт администратор.'}</p>
            </div>

            <Field label="Логин" htmlFor="auth-login">
              <Input id="auth-login" autoComplete="username" autoFocus value={form.login} onChange={(e) => set('login')(e.target.value)} required />
            </Field>
            {first && (
              <Field label="Имя и фамилия" htmlFor="auth-name" hint="Так вы будете подписаны в журнале">
                <Input id="auth-name" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} required />
              </Field>
            )}
            <Field label="Пароль" htmlFor="auth-password">
              <PasswordInput id="auth-password" autoComplete={first ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />
            </Field>
            {first && (
              <>
                <Field label="Пароль ещё раз" htmlFor="auth-repeat">
                  <PasswordInput id="auth-repeat" autoComplete="new-password" value={form.repeat} onChange={set('repeat')} />
                </Field>
                <ul className="-mt-1 flex flex-col gap-1 text-caption" aria-label="Требования">
                  <Rule ok={rules.login}>логин – латиница и цифры, от 3 символов</Rule>
                  <Rule ok={rules.length}>пароль – от 8 символов</Rule>
                  <Rule ok={rules.match}>пароли совпадают</Rule>
                </ul>
              </>
            )}

            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}
            {status === 'off' && (
              <p role="alert" className="text-body-sm text-warning">
                Сервер хранилища недоступен – войти нельзя.
              </p>
            )}

            <Button type="submit" variant="primary" loading={busy} disabled={status === 'off' || !ready} className="mt-1 w-full">
              {first ? 'Создать администратора' : 'Войти'}
            </Button>
            {!required && (
              <>
                <div className="flex items-center gap-3 text-caption text-text-muted" aria-hidden>
                  <span className="h-px flex-1 bg-border" />
                  или
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Button asChild variant="secondary" className="w-full">
                  <a href="/overview">Продолжить в демо-режиме</a>
                </Button>
              </>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
