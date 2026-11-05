import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { cn } from '@/utils/cn';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Числовая колонка: выравнивание вправо и табличные цифры. */
    numeric?: boolean;
    className?: string;
  }
}

export interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  density?: 'compact' | 'comfortable';
  onRowClick?: (row: T) => void;
  getRowId?: (row: T, index: number) => string;
  /** Подсветка строки (например, строка с нарушением). */
  rowTone?: (row: T) => 'error' | 'warning' | undefined;
  caption?: string;
  className?: string;
}

/** Таблица данных на TanStack Table: сортировка, плотность, числовые колонки, пустое и загрузочное состояния. */
export function DataTable<T>({
  columns,
  data,
  loading,
  emptyTitle = 'Нет данных',
  emptyDescription,
  density = 'comfortable',
  onRowClick,
  getRowId,
  rowTone,
  caption,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId ? { getRowId } : {}),
  });

  if (loading) return <LoadingState rows={5} />;
  if (data.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} compact />;

  const cellPad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-surface', className)}>
      <table className="w-full border-collapse text-body-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-secondary">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border">
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    className={cn(cellPad, 'whitespace-nowrap text-left text-caption font-bold uppercase tracking-[0.06em] text-text-secondary', meta?.numeric && 'text-right', meta?.className)}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn('inline-flex items-center gap-1 uppercase hover:text-text-primary', meta?.numeric && 'flex-row-reverse')}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {dir === 'asc' ? <ArrowUp className="size-3.5" /> : dir === 'desc' ? <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const tone = rowTone?.(row.original);
            return (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors duration-fast',
                  onRowClick && 'cursor-pointer hover:bg-surface-secondary',
                  tone === 'error' && 'bg-error-subtle/60 shadow-[inset_3px_0_0] shadow-status-blocked-solid',
                  tone === 'warning' && 'bg-warning-subtle/60 shadow-[inset_3px_0_0] shadow-warning',
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <td key={cell.id} className={cn(cellPad, 'align-middle', meta?.numeric && 'tabular text-right', meta?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { ColumnDef };
