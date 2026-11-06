import { Check, OctagonAlert } from 'lucide-react';
import { STAGE_META, STAGE_STATUS_LABEL } from '@/config/stages';
import { STAGE_IDS, type LaunchSession, type StageId } from '@/types';
import { cn } from '@/utils/cn';
import { stageStats } from './model';

const TONE = {
  NOT_STARTED: { marker: 'border-border-strong bg-surface text-text-muted', bar: 'bg-surface-sunken', text: 'text-text-muted' },
  IN_PROGRESS: { marker: 'border-status-in-progress-solid bg-status-in-progress-bg text-status-in-progress', bar: 'bg-status-in-progress-solid', text: 'text-status-in-progress' },
  BLOCKED: { marker: 'border-status-blocked-solid bg-status-blocked-bg text-status-blocked', bar: 'bg-status-blocked-solid', text: 'text-status-blocked' },
  COMPLETED: { marker: 'border-status-completed-solid bg-status-completed-solid text-white', bar: 'bg-status-completed-solid', text: 'text-status-completed' },
} as const;

/** Выразительный горизонтальный степпер: четыре этапа, статус, доля пройденных проверок; клик открывает этап. */
export function LaunchStepper({ session, selected, onSelect }: { session: LaunchSession; selected: StageId; onSelect: (id: StageId) => void }) {
  return (
    <nav aria-label="Этапы запуска" className="rounded-lg border border-border bg-surface p-2">
      <ol className="grid gap-2 md:grid-cols-4">
        {STAGE_IDS.map((id, i) => {
          const st = session.stages[id].status;
          const t = TONE[st];
          const stats = stageStats(session, id);
          const active = id === selected;
          return (
            <li key={id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={active ? 'step' : undefined}
                data-testid={`step-${id}`}
                className={cn('group flex w-full flex-col gap-3 rounded-md p-4 text-left transition-colors', active ? 'bg-surface-secondary ring-1 ring-accent/40' : 'hover:bg-surface-secondary/70')}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('tabular flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-body font-extrabold', t.marker)}>
                    {st === 'COMPLETED' ? <Check className="size-5" strokeWidth={3} /> : st === 'BLOCKED' ? <OctagonAlert className="size-5" /> : `0${i + 1}`}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm font-bold">{STAGE_META[id].titleRu}</span>
                    <span className={cn('text-caption font-bold', t.text)}>{STAGE_STATUS_LABEL[st]}</span>
                  </span>
                </div>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-sunken">
                    <span className={cn('block h-full rounded-pill', t.bar)} style={{ width: `${st === 'NOT_STARTED' ? 0 : stats.percent}%` }} />
                  </span>
                  <span className="tabular text-caption font-semibold text-text-secondary">
                    {stats.passed}/{stats.applicable}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
