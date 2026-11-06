import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import type { ObjectCatalogEntry } from '@/data/objects';
import { useLaunchStore } from '@/store';

/** Удаление объекта, добавленного пользователем (объекты набора и демо-портфеля не удаляются). */
export function DeleteObjectButton({ entry }: { entry: ObjectCatalogEntry }) {
  const removeObject = useLaunchStore((s) => s.removeObject);
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  if (entry.source !== 'USER') return null;
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" data-testid="delete-object">
          <Trash2 /> Удалить объект
        </Button>
      }
      title={`Удалить «${entry.name}»?`}
      description="Объект, его сессия запуска и загруженные данные будут удалены из портфеля в этом браузере. Действие нельзя отменить."
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            variant="danger"
            data-testid="delete-object-confirm"
            onClick={() => {
              if (removeObject(entry.id)) {
                setOpen(false);
                navigate(ROUTES.objects);
              }
            }}
          >
            Удалить
          </Button>
        </>
      }
    />
  );
}
