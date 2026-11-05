import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ROUTES } from '@/app/routes';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Страница не найдена"
      action={
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.launch}>К запуску</Link>
        </Button>
      }
    />
  );
}
