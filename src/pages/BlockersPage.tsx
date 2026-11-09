import { ArrowRight } from 'lucide-react';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/dialog';
import { BLOCKER_CATEGORIES, blockerRecord, CATEGORY_TITLE, type BlockerRecord } from '@/engine';
import { Filter, InputRefs, Section, STAGE_SECTION, STAGE_SHORT, Stat, TD, TH, utc } from '@/features/trail/shared';
import { usePortfolioWorkspaces } from '@/hooks/use-portfolio-workspaces';
import { useLaunchStore } from '@/store';
import { STAGE_IDS } from '@/types';
import { cn } from '@/utils/cn';

const SEVERITY: Record<string, { label: string; tone: 'error' | 'warning' | 'neutral' }> = {
  CRITICAL: { label: 'Критично', tone: 'error' },
  WARNING: { label: 'Предупреждение', tone: 'warning' },
  INFO: { label: 'Информация', tone: 'neutral' },
};
const STATUS: Record<string, string> = { OPEN: 'Открыто', RESOLVED: 'Устранено', WAIVED: 'Принято по правилу' };

/** Детальная карточка: что произошло, почему, какие данные, какое правило, как исправить, что перепроверить. */
function BlockerDetail({ r, onClose }: { r: BlockerRecord; onClose: () => void }) {
  const d = r.detail;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title={r.blocker.title} description={`${r.objectName} · ${STAGE_SHORT[r.stageId]} · ${CATEGORY_TITLE[r.category]}`} className="max-w-xl">
      <div className="flex flex-col gap-5" data-testid="blocker-detail">
        <div className="flex flex-wrap gap-2">
          <Badge tone={SEVERITY[r.severity]!.tone}>{SEVERITY[r.severity]!.label}</Badge>
          <Badge>{STATUS[r.status]}</Badge>
          <Badge className="font-mono">{r.blocker.id}</Badge>
        </div>
        <Section title="Что произошло">{d.happened}</Section>
        <Section title="Почему проверка не пройдена">
          {d.why}
          {(d.expected || d.actual) && (
            <span className="mt-1 block font-mono text-caption text-text-secondary">
              ожидалось: {d.expected ?? '–'} · фактически: {d.actual ?? '–'}
            </span>
          )}
        </Section>
        {(r.fields.length > 0 || r.signals.length > 0 || r.interval) && (
          <Section title="Где именно">
            <ul className="flex flex-col gap-0.5 font-mono text-caption">
              {r.fields.length > 0 && <li>поле: {r.fields.join(', ')}</li>}
              {r.signals.length > 0 && <li>сигнал / актив / команда: {r.signals.join(', ')}</li>}
              {r.interval && <li>интервал: {r.interval}</li>}
            </ul>
          </Section>
        )}
        <Section title="Какие данные использовались">
          <InputRefs refs={d.dataUsed} />
        </Section>
        <Section title="Какое правило нарушено">
          {d.rule ? (
            <span className="font-mono text-caption">
              {d.rule.id} · {d.rule.title} · набор правил v{d.rule.version}
              {d.rule.configRef && (
                <span className="block text-text-secondary">
                  {d.rule.configRef} = {JSON.stringify(d.rule.configValue)}
                </span>
              )}
            </span>
          ) : (
            'Ручное препятствие'
          )}
        </Section>
        <Section title="Как исправить">
          <span className="font-medium text-accent-strong">{d.fix}</span>
        </Section>
        <Section title="Какая проверка запускается повторно">{d.recheck}</Section>
        <Link to={ROUTES.objectSection(r.objectId, STAGE_SECTION[r.stageId])} onClick={onClose} className="inline-flex items-center gap-1.5 self-start text-body-sm font-medium text-accent-strong hover:underline">
          Открыть этап «{r.stageTitle}» <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Drawer>
  );
}

/** Центр препятствий: все проблемы объектов портфеля с точным местом и следующим действием. */
export function BlockersPage() {
  const ws = usePortfolioWorkspaces();
  const ruleset = useLaunchStore((s) => s.ruleset);
  const [f, setF] = React.useState({ object: 'ALL', stage: 'ALL', category: 'ALL', severity: 'ALL', status: 'OPEN' });
  const [open, setOpen] = React.useState<BlockerRecord | null>(null);
  const all = React.useMemo(() => ws.flatMap((w) => w.session.blockers.map((b) => blockerRecord(b, w.session, w.inputs, ruleset))).sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1)), [ws, ruleset]);
  const rows = all.filter((r) => (f.object === 'ALL' || r.objectId === f.object) && (f.stage === 'ALL' || r.stageId === f.stage) && (f.category === 'ALL' || r.category === f.category) && (f.severity === 'ALL' || r.severity === f.severity) && (f.status === 'ALL' || r.status === f.status));
  const openAll = all.filter((r) => r.status === 'OPEN');
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1">Центр препятствий</h1>
        <p className="max-w-3xl text-body text-text-muted">Незакрытые проблемы всех объектов: точная причина, место в данных и следующее действие, определённое правилом.</p>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
        <Stat label="Открыто" value={openAll.length} tone={openAll.length ? 'bad' : 'ok'} />
        <Stat label="Критичных" value={openAll.filter((r) => r.severity === 'CRITICAL').length} tone={openAll.some((r) => r.severity === 'CRITICAL') ? 'bad' : undefined} />
        <Stat label="Объектов с препятствиями" value={new Set(openAll.map((r) => r.objectId)).size} />
        <Stat label="Устранено за сессию" value={all.filter((r) => r.status !== 'OPEN').length} tone="ok" />
      </div>

      <div className="flex flex-wrap gap-3" data-testid="blocker-filters">
        <Filter label="Объект" value={f.object} onChange={set('object')} options={[{ value: 'ALL', label: 'Все объекты' }, ...ws.map((w) => ({ value: w.entry.id, label: w.entry.name }))]} />
        <Filter label="Этап" value={f.stage} onChange={set('stage')} options={[{ value: 'ALL', label: 'Все этапы' }, ...STAGE_IDS.map((id) => ({ value: id, label: STAGE_SHORT[id] }))]} />
        <Filter label="Категория" value={f.category} onChange={set('category')} options={[{ value: 'ALL', label: 'Все категории' }, ...BLOCKER_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_TITLE[c] }))]} />
        <Filter label="Критичность" value={f.severity} onChange={set('severity')} options={[{ value: 'ALL', label: 'Любая' }, ...Object.entries(SEVERITY).map(([value, s]) => ({ value, label: s.label }))]} />
        <Filter label="Статус" value={f.status} onChange={set('status')} options={[{ value: 'ALL', label: 'Все статусы' }, ...Object.entries(STATUS).map(([value, label]) => ({ value, label }))]} />
      </div>

      {rows.length === 0 ? (
        <EmptyState compact title="Препятствий нет" description="По выбранным фильтрам незакрытых проблем не найдено." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[1600px] text-body-sm" data-testid="blockers-table">
            <thead className="border-b border-border">
              <tr>
                {['blocker_id', 'Объект', 'Этап', 'Категория', 'Критичность', 'Описание', 'Источник', 'Поле', 'Сигнал / интервал', 'Обнаружено', 'Статус', 'Следующее действие'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.blocker.id} className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-hover" onClick={() => setOpen(r)} data-blocker-row={r.blocker.ruleId ?? r.blocker.id}>
                  <td className={cn(TD, 'font-mono text-[11px] text-text-muted')}>
                    <button type="button" className="text-left hover:text-text-primary hover:underline" onClick={() => setOpen(r)} aria-label={`Открыть препятствие ${r.blocker.title}`}>
                      {r.blocker.id}
                    </button>
                  </td>
                  <td className={TD}>{r.objectName}</td>
                  <td className={cn(TD, 'whitespace-nowrap')}>{STAGE_SHORT[r.stageId]}</td>
                  <td className={cn(TD, 'whitespace-nowrap text-caption')}>{CATEGORY_TITLE[r.category]}</td>
                  <td className={TD}>
                    <Badge size="sm" tone={SEVERITY[r.severity]!.tone}>
                      {SEVERITY[r.severity]!.label}
                    </Badge>
                  </td>
                  <td className={cn(TD, 'max-w-[300px]')}>
                    <span className="font-medium">{r.blocker.title}</span>
                    <span className="line-clamp-2 block text-caption text-text-secondary">{r.description}</span>
                  </td>
                  <td className={cn(TD, 'max-w-[180px] font-mono text-[11px] [overflow-wrap:anywhere]')}>{r.source}</td>
                  <td className={cn(TD, 'max-w-[160px] font-mono text-[11px] [overflow-wrap:anywhere]')}>{r.fields.join(', ') || '–'}</td>
                  <td className={cn(TD, 'max-w-[200px] font-mono text-[11px] [overflow-wrap:anywhere]')}>
                    <span className="line-clamp-3">{[r.signals.slice(0, 4).join(', ') + (r.signals.length > 4 ? '…' : ''), r.interval].filter(Boolean).join(' · ') || '–'}</span>
                  </td>
                  <td className={cn(TD, 'whitespace-nowrap font-mono text-caption')}>{utc(r.detectedAt)}</td>
                  <td className={cn(TD, 'whitespace-nowrap text-caption', r.status === 'OPEN' ? 'text-status-blocked' : 'text-status-completed')}>{STATUS[r.status]}</td>
                  <td className={cn(TD, 'max-w-[240px] text-caption text-accent-strong')}>{r.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <BlockerDetail r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
