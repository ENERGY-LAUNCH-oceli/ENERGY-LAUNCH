import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { accentThemes, themes, type AccentId, type ThemeId } from '@/design/tokens';
import { LANGS, useLang } from '@/i18n';
import { useUi } from '@/store';

const THEME_OPTIONS: { id: ThemeId; label: string; hint: string }[] = [
  { id: 'light', label: 'Светлая', hint: 'Для дневной работы и печати протоколов' },
  { id: 'dark', label: 'Тёмная', hint: 'Для диспетчерской и длительной работы' },
];

const ACCENT_OPTIONS: { id: AccentId; label: string }[] = [
  { id: 'teal', label: 'Бирюзовый' },
  { id: 'blue', label: 'Синий' },
];

/** Мини-макет приложения в цветах выбранной темы и акцента. */
function ThemePreview({ theme, accent }: { theme: ThemeId; accent: AccentId }) {
  const c = themes[theme];
  const a = accentThemes[accent][theme];
  return (
    <span aria-hidden className="flex aspect-[16/9] w-full overflow-hidden rounded-md border" style={{ backgroundColor: c.background, borderColor: c.border }}>
      <span className="flex w-[26%] shrink-0 flex-col gap-1.5 border-r p-2" style={{ backgroundColor: c.surface, borderColor: c.border }}>
        <span className="mb-1 flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: a.accent }} />
          <span className="h-1 w-8 rounded-full" style={{ backgroundColor: c.textPrimary }} />
        </span>
        <span className="flex h-3 items-center rounded-sm px-1" style={{ backgroundColor: a.accentSubtle }}>
          <span className="h-1 w-3/4 rounded-full" style={{ backgroundColor: a.accentStrong }} />
        </span>
        {[70, 55, 80, 60].map((w) => (
          <span key={w} className="flex h-3 items-center px-1">
            <span className="h-1 rounded-full" style={{ width: `${w}%`, backgroundColor: c.textMuted, opacity: 0.6 }} />
          </span>
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        <span className="flex items-center justify-between">
          <span className="h-1.5 w-1/3 rounded-full" style={{ backgroundColor: c.textPrimary }} />
          <span className="h-3 w-8 rounded-sm" style={{ backgroundColor: a.accent }} />
        </span>
        <span className="grid grid-cols-3 gap-1.5">
          {[c.success, a.accent, c.warning].map((dot, i) => (
            <span key={i} className="flex flex-col gap-1 rounded-sm border p-1.5" style={{ backgroundColor: c.surface, borderColor: c.border }}>
              <span className="h-1 w-3/5 rounded-full" style={{ backgroundColor: c.textMuted, opacity: 0.6 }} />
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />
                <span className="h-1.5 w-1/2 rounded-full" style={{ backgroundColor: c.textPrimary }} />
              </span>
            </span>
          ))}
        </span>
        <span className="relative flex-1 overflow-hidden rounded-sm border" style={{ backgroundColor: c.surface, borderColor: c.border }}>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <path d="M0 30 L12 26 L24 28 L36 18 L48 21 L60 12 L72 15 L84 8 L100 10 L100 40 L0 40 Z" fill={a.accent} opacity="0.14" />
            <path d="M0 30 L12 26 L24 28 L36 18 L48 21 L60 12 L72 15 L84 8 L100 10" fill="none" stroke={a.accent} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
        </span>
      </span>
    </span>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${on ? 'border-accent-strong bg-accent-strong' : 'border-border-strong bg-surface'}`}>
      {on && <span className="size-1.5 rounded-full bg-accent-foreground" />}
    </span>
  );
}

function GroupLabel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-body-sm font-medium">{title}</h3>
      <p className="text-caption text-text-muted">{description}</p>
    </div>
  );
}

const optionClass = (on: boolean) =>
  `transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${on ? 'border-accent-strong bg-accent-subtle/40' : 'border-border hover:border-border-strong hover:bg-surface-hover'}`;

/** Тема и акцентный цвет: выбор сохраняется в браузере. */
export function AppearanceSettings() {
  const theme = useUi((s) => s.theme);
  const accent = useUi((s) => s.accent);
  const setAppearance = useUi((s) => s.setAppearance);
  return (
    <Card>
      <CardContent className="grid gap-6 pt-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] xl:gap-0">
        <div className="flex min-w-0 flex-col gap-3 xl:pr-6">
          <GroupLabel title="Тема" description="Влияет на весь интерфейс. Быстрое переключение – внизу боковой панели." />
          <div role="radiogroup" aria-label="Тема" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {THEME_OPTIONS.map((o) => {
              const on = theme === o.id;
              return (
                <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => setAppearance(o.id, accent)} className={`flex flex-col gap-3 rounded-lg border p-2.5 text-left ${optionClass(on)}`}>
                  <ThemePreview theme={o.id} accent={accent} />
                  <span className="flex items-start gap-2.5 px-1 pb-0.5">
                    <RadioDot on={on} />
                    <span className="-mt-0.5 flex min-w-0 flex-col">
                      <span className="text-body-sm font-medium">{o.label}</span>
                      <span className="text-caption text-text-muted">{o.hint}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <GroupLabel title="Акцентный цвет" description="Кнопки, активные пункты, графики и фокус. Цвета статусов не меняются." />
          <div role="radiogroup" aria-label="Акцентный цвет" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {ACCENT_OPTIONS.map((o) => {
              const on = accent === o.id;
              const c = accentThemes[o.id][theme];
              return (
                <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => setAppearance(theme, o.id)} className={`flex items-center gap-3 rounded-lg border p-3 text-left ${optionClass(on)}`}>
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: c.accent }}>
                    {on && <Check className="size-4" style={{ color: c.accentForeground }} />}
                  </span>
                  <span className="min-w-0 flex-1 text-body-sm font-medium">{o.label}</span>
                  <span aria-hidden className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-sm px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: c.accentSubtle, color: c.accentStrong }}>
                      Этап
                    </span>
                    <span className="rounded-sm px-2 py-1 text-[11px] font-medium" style={{ backgroundColor: c.accent, color: c.accentForeground }}>
                      Кнопка
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-auto rounded-md bg-surface-secondary px-3 py-2.5 text-caption text-text-muted">
            Сейчас: <span className="font-medium text-text-primary">{THEME_OPTIONS.find((t) => t.id === theme)?.label.toLowerCase()} тема</span>,{' '}
            <span className="font-medium text-text-primary">{ACCENT_OPTIONS.find((a) => a.id === accent)?.label.toLowerCase()} акцент</span>. Сохраняется в этом браузере.
          </p>
        </div>
        <LanguageSettings />
      </CardContent>
    </Card>
  );
}

/** Язык интерфейса: названия – на самом языке (не переводятся), выбор запоминается в браузере. */
function LanguageSettings() {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-6 xl:col-span-2 xl:mt-6">
      <GroupLabel title="Язык интерфейса" description="Основной – русский. Переключение мгновенное, данные и ход запуска не меняются; выбор сохраняется в этом браузере." />
      <div role="radiogroup" aria-label="Язык интерфейса" className="grid gap-2 sm:grid-cols-2 xl:max-w-[560px]" data-testid="settings-lang">
        {LANGS.map((o) => {
          const on = lang === o.id;
          return (
            <button type="button" role="radio" aria-checked={on} key={o.id} onClick={() => void setLang(o.id)} aria-label={o.native} className={`flex items-center gap-3 rounded-lg border p-3 text-left ${optionClass(on)}`}>
              <RadioDot on={on} />
              <span className="flex min-w-0 flex-1 flex-col">
                {/* Название языка – на нём самом и не переводится */}
                <span className="text-body-sm font-medium" data-i18n-skip>
                  {o.native}
                </span>
                <span className="text-caption text-text-muted">{o.id === 'ru' ? 'Основной язык' : 'Второй язык'}</span>
              </span>
              <span aria-hidden className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">{o.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
