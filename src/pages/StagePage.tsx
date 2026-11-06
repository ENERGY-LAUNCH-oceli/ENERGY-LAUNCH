import { PageHeader } from '@/components/common/PageHeader';
import { STAGE_META } from '@/config/stages';
import { StageCardContainer, StageDetail } from '@/features/launch';
import { useLaunchStore } from '@/store';
import type { StageId } from '@/types';

/** Рабочая страница одного этапа: карточка с действиями и детали проверок. */
export function StagePage({ stageId }: { stageId: StageId }) {
  const session = useLaunchStore((s) => s.session);
  if (!session) return null;
  const meta = STAGE_META[stageId];
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={`Этап ${session.stages[stageId].order} из 4`} title={meta.titleRu} description={meta.description} />
      <StageCardContainer stageId={stageId} />
      <StageDetail stageId={stageId} />
    </div>
  );
}
