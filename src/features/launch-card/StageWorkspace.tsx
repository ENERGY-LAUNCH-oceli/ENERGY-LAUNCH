import { CheckCheck, FlaskConical, Link2Off, Play, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { EvidencePanel } from '@/components/launch';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/ui/file-upload';
import { StatusBadge } from '@/components/ui/status-badge';
import { STAGE_META, STAGE_STATUS_LABEL } from '@/config/stages';
import { getUnmetConfirmations } from '@/engine';
import { ConfirmDialog } from '@/features/launch';
import { useLaunchStore } from '@/store';
import type { StageId, StageStatus } from '@/types';
import { ChecksList } from './ChecksList';
import { obstacleView, stageStats, STAGE_SOURCE } from './model';
import { ObstacleList } from './ObstacleList';

/** Контекстная область выбранного этапа: действия, проверки, препятствия, подтверждающие материалы. */
export function StageWorkspace({ stageId }: { stageId: StageId }) {
  const session = useLaunchStore((s) => s.session)!;
  const inputs = useLaunchStore((s) => s.inputs)!;
  const ruleset = useLaunchStore((s) => s.ruleset);
  const lastError = useLaunchStore((s) => s.lastError);
  const clearError = useLaunchStore((s) => s.clearError);
  const start = useLaunchStore((s) => s.startStage);
  const validate = useLaunchStore((s) => s.validateStage);
  const complete = useLaunchStore((s) => s.completeStage);
  const addEvidence = useLaunchStore((s) => s.addEvidence);
  const [files, setFiles] = React.useState<File[]>([]);

  const stage = session.stages[stageId];
  const stats = stageStats(session, stageId);
  const obstacles = session.blockers.filter((b) => b.stageId === stageId).map((b) => obstacleView(b, session, inputs));
  const evidence = session.evidence.filter((e) => e.stageId === stageId);
  const required = ruleset.confirmations[stageId].length;
  const unmet = getUnmetConfirmations(session, stageId, ruleset);
  const error = lastError && lastError.stageId === stageId ? lastError : null;
  const deps = (error?.details?.dependencies as { stageId: StageId; status: StageStatus }[] | undefined) ?? [];

  const upload = (list: File[]) => {
    for (const f of list) addEvidence({ stageId, type: 'FILE', title: f.name, fileName: f.name, sizeBytes: f.size, mimeType: f.type || 'text/csv' });
    setFiles([]);
  };

  return (
    <section aria-label={`Этап ${STAGE_META[stageId].titleRu}`} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="tabular font-mono text-h3 text-text-muted">0{stage.order}</span>
          <div className="flex flex-col">
            <h2 className="text-h2">{STAGE_META[stageId].titleRu}</h2>
            <span className="text-caption text-text-muted">
              Проверок: <b className="tabular">{stats.checks.length}</b> · пройдено <b className="tabular">{stats.passed}</b> · ошибок <b className="tabular">{stats.failed}</b> · ожидают <b className="tabular">{stats.pending}</b>
            </span>
          </div>
          <StatusBadge status={stage.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {stage.status === 'NOT_STARTED' && (
            <Button variant="accent" onClick={() => start(stageId)}>
              <Play aria-hidden />
              Начать этап
            </Button>
          )}
          {(stage.status === 'IN_PROGRESS' || stage.status === 'BLOCKED') && (
            <>
              <Button variant="secondary" onClick={() => validate(stageId)}>
                <FlaskConical aria-hidden />
                {stage.lastValidatedAt ? 'Повторить проверки' : 'Запустить проверки'}
              </Button>
              {unmet.length > 0 && <ConfirmDialog stageId={stageId} />}
            </>
          )}
          {stage.status !== 'COMPLETED' && (
            <Button variant="primary" onClick={() => complete(stageId)}>
              <CheckCheck aria-hidden />
              Завершить этап
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert
          tone="error"
          title="Переход отклонён"
          action={
            <Button size="sm" variant="ghost" onClick={clearError}>
              Понятно
            </Button>
          }
        >
          {deps.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span>Этап «{STAGE_META[stageId].titleRu}» нельзя завершить, пока не закрыты зависимости:</span>
              <ul className="flex flex-col gap-1" data-testid="transition-dependencies">
                {deps.map((d) => (
                  <li key={d.stageId} className="flex items-center gap-2">
                    <Link2Off className="size-3.5 text-error" aria-hidden />
                    <b className="text-text-primary">{STAGE_META[d.stageId].titleRu}</b> — {STAGE_STATUS_LABEL[d.status].toLowerCase()}
                  </li>
                ))}
              </ul>
              <span className="text-caption">
                Загруженные материалы этапа сохранены: <b className="tabular">{evidence.length}</b>.
              </span>
            </div>
          ) : (
            error.message
          )}
        </Alert>
      )}

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
