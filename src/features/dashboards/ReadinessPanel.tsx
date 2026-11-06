import { BadgeCheck, Check, Lock } from 'lucide-react';
import type { ObjectReadiness } from '@/engine';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';

/** Итоговый статус объекта: «готов к эксплуатации» только при выполнении всех пяти условий. */
export function ReadinessPanel({ readiness, objectName, objectId }: { readiness: ObjectReadiness; objectName: string; objectId: string }) {
  const { ready, conditions } = readiness;
  return (
    <section
      aria-label="Итоговый статус объекта"
      data-testid="object-readiness"
      data-ready={ready}
      className={cn('flex flex-col gap-4 rounded-lg border p-5 lg:flex-row lg:items-center lg:justify-between', ready ? 'border-success-border bg-success-subtle' : 'border-border bg-surface')}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', ready ? 'bg-status-completed-solid text-surface' : 'bg-surface-sunken text-text-muted')}>
          {ready ? <BadgeCheck className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className={cn('text-h2', ready && 'text-success')}>{ready ? 'Объект готов к эксплуатации' : 'Готовность не присвоена'}</h2>
          <p className="text-body-sm text-text-secondary">
            {objectName} · <span className="font-mono text-caption">{objectId}</span>
            {ready && readiness.acceptedBy && ` · панель v${readiness.configVersion} принята: ${readiness.acceptedBy}, ${formatDateTime(readiness.acceptedAt!)}`}
          </p>
        </div>
      </div>
      <ul className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:min-w-[520px]">
        {conditions.map((c) => (
          <li key={c.id} className={cn('flex items-center gap-2 text-caption', c.met ? 'text-text-secondary' : 'text-text-muted')} data-condition={c.id} data-met={c.met}>
            <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full', c.met ? 'bg-status-completed-solid text-surface' : 'border border-border-strong')}>{c.met && <Check className="size-3" strokeWidth={3} aria-hidden />}</span>
            {c.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
