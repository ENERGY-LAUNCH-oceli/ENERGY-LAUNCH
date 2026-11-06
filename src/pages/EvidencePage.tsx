import * as React from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { CheckStatusLabel } from '@/components/launch';
import type { CheckStatus } from '@/config/labels';
import { evidenceRecords, type EvidenceKind, type EvidenceState } from '@/engine';
import { Filter, InputRefs, STAGE_SHORT, Stat, TD, TH, utc } from '@/features/trail/shared';
import { usePortfolioWorkspaces } from '@/hooks/use-portfolio-workspaces';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';
import { cn } from '@/utils/cn';

const KIND: Record<EvidenceKind, string> = { CHECK: 'Проверка', ARTIFACT: 'Материал', CONFIRMATION: 'Подтверждение', COMMAND: 'Тест управления', ACCEPTANCE: 'Приёмка панели' };
const STATE: Record<EvidenceState, { label: string; cls: string }> = {
  CURRENT: { label: 'Актуально', cls: 'text-status-completed' },
  SUPERSEDED: { label: 'Заменено', cls: 'text-text-muted' },
  STALE: { label: 'Устарело', cls: 'text-warning' },
};
const CHECK_STATUSES = new Set(['PASSED', 'FAILED', 'WARNING', 'SKIPPED', 'NOT_APPLICABLE']);

/** Центр подтверждений: каждая проверка каждого прогона, материалы, подтверждения, тесты, приёмки. */
export function EvidencePage() {
  const ws = usePortfolioWorkspaces();
  const ruleset = useLaunchStore((s) => s.ruleset);
  const [f, setF] = React.useState({ object: 'ALL', stage: 'ALL', kind: 'ALL', state: 'CURRENT' });
  const [limit, setLimit] = React.useState(200);
  const all = React.useMemo(() => ws.flatMap((w) => evidenceRecords(w.session, w.inputs, ruleset).map((e) => ({ ...e, objectName: w.entry.name }))), [ws, ruleset]);
  const rows = all.filter((e) => (f.object === 'ALL' || e.objectId === f.object) && (f.stage === 'ALL' || e.stageId === f.stage) && (f.kind === 'ALL' || e.kind === f.kind) && (f.state === 'ALL' || e.state === f.state));
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const checks = all.filter((e) => e.kind === 'CHECK');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1">Центр подтверждений</h1>
        <p className="max-w-3xl text-body text-text-muted">Каждый результат проверки с источником, ссылкой на неизменяемую версию входов, параметрами правила, временем и автором. Предыдущие результаты не удаляются.</p>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
        <Stat label="Результатов проверок" value={checks.length} />
        <Stat label="Актуальных" value={checks.filter((e) => e.state === 'CURRENT').length} tone="ok" />
        <Stat label="Устаревших" value={all.filter((e) => e.state === 'STALE').length} tone={all.some((e) => e.state === 'STALE') ? 'warn' : undefined} />
        <Stat label="В истории (заменено)" value={checks.filter((e) => e.state === 'SUPERSEDED').length} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Filter label="Объект" value={f.object} onChange={set('object')} options={[{ value: 'ALL', label: 'Все объекты' }, ...ws.map((w) => ({ value: w.entry.id, label: w.entry.name }))]} />
        <Filter label="Этап" value={f.stage} onChange={set('stage')} options={[{ value: 'ALL', label: 'Все этапы' }, ...STAGE_IDS.map((id) => ({ value: id, label: STAGE_SHORT[id] }))]} />
        <Filter label="Тип" value={f.kind} onChange={set('kind')} options={[{ value: 'ALL', label: 'Все типы' }, ...Object.entries(KIND).map(([value, label]) => ({ value, label }))]} />
        <Filter label="Актуальность" value={f.state} onChange={set('state')} options={[{ value: 'ALL', label: 'Все' }, ...Object.entries(STATE).map(([value, s]) => ({ value, label: s.label }))]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState compact title="Подтверждений нет" description="По выбранным фильтрам записей не найдено." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[1680px] text-body-sm" data-testid="evidence-table">
            <thead className="border-b border-border">
              <tr>
                {['evidence_id', 'Объект', 'Этап', 'Проверка', 'Источник', 'Входные данные (версия)', 'Результат', 'Время', 'Правило', 'Параметры', 'Автор / процесс', 'Актуальность'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((e) => (
                <tr key={`${e.objectId}-${e.id}`} className="border-b border-border last:border-0" data-evidence-state={e.state}>
                  <td className={cn(TD, 'font-mono text-[11px] text-text-muted')}>{e.id.length > 18 ? `…${e.id.slice(-16)}` : e.id}</td>
                  <td className={TD}>{e.objectName}</td>
                  <td className={cn(TD, 'whitespace-nowrap')}>{STAGE_SHORT[e.stageId]}</td>
                  <td className={cn(TD, 'min-w-[240px] max-w-[300px]')}>
                    <span className="text-caption text-text-muted">{KIND[e.kind]}</span>
                    <span className="block">{e.check}</span>
                    <span className="line-clamp-2 block text-caption text-text-secondary">{e.message}</span>
                  </td>
                  <td className={cn(TD, 'max-w-[180px] font-mono text-[11px]')}>{e.source}</td>
                  <td className={cn(TD, 'max-w-[220px]')}>
                    <InputRefs refs={e.inputs} />
                  </td>
                  <td className={cn(TD, 'whitespace-nowrap')}>{CHECK_STATUSES.has(e.result) ? <CheckStatusLabel status={e.result as CheckStatus} /> : <span className="text-caption font-medium">{e.result}</span>}</td>
                  <td className={cn(TD, 'whitespace-nowrap font-mono text-caption')}>{utc(e.at)}</td>
                  <td className={cn(TD, 'whitespace-nowrap font-mono text-caption')}>v{e.rulesetVersion}</td>
                  <td className={cn(TD, 'max-w-[220px] break-all font-mono text-[11px] text-text-secondary')}>
                    {Object.entries(e.params).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ') || '–'}
                  </td>
                  <td className={cn(TD, 'max-w-[180px] text-caption')}>{e.author}</td>
                  <td className={cn(TD, 'max-w-[200px] text-caption')}>
                    <span className={cn('font-medium', STATE[e.state].cls)}>{STATE[e.state].label}</span>
                    {e.stateReason && <span className="block text-text-muted">{e.stateReason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + 200)} className="w-full border-t border-border py-3 text-body-sm text-accent-strong hover:bg-surface-hover">
              Показать ещё ({rows.length - limit})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
