import { ArrowRight, PanelRightClose } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { AuditTimeline } from '@/components/launch';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-badge';
import { OBJECT_TABS } from '@/config/navigation';
import { STAGE_META, STAGE_STATUS_LABEL } from '@/config/stages';
import { getNextAction } from '@/engine';
import { useLaunchStore, useUi } from '@/store';
import { STAGE_IDS } from '@/types';
import { cn } from '@/utils/cn';

/** Правая контекстная панель объекта: следующее действие, этапы, последние события. */
export function ContextPanel({ objectId }: { objectId: string }) {
  const open = useUi((s) => s.contextPanelOpen);
  const setOpen = useUi((s) => s.setContextPanelOpen);
  const session = useLaunchStore((s) => s.session);
  const ruleset = useLaunchStore((s) => s.ruleset);
  const audit = useLaunchStore((s) => s.auditLog);
  if (!session) return null;

  const next = getNextAction(session, session.currentStageId, ruleset);
  // Панель не исчезает, а плавно сужается до кнопки: ширина меняется, содержимое гаснет и уезжает вправо,
  // колонка слева расширяется вместе с ней. Внутренний блок прижат к правому краю – кнопка всегда на месте.
  return (
    <aside
      aria-label="Контекст объекта"
      data-open={open}
      className="sticky top-24 hidden h-fit shrink-0 justify-end overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none 2xl:flex"
      style={{ width: open ? 320 : 36 }}
    >
      <div className="flex w-80 shrink-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={cn('text-label text-text-muted transition-opacity duration-200', open ? 'opacity-100 delay-100' : 'opacity-0')}>Контекст</span>
        <Button variant={open ? 'ghost' : 'secondary'} size="icon-sm" aria-label={open ? 'Скрыть контекстную панель' : 'Показать контекстную панель'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <PanelRightClose className={cn('transition-transform duration-300', !open && 'rotate-180')} />
        </Button>
      </div>
      <div
        inert={!open}
        className={cn('flex flex-col gap-4 transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none', open ? 'translate-x-0 opacity-100 delay-75' : 'pointer-events-none translate-x-6 opacity-0')}
      >
      {next && (
        <div className="rounded-lg border border-accent/35 bg-accent-subtle p-4">
          <span className="flex items-center gap-2 text-label text-accent-strong">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            Следующее действие
          </span>
          <p className="mt-2 text-body-sm font-medium">{next.title}</p>
          <span className="mt-1 block text-caption text-text-muted">{STAGE_META[next.stageId].titleRu}</span>
        </div>
      )}
      <div className="rounded-lg border border-border bg-surface p-2">
        {STAGE_IDS.map((id, i) => {
          const tab = OBJECT_TABS.find((t) => t.stageId === id)!;
          const st = session.stages[id];
          return (
            <Link key={id} to={ROUTES.objectSection(objectId, tab.section)} className="group flex items-center gap-3 rounded-sm px-3 py-2.5 hover:bg-surface-hover">
              <StatusDot status={st.status} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-sm font-medium">
                  {i + 1}. {STAGE_META[id].titleRu}
                </span>
                <span className={cn('text-caption', st.status === 'BLOCKED' ? 'font-medium text-status-blocked' : 'text-text-muted')}>{STAGE_STATUS_LABEL[st.status]}</span>
              </span>
              <ArrowRight className="size-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </Link>
          );
        })}
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-body-sm font-medium">Последние события</span>
          <Link to={ROUTES.objectSection(objectId, 'audit')} className="text-caption font-medium text-accent-strong hover:underline">
            Весь журнал
          </Link>
        </div>
        <AuditTimeline events={audit} limit={4} />
      </div>
      </div>
      </div>
    </aside>
  );
}
