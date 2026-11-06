import { Moon, Sun } from 'lucide-react';
import { useUi } from '@/store';
import { cn } from '@/utils/cn';

/** Переключатель светлой и тёмной темы. Подпись называет тему, на которую переключит кнопка. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUi((s) => s.theme);
  const toggle = useUi((s) => s.toggleTheme);
  const dark = theme === 'dark';
  const label = dark ? 'Светлая тема' : 'Тёмная тема';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary [&_svg]:size-[17px]',
        className,
      )}
    >
      {dark ? <Sun strokeWidth={1.75} aria-hidden /> : <Moon strokeWidth={1.75} aria-hidden />}
    </button>
  );
}
