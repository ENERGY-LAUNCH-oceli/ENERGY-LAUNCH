import { BLOCK_CATALOG, type BlockEvaluation } from '@/engine';
import type { DashboardBlockConfig, DashboardBlockId, DashboardConfig } from '@/types';
import { AssetsBlock } from './AssetsBlock';
import { BlockFrame } from './BlockFrame';
import { ControlBlock } from './ControlBlock';
import type { DashboardData } from './data';
import { HistoryBlock } from './HistoryBlock';
import { QualityBlock } from './QualityBlock';

const RENDER: Record<DashboardBlockId, (p: { block: DashboardBlockConfig; data: DashboardData }) => React.JSX.Element> = {
  METER_HISTORY: HistoryBlock,
  ASSETS: AssetsBlock,
  CONTROL: ControlBlock,
  QUALITY_STATUS: QualityBlock,
};

/** Рабочая панель объекта: четыре блока в заданном порядке, данные – только этого объекта. */
export function DashboardView({ config, data, evaluation }: { config: DashboardConfig; data: DashboardData; evaluation?: Record<DashboardBlockId, BlockEvaluation> }) {
  if (config.objectId !== data.objectId) {
    return <p className="rounded-lg border border-error-border bg-error-subtle p-4 text-body-sm text-error">Панель привязана к {config.objectId}, а открыт объект {data.objectId}. Данные других объектов не показываются.</p>;
  }
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2" data-testid="dashboard-view">
      {config.blocks.map((b, i) => {
        const Body = RENDER[b.id];
        return (
          <BlockFrame
            key={b.id}
            index={i + 1}
            title={BLOCK_CATALOG[b.id].title}
            objectId={config.objectId}
            className={b.id === 'METER_HISTORY' || b.id === 'QUALITY_STATUS' ? 'xl:col-span-2' : undefined}
            {...(evaluation ? { evaluation: evaluation[b.id] } : {})}
          >
            <Body block={b} data={data} />
          </BlockFrame>
        );
      })}
    </div>
  );
}
