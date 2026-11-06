import { PageHeader } from '@/components/common/PageHeader';
import { AuditTimeline } from '@/components/launch';
import { Card, CardContent } from '@/components/ui/card';
import { useLaunchStore } from '@/store';

export function ObjectAuditPage() {
  const events = useLaunchStore((s) => s.auditLog);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Журнал" title="Журнал переходов" description="Каждый переход и ручное подтверждение: время, автор, этап, версия правил и результат." />
      <Card>
        <CardContent className="pt-5">
          <AuditTimeline events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
