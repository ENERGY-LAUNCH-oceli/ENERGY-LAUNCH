import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { StatusScreen } from '@/components/errors/StatusScreen';
import { Button } from '@/components/ui/button';
import { statusInfo, type StatusInfo } from '@/errors/codes';

/** Действия страницы состояния: к обзору, назад, перечень всех кодов. */
export function StatusActions() {
  const navigate = useNavigate();
  return (
    <>
      <Button asChild variant="accent">
        <Link to={ROUTES.overview}>
          <LayoutGrid aria-hidden />К обзору объектов
        </Link>
      </Button>
      <Button variant="secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(ROUTES.overview))}>
        <ArrowLeft aria-hidden />
        Назад
      </Button>
    </>
  );
}

export function StatusPageView({ info }: { info: StatusInfo }) {
  return (
    <StatusScreen
      info={info}
      actions={<StatusActions />}
      footer={
        <Link to={ROUTES.statusCodes} className="link-line text-body-sm text-accent-strong">
          Все коды состояния
        </Link>
      }
    />
  );
}

export function NotFoundPage() {
  return <StatusPageView info={statusInfo(404)!} />;
}
