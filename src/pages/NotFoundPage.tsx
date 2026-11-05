import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass aria-hidden />}
      title="Страница не найдена"
      description="Проверьте адрес или вернитесь к карточке запуска."
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to={ROUTES.launch}>К карточке запуска</Link>
        </Button>
      }
    />
  );
}
