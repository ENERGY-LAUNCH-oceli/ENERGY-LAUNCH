import { Download } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { AuditTrail } from '@/features/trail/AuditTrail';
import { journalExport, journalRows } from '@/features/trail/journal-export';
import { useLaunchStore } from '@/store';
import { toCsv } from '@/utils/csv';
import { downloadFile } from '@/utils/download';

/** Журнал объекта: записи аудита в полном формате, воспроизведение статуса на момент записи и выгрузка (ТЗ 2.2 п. 6, пакет сдачи п. 5). */
export function ObjectAuditPage() {
  const events = useLaunchStore((s) => s.auditLog);
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  if (!session || !inputs) return null;
  const source = { objectId: session.objectId, objectName: inputs.object.name, events, history: inputs.validationHistory ?? [] };
  const base = `${session.objectId}-journal`;
  const exportJson = () => downloadFile(`${base}.json`, JSON.stringify(journalExport(session, inputs, events, new Date().toISOString()), null, 2), 'application/json');
  const exportCsv = () => downloadFile(`${base}.csv`, toCsv(journalRows(events)), 'text/csv');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Журнал"
        title="Журнал аудита объекта"
        description="Каждое действие: время, автор, сущность, было → стало, результат и версия правил. Выберите запись, чтобы увидеть, почему объект имел такой статус в этот момент."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportJson} data-testid="journal-export-json">
              <Download aria-hidden />
              Журнал JSON
            </Button>
            <Button variant="secondary" onClick={exportCsv} data-testid="journal-export-csv">
              <Download aria-hidden />
              CSV
            </Button>
          </div>
        }
      />
      <AuditTrail sources={[source]} fixedObject={session.objectId} />
    </div>
  );
}
