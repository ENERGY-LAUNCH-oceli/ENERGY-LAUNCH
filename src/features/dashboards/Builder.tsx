import { ArrowDown, ArrowUp, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { BLOCK_CATALOG, can, evaluateBlocks, hasUnpublishedChanges } from '@/engine';
import { useLaunchStore } from '@/store';
import type { DashboardConfigRules, DashboardWorkspace, LaunchInputs } from '@/types';
import { cn } from '@/utils/cn';
import type { DashboardData } from './data';
import { DashboardView } from './DashboardView';

/** Dashboard Builder: виджеты, порядок блоков, показатели, период, фильтры и предпросмотр. */
export function Builder({ ws, inputs, rules, data, locked }: { ws: DashboardWorkspace; inputs: LaunchInputs; rules: DashboardConfigRules; data: DashboardData; locked: string | null }) {
  const role = useLaunchStore((s) => s.role);
  const update = useLaunchStore((s) => s.updateDashboard);
  const publish = useLaunchStore((s) => s.publishDashboard);
  const draft = ws.draft;
  const evaluation = evaluateBlocks(draft, inputs, rules);
  const types = new Set(inputs.passport?.assets.map((a) => a.type) ?? []);
  const editReason = locked ?? (can(role, 'dashboard.edit') ? null : 'Ваша роль может только просматривать конфигурацию');
  const publishReason = locked ?? (can(role, 'dashboard.publish') ? null : 'Публикует инженер запуска');
  const dirty = hasUnpublishedChanges(ws);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-5 py-3">
        <div className="flex flex-col">
          <span className="text-body-sm font-medium">
            Черновик v{draft.version} · <span className="font-mono text-caption text-text-muted">object_id {draft.objectId}</span>
          </span>
          <span className="text-caption text-text-muted">
            {ws.published ? `Опубликована v${ws.published.version}` : 'Ещё не опубликована'} · {dirty ? 'есть неопубликованные изменения' : 'изменений нет'} · изменено {draft.updatedBy}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" disabled={!!editReason} onClick={() => update({ kind: 'reset' })}>
            <RotateCcw aria-hidden />
            По умолчанию
          </Button>
          <Button variant="accent" size="sm" disabled={!!publishReason || !dirty} title={publishReason ?? undefined} onClick={() => publish()}>
            <Upload aria-hidden />
            Опубликовать v{draft.version}
          </Button>
        </div>
      </div>
      {editReason && <p className="text-caption text-text-muted">{editReason}. Права проверяются и в логике приложения: изменение будет отклонено.</p>}

      <div className="grid items-start gap-4 2xl:grid-cols-[400px_minmax(0,1fr)]">
        <ol className="flex flex-col gap-3" aria-label="Блоки панели">
          {draft.blocks.map((b, i) => {
            const def = BLOCK_CATALOG[b.id];
            const ev = evaluation[b.id];
            const required = new Set(rules.requiredWidgets[b.id]);
            return (
              <li key={b.id} className={cn('rounded-lg border bg-surface', ev.ok ? 'border-border' : 'border-error-border')} data-builder-block={b.id}>
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] text-text-muted">0{i + 1}</span> <span className="text-body-sm font-medium">{def.title}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={cn('mr-1 text-caption', ev.ok ? 'text-status-completed' : 'text-status-blocked')}>{ev.ok ? 'корректен' : 'некорректен'}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Поднять блок «${def.title}»`} disabled={!!editReason || i === 0} onClick={() => update({ kind: 'moveBlock', blockId: b.id, direction: -1 })}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Опустить блок «${def.title}»`} disabled={!!editReason || i === draft.blocks.length - 1} onClick={() => update({ kind: 'moveBlock', blockId: b.id, direction: 1 })}>
                      <ArrowDown />
                    </Button>
                  </span>
                </div>
                <div className="flex flex-col gap-3 px-4 py-3">
                  <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-label text-text-muted">Виджеты</legend>
                    {def.widgets.map((w) => {
                      const na = w.requiresAsset && !types.has(w.requiresAsset);
                      return (
                        <label key={w.id} className="flex cursor-pointer items-start gap-2 text-body-sm has-[:disabled]:cursor-not-allowed">
                          <input
                            type="checkbox"
                            className="mt-1 accent-[rgb(var(--el-accent))]"
                            checked={!!b.widgets[w.id]}
                            disabled={!!editReason}
                            onChange={(e) => update({ kind: 'toggleWidget', blockId: b.id, widgetId: w.id, enabled: e.target.checked })}
                            data-widget={`${b.id}.${w.id}`}
                          />
                          <span className="flex min-w-0 flex-col">
                            <span>
                              {w.label}{' '}
                              <span className={cn('text-[11px]', required.has(w.id) ? 'text-accent-strong' : 'text-text-muted')}>{required.has(w.id) ? (na ? 'обязательный · н/п' : 'обязательный') : 'дополнительно'}</span>
                            </span>
                            <span className="text-caption text-text-muted">{w.hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                  <div className="flex flex-col gap-1">
                    <span className="text-label text-text-muted">Показатели</span>
                    <div className="flex flex-wrap gap-1.5">
                      {def.metrics.map((m) => {
                        const on = b.metrics.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={on}
                            disabled={!!editReason || (on && b.metrics.length === 1)}
                            title={on && b.metrics.length === 1 ? 'Нужен хотя бы один показатель' : undefined}
                            onClick={() => update({ kind: 'setMetrics', blockId: b.id, metrics: on ? b.metrics.filter((x) => x !== m.id) : [...b.metrics, m.id] })}
                            className={cn('h-7 rounded-sm border px-2.5 text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-60', on ? 'border-accent bg-accent-subtle text-accent-strong' : 'border-border text-text-secondary hover:border-border-strong')}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-label text-text-muted">Период</span>
                      <Select aria-label={`Период блока «${def.title}»`} value={b.period} disabled={!!editReason || def.periods.length < 2} onValueChange={(v) => update({ kind: 'setPeriod', blockId: b.id, period: v })} options={def.periods.map((p) => ({ value: p.id, label: p.label }))} className="h-8" />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-label text-text-muted">Фильтр</span>
                      <Select aria-label={`Фильтр блока «${def.title}»`} value={b.filter} disabled={!!editReason} onValueChange={(v) => update({ kind: 'setFilter', blockId: b.id, filter: v })} options={def.filters.map((p) => ({ value: p.id, label: p.label }))} className="h-8" />
                    </label>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-label text-text-muted">Предпросмотр черновика v{draft.version}</span>
          <DashboardView config={draft} data={data} evaluation={evaluation} />
        </div>
      </div>
    </div>
  );
}
