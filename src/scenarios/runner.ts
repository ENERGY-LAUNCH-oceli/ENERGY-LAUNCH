import { registerSandbox, type ObjectCatalogEntry } from '@/data/objects';
import { controlAssets, hasBlockingFailures, objectReadiness, suggestedValue } from '@/engine';
import { benchState } from '@/simulator/control';
import { noopPersistence, useLaunchStore, withMutedNotifications } from '@/store';
import { DASHBOARD_BLOCK_IDS, STAGE_IDS, type AuditEvent, type DemoRole, type LaunchInputs, type LaunchSession, type SimScenario, type StageId, type StageStatus } from '@/types';

/**
 * Шаги сценария выполняются действиями хранилища приложения – тем же кодом, что и кнопки интерфейса
 * (проверки, переходы, подтверждения, имитатор управления, публикация и приёмка панели, повторная проверка).
 */
export interface ScenarioApi {
  start(stage: StageId): boolean;
  validate(stage: StageId): boolean;
  confirm(stage: StageId): void;
  complete(stage: StageId): boolean;
  /** start → validate → подтверждения → complete. */
  pass(stage: StageId): boolean;
  controlTest(assetId: string, scenario: SimScenario): void;
  publishDashboard(): boolean;
  reviewDashboard(result: 'ACCEPTED' | 'REJECTED'): boolean;
  role(role: DemoRole): void;
  importInvoice(report: NonNullable<LaunchInputs['invoice']>['report']): void;
  importPassport(passport: NonNullable<LaunchInputs['passport']>): void;
  source(kind: 'invoice' | 'telemetry', available: boolean, error?: string): void;
  inputs(): LaunchInputs;
  session(): LaunchSession;
}

export interface ScenarioWorkspace {
  session: LaunchSession;
  inputs: LaunchInputs;
  auditLog: AuditEvent[];
  rejections: { code: string; message: string; stageId?: string }[];
  durationMs: number;
}

/** Прогон в изолированной песочнице: состояние приложения пользователя сохраняется и восстанавливается. */
export function runInSandbox(entry: ObjectCatalogEntry, steps: (api: ScenarioApi) => void): ScenarioWorkspace {
  const store = useLaunchStore;
  const saved = store.getState();
  const keep = {
    workspaces: saved.workspaces,
    currentObjectId: saved.currentObjectId,
    scenarioId: saved.scenarioId,
    inputs: saved.inputs,
    session: saved.session,
    auditLog: saved.auditLog,
    lastError: saved.lastError,
    role: saved.role,
    actor: saved.actor,
  };
  const persistence = saved.persistence;
  registerSandbox(entry);
  const t0 = performance.now();
  try {
    return withMutedNotifications(() => {
      store.setState({ persistence: noopPersistence, role: 'LAUNCH_ENGINEER', actor: 'Инженер запуска' });
      // Повторный прогон – с чистого листа (Reset Scenario)
      store.setState((s) => {
        const { [entry.id]: _drop, ...rest } = s.workspaces;
        return { workspaces: rest };
      });
      if (store.getState().currentObjectId === entry.id) store.setState({ currentObjectId: null });
      store.getState().selectObject(entry.id);
      const g = () => store.getState();
      const api: ScenarioApi = {
        start: (st) => g().startStage(st),
        validate: (st) => g().validateStage(st),
        confirm: (st) => {
          for (const req of g().ruleset.confirmations[st]) {
            g().addEvidence({ stageId: st, type: req.evidenceTypes[0]!, title: `${req.title} – материал сценария` });
            const ev = g().session!.evidence.at(-1)!;
            g().addConfirmation({ stageId: st, requirementId: req.id, role: req.role, confirmedBy: g().actor, evidenceIds: [ev.id] });
          }
        },
        complete: (st) => g().completeStage(st),
        pass: (st) => {
          api.start(st);
          api.validate(st);
          api.confirm(st);
          return api.complete(st);
        },
        controlTest: (assetId, scenario) => {
          const inp = g().inputs!;
          const asset = controlAssets(inp.passport, inp.telemetry?.report, benchState).find((a) => a.assetId === assetId)!;
          g().runControlTest({ assetId, valueKw: suggestedValue(asset, scenario), scenario });
        },
        publishDashboard: () => g().publishDashboard(),
        reviewDashboard: (result) => g().reviewDashboard({ result, blocks: DASHBOARD_BLOCK_IDS.map((blockId) => ({ blockId, correct: result === 'ACCEPTED' })), ...(result === 'REJECTED' ? { comment: 'Отклонено в сценарии' } : {}) }),
        role: (r) => g().setRole(r),
        importInvoice: (report) => g().importInvoiceReport(report),
        importPassport: (p) => g().importPassport(p),
        source: (kind, available, error) => g().setSourceStatus(kind, { available, ...(error ? { error } : {}), checkedAt: new Date().toISOString() }),
        inputs: () => g().inputs!,
        session: () => g().session!,
      };
      steps(api);
      const s = g();
      const rejections = s.auditLog.filter((e) => e.action === 'TRANSITION_REJECTED').map((e) => ({ code: String(e.payload?.code ?? ''), message: String(e.payload?.message ?? ''), ...(e.stageId ? { stageId: e.stageId } : {}) }));
      return { session: s.session!, inputs: s.inputs!, auditLog: s.auditLog, rejections, durationMs: Math.round(performance.now() - t0) };
    });
  } finally {
    // Восстановить приложение пользователя; результат песочницы – отдельным рабочим пространством (можно открыть)
    const sandbox = store.getState();
    const ws = sandbox.session && sandbox.inputs && sandbox.currentObjectId === entry.id ? { [entry.id]: { scenarioId: entry.scenarioId, inputs: sandbox.inputs, session: sandbox.session, auditLog: sandbox.auditLog } } : {};
    store.setState({ ...keep, workspaces: { ...keep.workspaces, ...ws }, persistence });
  }
}

export interface Check {
  label: string;
  pass: boolean;
  actual: string;
}

export interface ScenarioOutcome {
  statuses: Record<StageId, StageStatus>;
  ready: boolean;
  /** Открытые препятствия (правила). */
  blockers: string[];
  workspace: ScenarioWorkspace;
}

export function outcome(w: ScenarioWorkspace, ruleset: Parameters<typeof objectReadiness>[2]): ScenarioOutcome {
  return {
    statuses: Object.fromEntries(STAGE_IDS.map((id) => [id, w.session.stages[id].status])) as Record<StageId, StageStatus>,
    ready: objectReadiness(w.session, w.inputs, ruleset).ready,
    blockers: [...new Set(w.session.blockers.filter((b) => b.status === 'OPEN').map((b) => b.ruleId ?? b.title))],
    workspace: w,
  };
}

/** Ложно завершённые этапы: завершены, но последняя проверка этапа содержит блокирующий провал. */
export const falseCompletions = (s: LaunchSession) => STAGE_IDS.filter((id) => s.stages[id].status === 'COMPLETED' && hasBlockingFailures(s.stages[id].validationResults)).length;

/** Подтверждения обязательных проверок завершённых этапов: источник (входы снимка), результат, время, версия правила. */
export function evidenceCoverage(w: ScenarioWorkspace): { covered: number; total: number } {
  let covered = 0;
  let total = 0;
  for (const id of STAGE_IDS) {
    if (w.session.stages[id].status !== 'COMPLETED') continue;
    const snap = (w.inputs.validationHistory ?? []).filter((h) => h.stageId === id).at(-1);
    for (const r of w.session.stages[id].validationResults.filter((x) => x.blocking)) {
      total++;
      if (snap && snap.inputs.length && r.status && r.evaluatedAt && r.rulesetVersion) covered++;
    }
  }
  return { covered, total };
}
