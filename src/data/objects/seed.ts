import { addConfirmation, addEvidence, completeStage, createFixedContext, createLaunchSession, startStage, validateStage, type MachineResult } from '@/engine';
import type { AuditEvent, LaunchInputs, LaunchSession, RulesConfig } from '@/types';
import { STAGE_IDS } from '@/types';
import { loadObjectInputs, type ObjectCatalogEntry } from './catalog';

export interface SeededWorkspace {
  scenarioId: string;
  inputs: LaunchInputs;
  session: LaunchSession;
  auditLog: AuditEvent[];
}

/**
 * Детерминированно проводит объект через этапы движком (фиксированное время и ID):
 * до `seedUntil` включительно или до первой блокировки. Каждый шаг журналируется.
 */
export function seedWorkspace(entry: ObjectCatalogEntry, ruleset: RulesConfig): SeededWorkspace {
  const inputs = loadObjectInputs(entry);
  const base = Date.parse(entry.seedAt);
  let tick = 0;
  let seq = 0;
  const ctx = { actor: entry.responsible, now: () => new Date(base + tick++ * 60_000).toISOString(), newId: () => `${entry.id}-${++seq}` };
  const fixed = createFixedContext(entry.responsible, entry.seedAt, `${entry.id}-s`);
  let session = createLaunchSession(entry.id, ruleset.version, { ...fixed, now: ctx.now });
  const auditLog: AuditEvent[] = [{ id: `${entry.id}-created`, action: 'SESSION_CREATED', actor: entry.responsible, timestamp: entry.seedAt, sessionId: session.id, objectId: entry.id, rulesetVersion: ruleset.version, payload: { scenarioId: entry.scenarioId } }];

  const apply = (r: MachineResult): boolean => {
    auditLog.push(...r.events);
    if (r.ok) session = r.session;
    return r.ok;
  };

  for (const stageId of STAGE_IDS.slice(0, STAGE_IDS.indexOf(entry.seedUntil) + 1)) {
    apply(startStage(session, stageId, ctx));
    apply(validateStage(session, stageId, inputs, ruleset, ctx));
    if (session.stages[stageId].status !== 'IN_PROGRESS') break;
    for (const req of ruleset.confirmations[stageId]) {
      apply(addEvidence(session, { stageId, type: req.evidenceTypes[0]!, title: `${req.title} — отчёт` }, ctx));
      apply(addConfirmation(session, { stageId, requirementId: req.id, role: req.role, confirmedBy: entry.responsible, evidenceIds: [session.evidence.at(-1)!.id] }, ruleset, ctx));
    }
    if (!apply(completeStage(session, stageId, ruleset, ctx))) break;
  }
  return { scenarioId: entry.scenarioId, inputs, session, auditLog };
}
