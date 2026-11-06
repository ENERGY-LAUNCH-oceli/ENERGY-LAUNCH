import { ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { EvidencePanel } from '@/components/launch';
import { FileUpload } from '@/components/ui/file-upload';
import { STAGE_META } from '@/config/stages';
import { getUnmetConfirmations } from '@/engine';
import { useLaunchStore } from '@/store';
import type { StageId } from '@/types';
import { ChecksList } from './ChecksList';
import { StageActionBar } from './StageActionBar';
import { obstacleView, stageStats, STAGE_SOURCE } from './model';
import { ObstacleList } from './ObstacleList';

/** Контекстная область выбранного этапа: действия, проверки, препятствия, подтверждающие материалы. */
export function StageWorkspace({ stageId }: { stageId: StageId }) {
  const session = useLaunchStore((s) => s.session)!;
  const inputs = useLaunchStore((s) => s.inputs)!;
  const ruleset = useLaunchStore((s) => s.ruleset);
  const addEvidence = useLaunchStore((s) => s.addEvidence);
  const [files, setFiles] = React.useState<File[]>([]);

  const stage = session.stages[stageId];
  const stats = stageStats(session, stageId);
  const obstacles = session.blockers.filter((b) => b.stageId === stageId).map((b) => obstacleView(b, session, inputs));
  const evidence = session.evidence.filter((e) => e.stageId === stageId);
  const required = ruleset.confirmations[stageId].length;
  const unmet = getUnmetConfirmations(session, stageId, ruleset);

  const upload = (list: File[]) => {
    for (const f of list) addEvidence({ stageId, type: 'FILE', title: f.name, fileName: f.name, sizeBytes: f.size, mimeType: f.type || 'text/csv' });
    setFiles([]);
  };

  return (
    <section aria-label={`Этап ${STAGE_META[stageId].titleRu}`} className="flex flex-col gap-5">
      <StageActionBar stageId={stageId} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-label uppercase text-text-muted">Проверки</h3>
          <ChecksList checks={stats.checks} source={STAGE_SOURCE[stageId]} />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <h3 className="text-label uppercase text-text-muted">Препятствия</h3>
            {obstacles.length ? (
              <ObstacleList items={obstacles} />
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-body-sm">
                <ShieldCheck className="size-5 text-status-completed" aria-hidden />
                {stage.lastValidatedAt ? 'Препятствий нет' : 'Появятся после запуска проверок'}
              </div>
            )}
          </div>
          <EvidencePanel items={evidence.map((e) => ({ ...e, rulesetVersion: session.rulesetVersion }))} confirmations={{ received: required - unmet.length, required }} />
          {stage.status !== 'COMPLETED' && <FileUpload accept=".csv,.json,.pdf" multiple files={files} onFilesChange={upload} label="Добавить материал к этапу" hint="Сохраняется даже до начала этапа" />}
        </div>
      </div>
    </section>
  );
}
