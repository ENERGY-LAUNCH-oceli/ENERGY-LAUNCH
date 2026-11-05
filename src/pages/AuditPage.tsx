import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { useLaunchStore } from '@/store';
import { formatDateTime } from '@/utils/format';

export function AuditPage() {
  const events = useLaunchStore((s) => s.auditLog);
  return (
    <>
      <PageHeader title="Журнал аудита" description="Все действия и переходы конечного автомата текущей сессии." />
      {events.length === 0 ? (
        <EmptyState title="Событий пока нет" />
      ) : (
        <ol className="divide-y rounded-lg border bg-card text-sm">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex gap-4 px-4 py-2">
              <time className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{formatDateTime(e.timestamp)}</time>
              <span className="w-48 shrink-0 font-medium">{e.action}</span>
              <span className="text-muted-foreground">{e.stageId ?? '—'}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
