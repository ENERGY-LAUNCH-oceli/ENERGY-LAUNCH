import type { ControlTestCommand } from '@/types';
import { cn } from '@/utils/cn';
import { CommandStateBadge } from './CommandStateBadge';
import { kw, secBetween, utcTime } from './labels';

/**
 * Временная шкала команд: по строке на команду. Шкала 0…наблюдение (с): отправка, приём,
 * интервал ожидания отклика, изменение фактической мощности и результат.
 */
export function CommandTimeline({ commands, selectedId, onSelect, observationSec }: { commands: ControlTestCommand[]; selectedId: string | undefined; onSelect: (id: string) => void; observationSec: number }) {
  const pct = (sec: number) => `${Math.max(0, Math.min(100, (sec / observationSec) * 100))}%`;
  return (
    <section id="timeline" aria-labelledby="timeline-title" className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="timeline-title" className="text-h3">
          Временная шкала команд
        </h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-info" />Отправка</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-2 rotate-45 bg-info" />Приём</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-4 rounded-xs bg-info/15" />Интервал ожидания</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-0.5 bg-status-completed-solid" />Отклик мощности</span>
        </div>
      </header>
      {!commands.length ? (
        <p className="px-5 py-5 text-body-sm text-text-secondary">Команд ещё нет.</p>
      ) : (
        <ol data-testid="command-timeline">
          {[...commands].reverse().map((c) => {
            const ack = secBetween(c.sentAt, c.receivedAt);
            const resp = secBetween(c.sentAt, c.respondedAt);
            const end = ack !== null ? ack + c.expected.responseWindowSec : c.expected.ackTimeoutSec;
            const selected = c.commandId === selectedId;
            return (
              <li key={c.commandId} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(c.commandId)}
                  aria-pressed={selected}
                  data-timeline-command={c.commandId}
                  className={cn('grid w-full gap-x-5 gap-y-2 px-5 py-3 text-left transition-colors hover:bg-surface-hover md:grid-cols-[minmax(170px,0.9fr)_minmax(0,2.2fr)_110px] md:items-center', selected && 'bg-accent-subtle hover:bg-accent-subtle')}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-caption font-medium">{c.commandId}</span>
                    <span className="truncate text-caption text-text-muted">
                      {c.assetId} · {kw(c.input.valueKw, 0)} · {utcTime(c.createdAt).slice(11)}
                    </span>
                  </span>
                  <span className="relative block h-6" aria-label={`Отправка 0 с, приём ${ack ?? 'нет'} с, отклик ${resp ?? 'нет'} с`}>
                    <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    {c.sentAt ? (
                      <>
                        <span className="absolute top-1/2 h-3 -translate-y-1/2 rounded-xs bg-info/15" style={{ left: pct(ack ?? 0), width: `calc(${pct(end)} - ${pct(ack ?? 0)})` }} />
                        <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-info" style={{ left: pct(0) }} />
                        {ack !== null && <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-info" style={{ left: pct(ack) }} />}
                        {resp !== null && <span className={cn('absolute top-0.5 h-5 w-0.5 -translate-x-1/2', c.state === 'PASSED' ? 'bg-status-completed-solid' : 'bg-warning')} style={{ left: pct(resp) }} />}
                        <span className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface', c.state === 'PASSED' ? 'bg-status-completed-solid' : c.state === 'TIMEOUT' ? 'bg-warning' : 'bg-status-blocked-solid')} style={{ left: pct(Math.min(c.state === 'PASSED' ? (resp ?? end) : end, observationSec)) }} />
                      </>
                    ) : (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 bg-surface pr-2 text-caption text-text-muted">не отправлена – значение отклонено</span>
                    )}
                  </span>
                  <CommandStateBadge state={c.state} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {commands.length > 0 && (
        <div className="flex justify-between border-t border-border px-5 py-2 font-mono text-[11px] text-text-muted">
          <span>0 с – отправка</span>
          <span>{observationSec} с</span>
        </div>
      )}
    </section>
  );
}
