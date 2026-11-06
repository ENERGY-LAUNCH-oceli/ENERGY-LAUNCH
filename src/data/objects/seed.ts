import { addConfirmation, addEvidence, completeStage, createFixedContext, createLaunchSession, startStage, validateStage, type MachineResult } from '@/engine';
import type { AuditEvent, LaunchInputs, LaunchSession, RulesConfig } from '@/types';
import { STAGE_IDS } from '@/types';
import { makeInvoiceRun } from '@/engine/invoice';
import { makeTelemetryRun } from '@/engine/telemetry';
import { makeControlRun } from '@/engine/control';
import { makeSnapshot } from '@/engine/trail';
import { buildDashboardWorkspace } from '@/data/mock';
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
  const auditLog: AuditEvent[] = [{ id: `${entry.id}-created`, action: 'SESSION_CREATED', actor: entry.responsible, timestamp: entry.seedAt, sessionId: session.id, objectId: entry.id, rulesetVersion: ruleset.version, payload: { scenarioId: entry.scenarioId, ...(entry.source === 'USER' ? { source: 'USER', createdBy: entry.responsible } : {}) } }];

  const apply = (r: MachineResult): boolean => {
    auditLog.push(...r.events);
    if (r.ok) session = r.session;
    return r.ok;
  };

  // Песочница сценария и новый объект пользователя: чистая сессия, этапы проходятся действиями
  if (entry.source === 'SCENARIO' || entry.source === 'USER') return { scenarioId: entry.scenarioId, inputs, session, auditLog };
  for (const stageId of STAGE_IDS.slice(0, STAGE_IDS.indexOf(entry.seedUntil) + 1)) {
    apply(startStage(session, stageId, ctx));
    const statusBefore = session.stages[stageId].status;
    if (stageId === 'FINAL_DASHBOARDS' && ruleset.dashboardConfig) {
      // Инженер публикует панель, ответственный принимает – до проверки этапа
      inputs.dashboard = buildDashboardWorkspace({ objectId: entry.id, at: ctx.now(), engineer: entry.responsible, publish: true, review: 'ACCEPT' });
    }
    if (apply(validateStage(session, stageId, inputs, ruleset, ctx))) {
      const st = session.stages[stageId];
      inputs.validationHistory = [...(inputs.validationHistory ?? []), makeSnapshot({ id: `${entry.id}-snap-${stageId}`, session, stageId, inputs, results: st.validationResults, statusBefore, at: st.lastValidatedAt!, actor: entry.responsible, trigger: 'SEED', sha: (_o, f) => entry.fileHashes?.[f] })];
    }
    if (stageId === 'REALTIME_TELEMETRY') {
      inputs.telemetryRuns = [makeTelemetryRun(inputs.telemetry, inputs.passport, session.stages.REALTIME_TELEMETRY.validationResults, ruleset.telemetry, ruleset.version, session.stages.REALTIME_TELEMETRY.lastValidatedAt!, [])];
    }
    if (stageId === 'ASSET_CONTROL' && ruleset.controlTesting) {
      inputs.controlRuns = [makeControlRun(inputs.controlCommands ?? [], session.stages.ASSET_CONTROL.validationResults, ruleset.controlTesting, ruleset.version, session.stages.ASSET_CONTROL.lastValidatedAt!, [])];
    }
    if (stageId === 'METER_HISTORY') {
      inputs.invoiceRuns = [makeInvoiceRun(inputs.invoice, session.stages.METER_HISTORY.validationResults, ruleset.meterHistory, ruleset.version, session.stages.METER_HISTORY.lastValidatedAt!, [])];
    }
    if (session.stages[stageId].status !== 'IN_PROGRESS') break;
    // Набор кейса 4: только автоматические проверки первого этапа; подтверждения и переходы – действия людей
    if (entry.source === 'CASE4') break;
    for (const req of ruleset.confirmations[stageId]) {
      apply(addEvidence(session, { stageId, type: req.evidenceTypes[0]!, title: `${req.title} – отчёт` }, ctx));
      apply(addConfirmation(session, { stageId, requirementId: req.id, role: req.role, confirmedBy: entry.responsible, evidenceIds: [session.evidence.at(-1)!.id] }, ruleset, ctx));
    }
    if (!apply(completeStage(session, stageId, ruleset, ctx))) break;
  }
  return { scenarioId: entry.scenarioId, inputs, session, auditLog };
}
