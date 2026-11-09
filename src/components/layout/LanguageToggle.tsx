import { Languages } from 'lucide-react';
import { useLang } from '@/i18n';
import { cn } from '@/utils/cn';

/** Язык, на который переключит кнопка, – на нём самом: «English» в русском интерфейсе, «Русский» в английском. */
export const nextLangLabel = (lang: 'ru' | 'en') => (lang === 'en' ? 'Русский' : 'English');

/** Переключатель языка (иконка) – в шапке на телефоне и на окне входа. */
export function LanguageToggle({ className }: { className?: string }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const label = nextLangLabel(lang);
  return (
    <button
      type="button"
      onClick={() => void setLang(lang === 'en' ? 'ru' : 'en')}
      aria-label={label}
      title={label}
      data-i18n-skip
      data-testid="lang-toggle"
      className={cn(
        'inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-sm sm:px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary [&_svg]:size-[17px]',
        className,
      )}
    >
      <Languages strokeWidth={1.75} aria-hidden />
      {/* Подпись – с 640 px: на телефоне шапка узкая, хватает иконки */}
      <span className="hidden sm:inline">{lang === 'en' ? 'RU' : 'EN'}</span>
    </button>
  );
}
