import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META } from '@/config/stages';
import { OBJECT_CATALOG, type ObjectCatalogEntry } from '@/data/objects';
import { sessionStatus, usePortfolioSessions } from '@/hooks/use-portfolio';
import type { LaunchSession } from '@/types';

type Row = ObjectCatalogEntry & { session: LaunchSession | undefined };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- значения колонок разных типов
const COLUMNS: ColumnDef<Row, any>[] = [
  {
    accessorKey: 'name',
    header: 'Объект',
    cell: (c) => (
      <Link to={ROUTES.object(c.row.original.id)} onClick={(event) => event.stopPropagation()} className="font-medium hover:text-accent-strong hover:underline">
        {c.getValue<string>()}
      </Link>
    ),
  },
  { accessorKey: 'code', header: 'Код', cell: (c) => <span className="font-mono text-caption">{c.getValue<string>()}</span> },
  { accessorKey: 'city', header: 'Город' },
  { accessorKey: 'assets', header: 'Активы', enableSorting: false },
  { id: 'stage', header: 'Текущий этап', enableSorting: false, cell: (c) => STAGE_META[c.row.original.session?.currentStageId ?? 'METER_HISTORY'].titleRu },
  { id: 'status', header: 'Статус запуска', enableSorting: false, cell: (c) => <StatusBadge status={sessionStatus(c.row.original.session)} /> },
];

export function ObjectsPage() {
  const sessions = usePortfolioSessions();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Реестр" title="Объекты" description="Здания с подключением к сети, PV-установками и батареями. Откройте объект, чтобы перейти к его паспорту и запуску." />
      <DataTable
        caption="Объекты портфеля"
        columns={COLUMNS}
        data={OBJECT_CATALOG.map((o) => ({ ...o, session: sessions[o.id] }))}
        onRowClick={(r) => navigate(ROUTES.object(r.id))}
        rowTone={(r) => (sessionStatus(r.session) === 'BLOCKED' ? 'error' : undefined)}
      />
    </div>
  );
}
