import { AuditTrail } from '@/features/trail/AuditTrail';
import { usePortfolioWorkspaces } from '@/hooks/use-portfolio-workspaces';

/** Журнал аудита портфеля: кто, что, когда, было → стало, результат, версия правил; воспроизведение статуса. */
export function AuditTrailPage() {
  const ws = usePortfolioWorkspaces();
  const sources = ws.map((w) => ({ objectId: w.entry.id, objectName: w.entry.name, events: w.auditLog, history: w.inputs.validationHistory ?? [] }));
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-h1">Журнал аудита</h1>
        <p className="max-w-3xl text-body text-text-muted">Загрузки файлов, запуски и повторные проверки, изменения конфигурации и карты сигналов, команды, подтверждения, приёмка, переходы и изменения статусов.</p>
      </header>
      <AuditTrail sources={sources} />
    </div>
  );
}
