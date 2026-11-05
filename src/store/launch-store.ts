import { create } from 'zustand';
import { env } from '@/config/env';
import { getRuleset } from '@/config/rules';
import { DEFAULT_SCENARIO_ID, loadScenario } from '@/data/scenarios';
import {
  addConfirmation,
  addEvidence,
  completeStage,
  createEngineContext,
  createLaunchSession,
  resolveBlocker,
  startStage,
  validateStage,
  type MachineResult,
  type TransitionError,
} from '@/engine';
import { auditRepository, saveLaunchInputs, sessionRepository } from '@/services';
import type { AuditEvent, Evidence, LaunchInputs, LaunchSession, RulesConfig, StageConfirmation, StageId } from '@/types';

/** Адаптер сохранения: подменяется в тестах. */
export interface LaunchPersistence {
  saveInputs(inputs: LaunchInputs): Promise<void>;
  saveSession(session: LaunchSession): Promise<void>;
  appendAudit(events: readonly AuditEvent[]): Promise<void>;
}

export const dexiePersistence: LaunchPersistence = {
  saveInputs: saveLaunchInputs,
  saveSession: sessionRepository.save,
  appendAudit: auditRepository.append,
};

export const noopPersistence: LaunchPersistence = {
  saveInputs: async () => {},
  saveSession: async () => {},
  appendAudit: async () => {},
};

interface LaunchState {
  actor: string;
  scenarioId: string | null;
  ruleset: RulesConfig;
  inputs: LaunchInputs | null;
  session: LaunchSession | null;
  auditLog: AuditEvent[];
  lastError: TransitionError | null;
  persistence: LaunchPersistence;

  setPersistence(p: LaunchPersistence): void;
  loadScenario(id: string): void;
  startStage(stageId: StageId): boolean;
  validateStage(stageId: StageId): boolean;
  completeStage(stageId: StageId): boolean;
  resolveBlocker(blockerId: string, resolution: string, status?: 'RESOLVED' | 'WAIVED'): boolean;
  addEvidence(evidence: Omit<Evidence, 'id' | 'sessionId' | 'createdAt' | 'createdBy'>): boolean;
  addConfirmation(input: Omit<StageConfirmation, 'id' | 'confirmedAt'>): boolean;
  clearError(): void;
}

const reportPersistError = (e: unknown) => console.error('[launch-store] persist failed', e);

/**
 * Presentation-адаптер над движком: хранит состояние для UI, делегирует
 * все решения конечному автомату и сохраняет результат в Data Layer.
 */
export const useLaunchStore = create<LaunchState>()((set, get) => {
  const ctx = () => createEngineContext(get().actor);

  /** Применить результат движка: обновить состояние, журнал, сохранить. */
  const commit = (result: MachineResult): boolean => {
    const { persistence } = get();
    if (env.debugStateMachine) console.debug('[state-machine]', result);
    set((s) => ({
      auditLog: [...s.auditLog, ...result.events],
      ...(result.ok ? { session: result.session, lastError: null } : { lastError: result.error }),
    }));
    void persistence.appendAudit(result.events).catch(reportPersistError);
    if (result.ok) void persistence.saveSession(result.session).catch(reportPersistError);
    return result.ok;
  };

  const withSession = (fn: (session: LaunchSession) => MachineResult): boolean => {
    const { session } = get();
    if (!session) return false;
    return commit(fn(session));
  };

  return {
    actor: 'demo-user',
    scenarioId: null,
    ruleset: getRuleset(env.rulesetVersion),
    inputs: null,
    session: null,
    auditLog: [],
    lastError: null,
    persistence: dexiePersistence,

    setPersistence: (persistence) => set({ persistence }),

    loadScenario: (id = DEFAULT_SCENARIO_ID) => {
      const scenario = loadScenario(id);
      const { ruleset, persistence } = get();
      const c = ctx();
      const session = createLaunchSession(scenario.inputs.object.id, ruleset.version, c);
      const created: AuditEvent = {
        id: c.newId(),
        action: 'SESSION_CREATED',
        actor: c.actor,
        timestamp: c.now(),
        sessionId: session.id,
        objectId: session.objectId,
        rulesetVersion: session.rulesetVersion,
        payload: { scenarioId: id },
      };
      set({ scenarioId: id, inputs: scenario.inputs, session, auditLog: [created], lastError: null });
      void persistence
        .saveInputs(scenario.inputs)
        .then(() => persistence.saveSession(session))
        .then(() => persistence.appendAudit([created]))
        .catch(reportPersistError);
    },

    startStage: (stageId) => withSession((s) => startStage(s, stageId, ctx())),

    validateStage: (stageId) => {
      const { inputs, ruleset } = get();
      if (!inputs) return false;
      return withSession((s) => validateStage(s, stageId, inputs, ruleset, ctx()));
    },

    completeStage: (stageId) => withSession((s) => completeStage(s, stageId, get().ruleset, ctx())),

    resolveBlocker: (blockerId, resolution, status) =>
      withSession((s) => resolveBlocker(s, blockerId, { resolution, ...(status ? { status } : {}) }, ctx())),

    addEvidence: (evidence) => withSession((s) => addEvidence(s, evidence, ctx())),

    addConfirmation: (input) => withSession((s) => addConfirmation(s, input, get().ruleset, ctx())),

    clearError: () => set({ lastError: null }),
  };
});
