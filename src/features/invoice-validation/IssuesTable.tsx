import { Search } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { InvoiceIssue, InvoiceReport } from '@/types';
import { ISSUE_LABEL, utc } from './labels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- значения колонок разных типов
const COLUMNS: ColumnDef<InvoiceIssue, any>[] = [
  {
    accessorKey: 'timestamp',
    header: 'Дата и время (UTC)',
    cell: (c) => {
      const i = c.row.original;
      return (
        <span className="tabular whitespace-nowrap text-caption">
          {utc(i.timestamp)}
          {i.timestampTo && <span className="block text-text-muted">→ {utc(i.timestampTo)}</span>}
          {i.line && <span className="block text-text-muted">строка {i.line}</span>}
        </span>
      );
    },
  },
  { accessorKey: 'field', header: 'Поле', cell: (c) => <span className="font-mono text-[11px]">{c.getValue<string>()}</span> },
  {
    accessorKey: 'type',
    header: 'Тип проблемы',
    cell: (c) => (
      <span className="flex flex-col items-start gap-1">
        <Badge size="sm" tone={c.row.original.severity === 'CRITICAL' ? 'error' : 'warning'}>
          {ISSUE_LABEL[c.row.original.type]}
        </Badge>
        <span className="font-mono text-[10px] text-text-muted">{c.row.original.ruleId}</span>
      </span>
    ),
  },
  { accessorKey: 'value', header: 'Значение', enableSorting: false, cell: (c) => <span className="tabular font-mono text-caption">{c.getValue<string>()}</span> },
  { accessorKey: 'expected', header: 'Правило', enableSorting: false, cell: (c) => <span className="text-caption">{c.getValue<string>()}</span> },
  { accessorKey: 'explanation', header: 'Объяснение', enableSorting: false, cell: (c) => <span className="text-caption text-text-secondary">{c.getValue<string>()}</span> },
  { accessorKey: 'action', header: 'Исправление', enableSorting: false, cell: (c) => <span className="text-caption font-medium text-accent-strong">{c.getValue<string>()}</span> },
];

const PAGE = 100;

/** Таблица препятствий с фильтрами по типу, полю, критичности и поиском. */
export function IssuesTable({ report }: { report: InvoiceReport | undefined }) {
  const [type, setType] = React.useState('all');
  const [field, setField] = React.useState('all');
  const [severity, setSeverity] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [limit, setLimit] = React.useState(PAGE);
  const issues = report?.issues ?? [];
  const types = [...new Set(issues.map((i) => i.type))];
  const fields = [...new Set(issues.map((i) => i.field))];
  const needle = q.trim().toLowerCase();
  const filtered = issues.filter(
    (i) => (type === 'all' || i.type === type) && (field === 'all' || i.field === field) && (severity === 'all' || i.severity === severity) && (!needle || `${i.timestamp ?? ''} ${i.value} ${i.explanation}`.toLowerCase().includes(needle)),
  );
  const total = Object.values(report?.issueCounts ?? {}).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <section id="issues" aria-label="Таблица препятствий" className="scroll-mt-24 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-label text-text-muted">Препятствия</span>
          <h2 className="text-h3">
            Найденные проблемы <span className="tabular text-text-secondary">· {total.toLocaleString('ru-RU')}</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-52">
            <Select aria-label="Тип проблемы" value={type} onValueChange={(v) => (setType(v), setLimit(PAGE))} options={[{ value: 'all', label: 'Все типы' }, ...types.map((t) => ({ value: t, label: `${ISSUE_LABEL[t]} · ${report?.issueCounts[t] ?? 0}` }))]} />
          </div>
          <div className="w-60">
            <Select aria-label="Поле" value={field} onValueChange={(v) => (setField(v), setLimit(PAGE))} options={[{ value: 'all', label: 'Все поля' }, ...fields.map((f) => ({ value: f, label: f }))]} />
          </div>
          <div className="w-44">
            <Select aria-label="Критичность" value={severity} onValueChange={setSeverity} options={[{ value: 'all', label: 'Любая критичность' }, { value: 'CRITICAL', label: 'Блокирующие' }, { value: 'WARNING', label: 'Предупреждения' }]} />
          </div>
          <div className="w-56">
            <Input leading={<Search />} aria-label="Поиск по проблемам" placeholder="Дата, значение…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <DataTable
        caption="Препятствия invoice.csv"
        columns={COLUMNS}
        data={filtered.slice(0, limit)}
        density="compact"
        emptyTitle={report ? 'Проблем не найдено' : 'Файл не загружен'}
        rowTone={(r) => (r.severity === 'CRITICAL' ? 'error' : 'warning')}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-text-muted">
        <span className="tabular">
          Показано {Math.min(limit, filtered.length).toLocaleString('ru-RU')} из {filtered.length.toLocaleString('ru-RU')}
          {report?.issuesTruncated ? ` · ещё ${report.issuesTruncated.toLocaleString('ru-RU')} строковых проблем учтены в счётчиках, но не сохранены` : ''}
        </span>
        {limit < filtered.length && (
          <button type="button" className="font-medium text-accent-strong hover:underline" onClick={() => setLimit((l) => l + PAGE * 5)}>
            Показать ещё
          </button>
        )}
      </div>
    </section>
  );
}
