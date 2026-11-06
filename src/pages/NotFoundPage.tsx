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
      description="Проверьте адрес или вернитесь к обзору."
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to={ROUTES.overview}>К обзору</Link>
        </Button>
      }
    />
  );
}
