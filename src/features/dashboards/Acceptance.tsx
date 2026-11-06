import { CheckCheck, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { BLOCK_CATALOG, blockProblems, can, currentAcceptance, evaluateBlocks, ROLE_TITLE } from '@/engine';
import { useLaunchStore } from '@/store';
import { DASHBOARD_BLOCK_IDS, type DashboardBlockId, type DashboardConfigRules, type DashboardWorkspace, type LaunchInputs } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import type { DashboardData } from './data';
import { DashboardView } from './DashboardView';

/** Приёмка: ответственный просматривает четыре блока опубликованной версии и подтверждает корректность каждого. */
export function Acceptance({ ws, inputs, rules, data, locked }: { ws: DashboardWorkspace; inputs: LaunchInputs; rules: DashboardConfigRules; data: DashboardData; locked: string | null }) {
  const role = useLaunchStore((s) => s.role);
  const review = useLaunchStore((s) => s.reviewDashboard);
  const pub = ws.published;
  const [marks, setMarks] = React.useState<Partial<Record<DashboardBlockId, boolean>>>({});
  const [comments, setComments] = React.useState<Partial<Record<DashboardBlockId, string>>>({});
  const [comment, setComment] = React.useState('');
  const acc = currentAcceptance(ws, data.objectId);

  if (!pub) {
    return <p className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-body-sm text-text-muted">Нет опубликованной версии. Инженер запуска настраивает панель в конструкторе и публикует её – затем ответственный выполняет приёмку.</p>;
  }
  const evaluation = evaluateBlocks(pub, inputs, rules);
  const reason = locked ?? (can(role, 'dashboard.accept') ? null : `Приёмку выполняет ответственный за приёмку; ваша роль – ${ROLE_TITLE[role]}`);
  const allMarked = DASHBOARD_BLOCK_IDS.every((id) => marks[id] !== undefined);
  const allCorrect = DASHBOARD_BLOCK_IDS.every((id) => marks[id] === true);
  const submit = (result: 'ACCEPTED' | 'REJECTED') => {
    const ok = review({ result, blocks: DASHBOARD_BLOCK_IDS.map((blockId) => ({ blockId, correct: !!marks[blockId], ...(comments[blockId]?.trim() ? { comment: comments[blockId]!.trim() } : {}) })), ...(comment.trim() ? { comment } : {}) });
    if (ok) {
      setMarks({});
      setComments({});
      setComment('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-5 py-3">
        <span className="text-body-sm font-medium">
          Версия v{pub.version} · опубликовал {pub.publishedBy} · {formatDateTime(pub.publishedAt!)} · <span className="font-mono text-caption">object_id {pub.objectId}</span>
        </span>
        <span className={cn('text-caption', acc?.result === 'ACCEPTED' ? 'text-status-completed' : acc?.result === 'REJECTED' ? 'text-status-blocked' : 'text-text-muted')}>
          {acc ? `${acc.result === 'ACCEPTED' ? 'Принята' : 'Отклонена'}: ${acc.author}, ${formatDateTime(acc.at)}` : 'Ожидает приёмки'}
        </span>
      </div>

      <section aria-label="Решение по блокам" className="grid gap-3 md:grid-cols-2" data-testid="acceptance-review">
        {pub.blocks.map((b, i) => {
          const ev = evaluation[b.id];
          const problems = blockProblems(ev);
          const mark = marks[b.id];
          return (
            <div key={b.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4" data-review-block={b.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-body-sm font-medium">
                  <span className="font-mono text-caption text-text-muted">0{i + 1}</span> {BLOCK_CATALOG[b.id].title}
                </span>
                <span className={cn('text-caption', ev.ok ? 'text-status-completed' : 'text-status-blocked')}>автопроверка: {ev.ok ? 'корректен' : 'есть замечания'}</span>
              </div>
              {problems.length > 0 && <p className="text-caption text-error">{problems.join('; ')}</p>}
              <div className="flex gap-1.5" role="radiogroup" aria-label={`Блок «${BLOCK_CATALOG[b.id].title}»`}>
                {[
                  { v: true, label: 'Корректен' },
                  { v: false, label: 'Некорректен' },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    type="button"
                    role="radio"
                    aria-checked={mark === o.v}
                    disabled={!!reason || (o.v && !ev.ok)}
                    title={o.v && !ev.ok ? 'Блок не проходит автопроверку – подтвердить корректность нельзя' : undefined}
                    onClick={() => setMarks((m) => ({ ...m, [b.id]: o.v }))}
                    className={cn(
                      'h-8 flex-1 rounded-sm border text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      mark === o.v ? (o.v ? 'border-status-completed-solid bg-success-subtle text-success' : 'border-status-blocked-solid bg-error-subtle text-error') : 'border-border text-text-secondary hover:border-border-strong',
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {mark === false && <Textarea aria-label={`Замечание к блоку «${BLOCK_CATALOG[b.id].title}»`} className="min-h-16" placeholder="Что некорректно" value={comments[b.id] ?? ''} onChange={(e) => setComments((c) => ({ ...c, [b.id]: e.target.value }))} />}
            </div>
          );
        })}
      </section>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <Textarea aria-label="Комментарий к приёмке" placeholder="Комментарий (обязателен при отказе без замечаний к блокам)" className="min-h-16" value={comment} onChange={(e) => setComment(e.target.value)} disabled={!!reason} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="accent" disabled={!!reason || !allCorrect} onClick={() => submit('ACCEPTED')}>
            <CheckCheck aria-hidden />
            Принять панель v{pub.version}
          </Button>
          <Button variant="danger" disabled={!!reason || !allMarked || allCorrect} onClick={() => submit('REJECTED')}>
            <X aria-hidden />
            Отклонить
          </Button>
          <span className="text-caption text-text-muted">{reason ?? (allMarked ? (allCorrect ? 'Все блоки отмечены корректными' : 'Есть некорректные блоки – этап останется заблокированным') : 'Отметьте каждый из четырёх блоков')}</span>
        </div>
      </div>

      <section aria-label="История приёмок" className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-3 text-h3">История приёмок</h3>
        {!ws.acceptances.length ? (
          <p className="text-body-sm text-text-muted">Приёмок ещё не было.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-body-sm" data-testid="acceptance-history">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                  <th className="py-2 pr-3 font-normal">Время</th>
                  <th className="px-3 font-normal">Автор · роль</th>
                  <th className="px-3 font-normal">Версия</th>
                  <th className="px-3 font-normal">object_id</th>
                  <th className="pl-3 font-normal">Результат</th>
                </tr>
              </thead>
              <tbody>
                {[...ws.acceptances].reverse().map((a) => (
                  <tr key={a.id} className="border-b border-border align-top last:border-0">
                    <td className="py-2 pr-3 font-mono text-caption">{formatDateTime(a.at)}</td>
                    <td className="px-3">
                      {a.author} <span className="text-caption text-text-muted">· {ROLE_TITLE[a.role]}</span>
                    </td>
                    <td className="px-3 font-mono text-caption">
                      v{a.configVersion}
                      {pub.version !== a.configVersion && <span className="block text-warning">не текущая</span>}
                    </td>
                    <td className="px-3 font-mono text-caption">{a.objectId}</td>
                    <td className={cn('pl-3 text-caption font-medium', a.result === 'ACCEPTED' ? 'text-status-completed' : 'text-status-blocked')}>
                      {a.result === 'ACCEPTED' ? 'Принята' : 'Отклонена'}
                      {a.result === 'REJECTED' && <span className="block font-normal text-text-secondary">{[...a.blocks.filter((b) => !b.correct).map((b) => `${BLOCK_CATALOG[b.blockId].title}${b.comment ? `: ${b.comment}` : ''}`), a.comment].filter(Boolean).join('; ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <span className="text-label text-text-muted">Опубликованная версия v{pub.version}</span>
        <DashboardView config={pub} data={data} evaluation={evaluation} />
      </div>
    </div>
  );
}
