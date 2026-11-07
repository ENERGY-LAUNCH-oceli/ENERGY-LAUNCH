import { CircleHelp, CirclePlay, GraduationCap, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Tooltip } from '@/components/ui/tooltip';
import { useHelpDialog } from '@/features/help/help-api';
import { startTour } from '@/features/tour/TourHost';
import { TOURS, tourForPath } from '@/features/tour/tours';

interface Action {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

/**
 * Блок «Помощь» внизу боковой панели: тур по текущей странице и вопрос помощнику по сайту – всегда на виду.
 * В свёрнутой панели – значки с подсказками; в меню телефона – те же пункты.
 */
export function SidebarHelp({ collapsed = false, onAction }: { collapsed?: boolean; onAction?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lesson = tourForPath(pathname);
  const actions: Action[] = [
    lesson
      ? { id: 'tour', label: 'Как это работает', hint: `Тур по этой странице: ${TOURS[lesson]!.title}`, icon: CirclePlay, run: () => startTour(lesson) }
      : { id: 'tour', label: 'Уроки и ответы', hint: 'Раздел «Обучение»', icon: GraduationCap, run: () => navigate(ROUTES.help) },
    { id: 'ask', label: 'Задать вопрос', hint: 'Помощник по сайту ответит и покажет, где это', icon: CircleHelp, run: () => useHelpDialog.getState().show() },
  ];
  const run = (a: Action) => {
    onAction?.();
    a.run();
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1" role="group" aria-label="Помощь">
        {actions.map((a) => (
          <Tooltip key={a.id} side="right" content={<span><b>{a.label}</b> · {a.hint}</span>}>
            <button type="button" onClick={() => run(a)} aria-label={a.label} data-testid={`sidebar-help-${a.id}`} className="flex size-9 items-center justify-center rounded-sm text-accent-strong transition-colors hover:bg-accent-subtle">
              <a.icon className="size-[17px]" strokeWidth={1.75} aria-hidden />
            </button>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <section aria-label="Помощь" className="flex flex-col gap-px rounded-md border border-border bg-surface-secondary p-1">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => run(a)}
          title={a.hint}
          data-testid={`sidebar-help-${a.id}`}
          className="flex h-9 items-center gap-2.5 rounded-sm px-2 text-left text-body-sm text-text-secondary transition-colors duration-fast hover:bg-surface hover:text-text-primary"
        >
          <a.icon className="size-[17px] shrink-0 text-accent-strong" strokeWidth={1.75} aria-hidden />
          <span className="truncate">{a.label}</span>
        </button>
      ))}
    </section>
  );
}
