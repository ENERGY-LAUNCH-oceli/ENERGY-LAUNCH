import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLaunchStore } from '@/store';

export function ObjectsPage() {
  const object = useLaunchStore((s) => s.inputs?.object);
  return (
    <>
      <PageHeader title="Объекты" description="Реестр энергетических объектов (полная версия — в следующих фазах)." />
      {object && (
        <Card>
          <CardHeader>
            <CardTitle>{object.name}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <span>Код: {object.code}</span>
            <span>Мощность: {object.passport.installedCapacityMw} МВт</span>
            <span>Присоединение: {object.gridConnection.pointOfConnection}</span>
            <span>Активов: {object.assets.length}</span>
          </CardContent>
        </Card>
      )}
    </>
  );
}
