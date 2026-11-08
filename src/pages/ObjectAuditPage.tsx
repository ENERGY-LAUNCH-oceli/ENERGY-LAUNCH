import { Download } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { AUDIT_ACTION_LABEL } from '@/config/labels';
import { AuditTrail } from '@/features/trail/AuditTrail';
import { useLaunchStore } from '@/store';
import type { AuditEvent } from '@/types';

/** Сохранить файл в браузере (Blob – CSP разрешает). */
function save(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV журнала: «;» и BOM – как в данных кейса, открывается в Excel. */
function journalCsv(events: readonly AuditEvent[]): string {
  const head = ['Время (UTC)', 'Действие', 'Код действия', 'Автор', 'Этап', 'Версия правил', 'Данные'];
  const rows = events.map((e) => [e.timestamp, (AUDIT_ACTION_LABEL as Record<string, string>)[e.action] ?? e.action, e.action, e.actor, e.stageId ?? '', e.rulesetVersion ?? '', e.payload ? JSON.stringify(e.payload) : ''].map(csvCell).join(';'));
  return `\uFEFF${[head.map(csvCell).join(';'), ...rows].join('\n')}\n`;
}

/** Журнал объекта: записи аудита в полном формате, воспроизведение статуса на момент записи и выгрузка (ТЗ 2.2 п. 6, пакет сдачи п. 5). */
export function ObjectAuditPage() {
  const events = useLaunchStore((s) => s.auditLog);
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  if (!session || !inputs) return null;
  const source = { objectId: session.objectId, objectName: inputs.object.name, events, history: inputs.validationHistory ?? [] };
  const base = `${session.objectId}-journal`;
  const exportJson = () =>
    save(
      `${base}.json`,
      JSON.stringify({ objectId: session.objectId, objectName: inputs.object.name, sessionId: session.id, rulesetVersion: session.rulesetVersion, exportedAt: new Date().toISOString(), stages: Object.fromEntries(Object.entries(session.stages).map(([id, st]) => [id, st.status])), events, validationHistory: inputs.validationHistory ?? [] }, null, 2),
      'application/json',
    );
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
            <Button variant="secondary" onClick={() => save(`${base}.csv`, journalCsv(events), 'text/csv')} data-testid="journal-export-csv">
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
