import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Select } from '@/components/ui/select';
import type { TelemetryIssue, TelemetryReport } from '@/types';
import { utc } from '../invoice-validation/labels';
import { DIAGNOSIS, TM_ISSUE_LABEL } from './labels';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- значения колонок разных типов
const COLUMNS: ColumnDef<TelemetryIssue, any>[] = [
  { accessorKey: 'timestamp', header: 'Время (UTC)', cell: (c) => <span className="tabular whitespace-nowrap text-caption">{utc(c.getValue<string | null>())}{c.row.original.line ? <span className="block text-text-muted">строка {c.row.original.line}</span> : null}</span> },
  { accessorKey: 'owner', header: 'Актив', cell: (c) => <span className="text-caption font-medium">{c.getValue<string>()}</span> },
  { accessorKey: 'signal', header: 'Сигнал', cell: (c) => <span className="font-mono text-[11px]">{c.getValue<string>()}</span> },
  {
    accessorKey: 'type',
    header: 'Проблема',
    cell: (c) => (
      <span className="flex flex-col items-start gap-1">
        <Badge size="sm" tone={c.row.original.severity === 'CRITICAL' ? 'error' : 'warning'}>{TM_ISSUE_LABEL[c.row.original.type]}</Badge>
        <span className="text-[10px] text-text-muted">{DIAGNOSIS[c.row.original.diagnosis].label} · {c.row.original.ruleId}</span>
      </span>
    ),
  },
  { accessorKey: 'value', header: 'Значение', enableSorting: false, cell: (c) => <span className="font-mono text-caption">{c.getValue<string>()}</span> },
  { accessorKey: 'expected', header: 'Правило', enableSorting: false, cell: (c) => <span className="text-caption">{c.getValue<string>()}</span> },
  { accessorKey: 'explanation', header: 'Объяснение', enableSorting: false, cell: (c) => <span className="text-caption text-text-secondary">{c.getValue<string>()}</span> },
  { accessorKey: 'action', header: 'Исправление', enableSorting: false, cell: (c) => <span className="text-caption font-medium text-accent-strong">{c.getValue<string>()}</span> },
];

export function TelemetryIssues({ report }: { report: TelemetryReport }) {
  const [owner, setOwner] = React.useState('all');
  const [diag, setDiag] = React.useState('all');
  const [limit, setLimit] = React.useState(100);
  const owners = [...new Set(report.issues.map((i) => i.owner))];
  const diags = [...new Set(report.issues.map((i) => i.diagnosis))];
  const list = report.issues.filter((i) => (owner === 'all' || i.owner === owner) && (diag === 'all' || i.diagnosis === diag));
  return (
    <section id="issues" aria-label="Проблемы телеметрии" className="flex scroll-mt-24 flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-label text-text-muted">Препятствия</span>
          <h2 className="text-h3">Проблемы телеметрии <span className="tabular text-text-secondary">· {report.issues.length + report.issuesTruncated}</span></h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-48"><Select aria-label="Актив" value={owner} onValueChange={setOwner} options={[{ value: 'all', label: 'Все активы' }, ...owners.map((o) => ({ value: o, label: o }))]} /></div>
          <div className="w-52"><Select aria-label="Причина" value={diag} onValueChange={setDiag} options={[{ value: 'all', label: 'Все причины' }, ...diags.map((d) => ({ value: d, label: DIAGNOSIS[d].label }))]} /></div>
        </div>
      </div>
      <DataTable caption="Проблемы телеметрии" columns={COLUMNS} data={list.slice(0, limit)} density="compact" emptyTitle="Проблем не найдено" rowTone={(r) => (r.severity === 'CRITICAL' ? 'error' : 'warning')} />
      {limit < list.length && (
        <button type="button" className="self-start text-caption font-medium text-accent-strong hover:underline" onClick={() => setLimit((l) => l + 300)}>
          Показать ещё ({list.length - limit})
        </button>
      )}
    </section>
  );
}
