import * as React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META } from '@/config/stages';
import { AUDIT_CATEGORIES, AUDIT_CATEGORY_TITLE, auditRecords, stateAt, type AuditRecord } from '@/engine';
import { STAGE_IDS, type AuditEvent, type ValidationSnapshot } from '@/types';
import { cn } from '@/utils/cn';
import { Filter, TD, TH, utc } from './shared';

const RESULT: Record<AuditRecord['result'], string> = { OK: 'text-text-secondary', PASSED: 'text-status-completed', FAILED: 'text-status-blocked', REJECTED: 'text-status-blocked', DENIED: 'text-warning', INFO: 'text-text-muted' };

export interface AuditSource {
  objectId: string;
  objectName: string;
  events: AuditEvent[];
  history: ValidationSnapshot[];
}

/** Состояние объекта на момент выбранной записи – воспроизведение по журналу и снимкам. */
function Replay({ source, at }: { source: AuditSource; at: string }) {
  const st = stateAt(source.events, source.history, source.objectId, at);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-accent/35 bg-accent-subtle p-4" data-testid="audit-replay">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3">
          Состояние «{source.objectName}» на {utc(at)} UTC
        </h2>
        <span className="text-caption text-text-muted">{st.sessionCompleted ? 'Сессия завершена' : 'Запуск в процессе'}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {STAGE_IDS.map((id) => (
          <div key={id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2" data-replay-stage={id} data-status={st.statuses[id]}>
            <span className="truncate text-body-sm">{STAGE_META[id].titleRu}</span>
            <StatusBadge status={st.statuses[id]} size="sm" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 text-caption md:grid-cols-2">
        <div>
          <span className="text-label text-text-muted">Почему – последние прогоны до этого момента</span>
          <ul className="mt-1 flex flex-col gap-1">
            {st.lastRuns.length === 0 && <li className="text-text-muted">Проверки ещё не запускались</li>}
            {st.lastRuns.map((r) => (
              <li key={r.stageId}>
                <span className="font-medium">{STAGE_META[r.stageId].titleRu}</span> · {utc(r.at)} · правила v{r.rulesetVersion} · {r.trigger === 'RECHECK' ? 'повторная' : r.trigger === 'SEED' ? 'при загрузке' : 'ручная'}
                <span className={cn('block font-mono text-[11px]', r.failed.length ? 'text-status-blocked' : 'text-status-completed')}>{r.failed.length ? `не пройдены: ${r.failed.join(', ')}` : 'обязательные правила пройдены'}</span>
                <span className="block font-mono text-[11px] text-text-muted">{r.inputs.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-label text-text-muted">Открытые препятствия в этот момент</span>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[11px]">
            {st.openBlockers.length === 0 && <li className="text-text-muted">нет</li>}
            {st.openBlockers.map((b, i) => (
              <li key={i} className="text-status-blocked">
                {b.rule} · с {utc(b.since)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Журнал аудита: полный формат записей, фильтры и воспроизведение статуса на момент записи. */
export function AuditTrail({ sources, fixedObject }: { sources: AuditSource[]; fixedObject?: string }) {
  const [f, setF] = React.useState({ object: fixedObject ?? 'ALL', category: 'ALL' });
  const [selected, setSelected] = React.useState<AuditRecord | null>(null);
  const [limit, setLimit] = React.useState(150);
  const records = React.useMemo(
    () =>
      sources
        .flatMap((s) => auditRecords(s.events, s.history))
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0)),
    [sources],
  );
  const rows = records.filter((r) => (f.object === 'ALL' || r.objectId === f.object) && (f.category === 'ALL' || r.category === f.category));
  const source = selected ? sources.find((s) => s.objectId === selected.objectId) : undefined;
  const name = (id: string) => sources.find((s) => s.objectId === id)?.objectName ?? id;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {!fixedObject && <Filter label="Объект" value={f.object} onChange={(v) => setF((s) => ({ ...s, object: v }))} options={[{ value: 'ALL', label: 'Все объекты' }, ...sources.map((s) => ({ value: s.objectId, label: s.objectName }))]} />}
        <Filter label="Действие" value={f.category} onChange={(v) => setF((s) => ({ ...s, category: v }))} options={[{ value: 'ALL', label: 'Все действия' }, ...AUDIT_CATEGORIES.map((c) => ({ value: c, label: AUDIT_CATEGORY_TITLE[c] }))]} />
      </div>
      <p className="text-caption text-text-muted">Выберите запись – ниже появится состояние объекта на этот момент и причины статусов (по сохранённым входам и версии правил).</p>
      {selected && source && <Replay source={source} at={selected.timestamp} />}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[1280px] text-body-sm" data-testid="audit-table">
          <thead className="border-b border-border">
            <tr>
              {['event_id', 'timestamp (UTC)', 'actor', 'object_id', 'action', 'entity', 'previous_value', 'new_value', 'result', 'rule_version'].map((h) => (
                <th key={h} className={TH}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={`${r.objectId}-${r.eventId}`} onClick={() => setSelected(r)} aria-selected={selected?.eventId === r.eventId} className={cn('cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover', selected?.eventId === r.eventId && 'bg-accent-subtle hover:bg-accent-subtle')} data-audit-action={r.action}>
                <td className={cn(TD, 'font-mono text-[11px] text-text-muted')}>{r.eventId.length > 18 ? `…${r.eventId.slice(-16)}` : r.eventId}</td>
                <td className={cn(TD, 'whitespace-nowrap font-mono text-caption')}>{r.timestamp.slice(0, 19).replace('T', ' ')}</td>
                <td className={cn(TD, 'max-w-[150px] text-caption')}>{r.actor}</td>
                <td className={cn(TD, 'whitespace-nowrap font-mono text-caption')} title={name(r.objectId)}>{r.objectId}</td>
                <td className={cn(TD, 'whitespace-nowrap')}>
                  <span className="text-caption text-text-muted">{AUDIT_CATEGORY_TITLE[r.category]}</span>
                  <span className="block font-mono text-[11px]">{r.action}</span>
                </td>
                <td className={cn(TD, 'max-w-[260px] text-caption')}>{r.entity}</td>
                <td className={cn(TD, 'max-w-[140px] font-mono text-[11px] text-text-muted')}>{r.previousValue ?? '–'}</td>
                <td className={cn(TD, 'max-w-[200px] font-mono text-[11px]')}>{r.newValue ?? '–'}</td>
                <td className={cn(TD, 'whitespace-nowrap font-mono text-caption', RESULT[r.result])}>{r.result}</td>
                <td className={cn(TD, 'whitespace-nowrap font-mono text-caption')}>v{r.ruleVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + 150)} className="w-full border-t border-border py-3 text-body-sm text-accent-strong hover:bg-surface-hover">
            Показать ещё ({rows.length - limit})
          </button>
        )}
      </div>
    </div>
  );
}
