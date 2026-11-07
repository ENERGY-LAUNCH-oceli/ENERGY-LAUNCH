import { CircleHelp, CirclePlay, GraduationCap, type LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Tooltip } from '@/components/ui/tooltip';
import { useHelpDialog } from '@/features/help/help-api';
import { startTour } from '@/features/tour/TourHost';
import { TOURS, tourForPath } from '@/features/tour/tours';
import { cn } from '@/utils/cn';
import { SB_LABEL, SB_ROW, SB_ROW_SM } from './sidebar-styles';

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

  // Разметка одна для обоих состояний: в свёрнутой панели рамка и фон гаснут, подписи обрезаются
  return (
    <section
      aria-label="Помощь"
      className="flex flex-col gap-px rounded-md border border-border bg-surface-secondary p-1 transition-[background-color,border-color] duration-200 group-data-[collapsed=true]/sb:border-transparent group-data-[collapsed=true]/sb:bg-transparent"
    >
      {actions.map((a) => (
        <Tooltip key={a.id} side="right" disabled={!collapsed} content={<span><b>{a.label}</b> · {a.hint}</span>}>
          <button type="button" onClick={() => run(a)} aria-label={a.label} title={collapsed ? undefined : a.hint} data-testid={`sidebar-help-${a.id}`} className={cn(SB_ROW, SB_ROW_SM, 'px-[6.5px] hover:bg-surface group-data-[collapsed=true]/sb:hover:bg-accent-subtle')}>
            <a.icon className="size-[17px] shrink-0 text-accent-strong" strokeWidth={1.75} aria-hidden />
            <span className={SB_LABEL}>{a.label}</span>
          </button>
        </Tooltip>
      ))}
    </section>
  );
}
