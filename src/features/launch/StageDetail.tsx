import { ClipboardCheck } from 'lucide-react';
import * as React from 'react';
import { BlockerPanel, EvidencePanel, ValidationResult, ValidationStatus } from '@/components/launch';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal } from '@/components/ui/dialog';
import { NEXT_ACTION_BY_RULE, getUnmetConfirmations } from '@/engine';
import { blockerHref } from '@/config/blocker-links';
import { useLaunchStore } from '@/store';
import type { StageId } from '@/types';
import { toValidationView } from './adapters';

const SOURCE: Record<StageId, string> = {
  METER_HISTORY: 'invoice.csv',
  REALTIME_TELEMETRY: 'telemetry.csv',
  ASSET_CONTROL: 'тестовый контур',
  FINAL_DASHBOARDS: 'конфигурация дашбордов',
};

/** Детали этапа: проверки, препятствия, подтверждения. Данные – из стора, решения – из движка. */
export function StageDetail({ stageId }: { stageId: StageId }) {
  const session = useLaunchStore((s) => s.session);
  const ruleset = useLaunchStore((s) => s.ruleset);
  if (!session) return null;
  const stage = session.stages[stageId];
  const results = stage.validationResults.map((r) => toValidationView(r, SOURCE[stageId]));
  const blockers = session.blockers.filter((b) => b.stageId === stageId);
  const evidence = session.evidence.filter((e) => e.stageId === stageId);
  const required = ruleset.confirmations[stageId].length;
  const unmet = getUnmetConfirmations(session, stageId, ruleset);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
        <ValidationStatus results={results} {...(stage.lastValidatedAt ? { lastCheckedAt: stage.lastValidatedAt } : {})} rulesetVersion={session.rulesetVersion} />
        {results.length === 0 ? (
          <EmptyState compact title="Проверки не запускались" description="Отсутствие данных не считается успешной проверкой." />
        ) : (
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <ValidationResult key={r.ruleId} result={r} />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-5">
        <BlockerPanel
          items={blockers.map((b) => ({
            blocker: b,
            ...(b.ruleId && NEXT_ACTION_BY_RULE[b.ruleId] ? { nextAction: NEXT_ACTION_BY_RULE[b.ruleId], nextActionHref: blockerHref(session.objectId, b.ruleId, b.stageId) } : {}),
          }))}
        />
        <EvidencePanel
          items={evidence.map((e) => ({ ...e, rulesetVersion: session.rulesetVersion }))}
          confirmations={{ received: required - unmet.length, required }}
        />
        {(stage.status === 'IN_PROGRESS' || stage.status === 'BLOCKED') && unmet.length > 0 && <ConfirmDialog stageId={stageId} />}
      </div>
    </div>
  );
}

export function ConfirmDialog({ stageId }: { stageId: StageId }) {
  const session = useLaunchStore((s) => s.session)!;
  const ruleset = useLaunchStore((s) => s.ruleset);
  const addEvidence = useLaunchStore((s) => s.addEvidence);
  const addConfirmation = useLaunchStore((s) => s.addConfirmation);
  const unmet = getUnmetConfirmations(session, stageId, ruleset);
  const [open, setOpen] = React.useState(false);
  const [checked, setChecked] = React.useState<string[]>([]);

  const confirm = () => {
    for (const req of unmet.filter((r) => checked.includes(r.id))) {
      if (!addEvidence({ stageId, type: req.evidenceTypes[0]!, title: `${req.title} – отчёт` })) return;
      const evidenceId = useLaunchStore.getState().session!.evidence.at(-1)!.id;
      addConfirmation({ stageId, requirementId: req.id, role: req.role, confirmedBy: useLaunchStore.getState().actor, evidenceIds: [evidenceId] });
    }
    setChecked([]);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Подтверждение требований этапа"
      description="Подтверждение фиксируется в журнале с автором, временем и версией правил."
      trigger={
        <Button variant="secondary">
          <ClipboardCheck aria-hidden />
          Подтвердить требования
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button variant="accent" disabled={checked.length === 0} onClick={confirm}>
            Подтвердить ({checked.length})
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {unmet.map((r) => (
          <Checkbox
            key={r.id}
            label={r.title}
            description={`${r.id} · роль ${r.role}`}
            checked={checked.includes(r.id)}
            onCheckedChange={(v) => setChecked((c) => (v === true ? [...c, r.id] : c.filter((x) => x !== r.id)))}
          />
        ))}
      </div>
    </Modal>
  );
}
