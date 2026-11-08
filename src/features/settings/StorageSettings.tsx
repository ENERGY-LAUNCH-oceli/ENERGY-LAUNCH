import type { ReactNode } from 'react';
import { storageText } from '@/components/layout/StorageIndicator';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useStorageStatus } from '@/services/server-storage';

/** Где сохраняются объекты, ход запуска и журнал: сервер PostgreSQL или браузер. */
export function StorageSettings() {
  const s = useStorageStatus();
  const t = storageText(s);
  const server = s.mode === 'server';
  const rows: [string, ReactNode][] = server
    ? [
        ['Хранилище', s.kind === 'pglite' ? 'Встроенный PostgreSQL (PGlite) – папка .data/pglite на сервере' : 'PostgreSQL – база из DATABASE_URL'],
        ['Что сохраняется', 'Объекты, добавленные вручную; входные данные и ход запуска каждого объекта; журнал аудита (только дополняется)'],
        ['Состояние', t.title],
        ['Последнее сохранение', s.savedAt ? new Date(s.savedAt).toLocaleString('ru-RU') : 'изменений после загрузки не было'],
      ]
    : [
        ['Хранилище', 'Браузер: объекты – localStorage, ход запуска – до перезагрузки страницы'],
        ['Как включить PostgreSQL', <span key="cmd">Запустите сервер <code className="font-mono text-caption">npm run api</code> и обновите страницу</span>],
      ];
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        {s.status === 'error' && <Alert tone="error" title="Последнее изменение не сохранено">{s.error}</Alert>}
        <dl className="grid gap-x-6 gap-y-3 text-body-sm sm:grid-cols-[minmax(160px,auto)_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-text-muted">{k}</dt>
              <dd className="min-w-0 text-text-primary">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
