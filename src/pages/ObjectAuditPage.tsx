import { PageHeader } from '@/components/common/PageHeader';
import { AuditTrail } from '@/features/trail/AuditTrail';
import { useLaunchStore } from '@/store';

/** Журнал объекта: записи аудита в полном формате и воспроизведение статуса на момент записи. */
export function ObjectAuditPage() {
  const events = useLaunchStore((s) => s.auditLog);
  const session = useLaunchStore((s) => s.session);
  const inputs = useLaunchStore((s) => s.inputs);
  if (!session || !inputs) return null;
  const source = { objectId: session.objectId, objectName: inputs.object.name, events, history: inputs.validationHistory ?? [] };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Журнал" title="Журнал аудита объекта" description="Каждое действие: время, автор, сущность, было → стало, результат и версия правил. Выберите запись, чтобы увидеть, почему объект имел такой статус в этот момент." />
      <AuditTrail sources={[source]} fixedObject={session.objectId} />
    </div>
  );
}
