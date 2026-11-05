import { CircleCheck, Info, OctagonAlert, TriangleAlert, X } from 'lucide-react';
import * as React from 'react';
import { useNotifications, type AppNotification } from '@/store';
import { cn } from '@/utils/cn';

const ICON = { info: Info, success: CircleCheck, warning: TriangleAlert, error: OctagonAlert } as const;
const TONE = { info: 'text-info', success: 'text-success', warning: 'text-warning', error: 'text-error' } as const;

function Toast({ n }: { n: AppNotification }) {
  const dismiss = useNotifications((s) => s.dismissToast);
  React.useEffect(() => {
    const t = setTimeout(() => dismiss(n.id), 5000);
    return () => clearTimeout(t);
  }, [dismiss, n.id]);
  const Icon = ICON[n.tone];
  return (
    <div role="status" className="pointer-events-auto flex w-80 gap-3 rounded-md border border-border bg-surface p-4 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2">
      <Icon className={cn('mt-0.5 size-[18px] shrink-0', TONE[n.tone])} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-sm font-semibold">{n.title}</span>
        {n.description && <span className="text-caption text-text-secondary">{n.description}</span>}
      </div>
      <button type="button" onClick={() => dismiss(n.id)} aria-label="Закрыть" className="self-start text-text-muted hover:text-text-primary">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Всплывающие уведомления в правом нижнем углу; полная история — в колокольчике шапки. */
export function Toaster() {
  const toasts = useNotifications((s) => s.toasts);
  const items = useNotifications((s) => s.items);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((id) => {
        const n = items.find((i) => i.id === id);
        return n ? <Toast key={id} n={n} /> : null;
      })}
    </div>
  );
}
