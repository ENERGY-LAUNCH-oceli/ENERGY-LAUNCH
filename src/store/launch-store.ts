import { create } from 'zustand';
import { env } from '@/config/env';
import { getRuleset } from '@/config/rules';
import { DEFAULT_SCENARIO_ID, loadScenario } from '@/data/scenarios';
import { OBJECT_CATALOG, findObject, loadObjectInputs, replaceObjectCatalog, seedWorkspace } from '@/data/objects';
import { startCase4Job, type Case4Job, type Case4Manifest, type Case4Progress } from '@/data/case4';
import { notify } from './notifications-store';
import {
  addConfirmation,
  addEvidence,
  completeStage,
  createEngineContext,
  markConfirmationsStale,
  createLaunchSession,
  resolveBlocker,
  startStage,
  validateStage,
  type MachineResult,
  type TransitionError,
} from '@/engine';
import { auditRepository, saveLaunchInputs, sessionRepository } from '@/services';
import { makeInvoiceRun } from '@/engine/invoice';
import type { InvoiceReport, SitePassport, TelemetryReport } from '@/types';
import { makeTelemetryRun } from '@/engine/telemetry';
import { controlAssets, executeControlTest, makeControlRun, nextCommandId } from '@/engine/control';
import { AFFECTED_STAGES, inputRef, makeSnapshot, type ShaResolver } from '@/engine/trail';
import { createSimulatorTransport } from '@/simulator/control';
import type { AccessAction, BlockReview, ControlTestCommand, DemoRole, InputKind, SimScenario, SourceStatus } from '@/types';
import { acceptDashboard, AccessDeniedError, can, changeDashboard, DashboardRuleError, publishDashboard, ROLE_TITLE, type DashboardActor, type DashboardChange } from '@/engine/dashboards';
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

/** Состояние запуска одного объекта. */
export interface ObjectWorkspace {
  scenarioId: string | null;
  inputs: LaunchInputs;
  session: LaunchSession;
  auditLog: AuditEvent[];
}

interface LaunchState {
  actor: string;
  /** Демонстрационная роль: права проверяются в каждом действии, а не только в интерфейсе. */
  role: DemoRole;
  setRole(role: DemoRole): void;
  /** Этап 4: изменение черновика, публикация, приёмка рабочей панели. */
  updateDashboard(change: DashboardChange): boolean;
  publishDashboard(): boolean;
  reviewDashboard(input: { result: 'ACCEPTED' | 'REJECTED'; blocks: BlockReview[]; comment?: string }): boolean;
  currentObjectId: string | null;
  /** Сохранённые состояния других объектов портфеля. */
  workspaces: Record<string, ObjectWorkspace>;
  selectObject(objectId: string): void;
  /** Детерминированно заполняет демо-портфель (воспроизводимые состояния шести объектов). */
  initPortfolio(force?: boolean): void;
  /** Источник портфеля: набор кейса 4 (public/case4) или синтетический демо-портфель. */
  dataSource: 'CASE4' | 'SYNTHETIC' | null;
  dataManifest: Case4Manifest | null;
  dataErrors: string[];
  /** Загрузка набора кейса 4; без набора – синтетический портфель. */
  bootstrap(onProgress?: (p: Case4Progress) => void): Promise<void>;
  /** Набор разобран (данные готовы к передаче в основной поток). */
  dataPrepared: boolean;
  /** Забрать разобранный набор и заполнить портфель – вызывается в паузе анимации прелоадера. */
  commitBootstrap(): Promise<void>;
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
  /** Новая загрузка invoice.csv: новая версия набора, предыдущая уходит в историю. */
  importInvoiceReport(report: InvoiceReport): void;
  /** Новая загрузка telemetry.csv или исправленного object.json – новая версия; прежняя в истории. */
  importTelemetryReport(report: TelemetryReport): void;
  importPassport(passport: SitePassport): void;
  /** Тест управления через локальный имитатор. Реальные команды не отправляются. */
  runControlTest(input: { assetId: string; valueKw: number; scenario: SimScenario }): ControlTestCommand | null;
  /** Доступность источника (API или файл). Изменение запускает повторную проверку зависимого этапа. */
  setSourceStatus(kind: 'invoice' | 'telemetry', status: SourceStatus): void;
}

/** Фоновая загрузка набора кейса 4 (одна на сессию приложения). */
let bootJob: Case4Job | null = null;

const reportPersistError = (e: unknown) => console.error('[launch-store] persist failed', e);

/** Единственный транспорт команд – локальный имитатор. */
const controlTransport = createSimulatorTransport();

const OUTCOME_LABEL = { PASSED: 'Passed', FAILED: 'Failed', TIMEOUT: 'Timeout' } as const;

/**
 * Presentation-адаптер над движком: хранит состояние для UI, делегирует
 * все решения конечному автомату и сохраняет результат в Data Layer.
 */
export const useLaunchStore = create<LaunchState>()((set, get) => {
  const ctx = () => createEngineContext(get().actor);

  /** Применить результат движка: обновить состояние, журнал, сохранить. */
  const commit = (result: MachineResult): boolean => {
    const { persistence } = get();
    if (!result.ok) notify({ tone: 'warning', title: 'Переход отклонён', description: result.error.message });
    for (const e of result.events) {
      if (e.action === 'STAGE_COMPLETED') notify({ tone: 'success', title: 'Этап завершён', description: e.stageId ?? '' });
      if (e.action === 'STAGE_BLOCKED') notify({ tone: 'error', title: 'Этап заблокирован', description: 'Найдены препятствия – см. панель этапа' });
      if (e.action === 'SESSION_COMPLETED') notify({ tone: 'success', title: 'Объект готов к эксплуатации' });
    }
    if (env.debugStateMachine) console.debug('[state-machine]', result);
    set((s) => ({
      auditLog: [...s.auditLog, ...result.events],
      ...(result.ok ? { session: result.session, lastError: null } : { lastError: result.error }),
    }));
    void persistence.appendAudit(result.events).catch(reportPersistError);
    if (result.ok) void persistence.saveSession(result.session).catch(reportPersistError);
    return result.ok;
  };

  /** Проверка права роли. Отказ – уведомление и запись ACCESS_DENIED в журнал аудита. */
  const denied = (action: AccessAction): boolean => {
    const { role, session } = get();
    if (can(role, action)) return false;
    const c = ctx();
    const err = new AccessDeniedError(role, action);
    const event: AuditEvent = { id: c.newId(), action: 'ACCESS_DENIED', actor: c.actor, timestamp: c.now(), ...(session ? { sessionId: session.id, objectId: session.objectId, rulesetVersion: session.rulesetVersion } : {}), payload: { role, action, message: err.message } };
    set((s) => ({ auditLog: [...s.auditLog, event] }));
    void get().persistence.appendAudit([event]).catch(reportPersistError);
    notify({ tone: 'warning', title: 'Нет прав', description: err.message });
    return true;
  };

  /** SHA-256 файлов набора кейса 4 – ссылки на неизменяемые версии входов в снимках проверок. */
  const sha: ShaResolver = (objectId, fileName) => {
    return findObject(objectId)?.fileHashes?.[fileName];
  };

  /**
   * Прогон проверок этапа: применяет результаты к автомату, пишет историю прогонов этапа и снимок
   * (входы, результаты, статус до и после). Права проверяет вызывающий; RECHECK выполняет система.
   */
  const runValidation = (stageId: StageId, trigger: 'MANUAL' | 'RECHECK', reason?: string): boolean => {
    const { inputs, ruleset, session: before } = get();
    if (!inputs || !before) return false;
    const c = ctx();
    const statusBefore = before.stages[stageId].status;
    const ok = withSession((s) => validateStage(s, stageId, inputs, ruleset, c));
    if (!ok) return false;
    const session = get().session!;
    const results = session.stages[stageId].validationResults;
    const at = session.stages[stageId].lastValidatedAt ?? c.now();
    let cur = get().inputs!;
    if (stageId === 'REALTIME_TELEMETRY') cur = { ...cur, telemetryRuns: [...(cur.telemetryRuns ?? []), makeTelemetryRun(cur.telemetry, cur.passport, results, ruleset.telemetry, ruleset.version, at, cur.telemetryRuns ?? [])] };
    if (stageId === 'ASSET_CONTROL' && ruleset.controlTesting) cur = { ...cur, controlRuns: [...(cur.controlRuns ?? []), makeControlRun(cur.controlCommands ?? [], results, ruleset.controlTesting, ruleset.version, at, cur.controlRuns ?? [])] };
    if (stageId === 'METER_HISTORY') cur = { ...cur, invoiceRuns: [...(cur.invoiceRuns ?? []), makeInvoiceRun(cur.invoice, results, ruleset.meterHistory, ruleset.version, at, cur.invoiceRuns ?? [])] };
    const snapshot = makeSnapshot({ id: c.newId(), session, stageId, inputs: cur, results, statusBefore, at, actor: c.actor, trigger, ...(reason ? { reason } : {}), sha });
    set({ inputs: { ...cur, validationHistory: [...(cur.validationHistory ?? []), snapshot] } });
    return true;
  };

  /**
   * Изменение уже проверенных входов (ТЗ 2.2 п. 4): подтверждения затронутых этапов устаревают,
   * предыдущие результаты остаются в истории, начатые этапы проверяются повторно системой, статусы пересчитываются.
   */
  const invalidate = (kind: InputKind, reason: string) => {
    const { session, inputs } = get();
    if (!session || !inputs) return;
    const stages = AFFECTED_STAGES[kind];
    const c = ctx();
    withSession((s) => markConfirmationsStale(s, stages, reason, c));
    const cur = get().inputs!;
    const marks = stages.map((stageId) => ({ stageId, at: c.now(), reason, input: inputRef(kind, cur, sha) }));
    set({ inputs: { ...cur, staleMarks: [...(cur.staleMarks ?? []), ...marks] } });
    for (const stageId of stages) {
      const st = get().session!.stages[stageId];
      // Публикация панели – момент её проверки; остальные этапы перепроверяются, если уже проверялись
      if ((st.status === 'IN_PROGRESS' || st.status === 'BLOCKED') && (st.lastValidatedAt || (kind === 'dashboard' && stageId === 'FINAL_DASHBOARDS'))) runValidation(stageId, 'RECHECK', reason);
    }
  };

  /** Повторная проверка этапа 4 после приёмки (выполняется системой, а не ролью). */
  const revalidateDashboards = () => {
    const st = get().session?.stages.FINAL_DASHBOARDS.status;
    if (st === 'IN_PROGRESS' || st === 'BLOCKED') runValidation('FINAL_DASHBOARDS', 'RECHECK', 'приёмка панели');
  };

  /** Действие с рабочей панелью: ошибки прав и правил превращаются в уведомление и журнал. */
  const dashboardAction = (label: string, fn: (actor: DashboardActor) => void): boolean => {
    const { inputs, session } = get();
    if (!inputs?.dashboard || !session) return false;
    const c = ctx();
    const actor: DashboardActor = { name: c.actor, role: get().role, now: c.now(), newId: c.newId };
    try {
      if (session.stages.FINAL_DASHBOARDS.status === 'COMPLETED') throw new DashboardRuleError('Этап 4 завершён: конфигурация и приёмка зафиксированы');
      fn(actor);
      return true;
    } catch (e) {
      if (e instanceof AccessDeniedError) {
        denied(e.action);
        return false;
      }
      if (e instanceof DashboardRuleError) {
        notify({ tone: 'warning', title: `${label}: отклонено`, description: e.message });
        return false;
      }
      throw e;
    }
  };

  const withSession = (fn: (session: LaunchSession) => MachineResult): boolean => {
    const { session } = get();
    if (!session) return false;
    return commit(fn(session));
  };

  return {
    actor: ROLE_TITLE.LAUNCH_ENGINEER,
    role: 'LAUNCH_ENGINEER',
    setRole: (role) => {
      set({ role, actor: ROLE_TITLE[role] });
      notify({ tone: 'info', title: `Роль: ${ROLE_TITLE[role]}`, description: 'Демонстрационная роль – права действуют на всех экранах' });
    },

    updateDashboard: (change) =>
      dashboardAction('Изменение панели', (actor) => {
        const { inputs, session } = get();
        const ws = changeDashboard(inputs!.dashboard!, change, actor);
        set((s) => ({
          inputs: { ...inputs!, dashboard: ws },
          auditLog: [...s.auditLog, { id: actor.newId(), action: 'DASHBOARD_UPDATED' as const, actor: actor.name, timestamp: actor.now, sessionId: session!.id, objectId: session!.objectId, stageId: 'FINAL_DASHBOARDS' as const, rulesetVersion: session!.rulesetVersion, payload: { ...change, draftVersion: ws.draft.version } }],
        }));
      }),

    publishDashboard: () =>
      dashboardAction('Публикация', (actor) => {
        const { inputs, session } = get();
        const ws = publishDashboard(inputs!.dashboard!, session!.objectId, actor);
        const event: AuditEvent = { id: actor.newId(), action: 'DASHBOARD_PUBLISHED', actor: actor.name, timestamp: actor.now, sessionId: session!.id, objectId: session!.objectId, stageId: 'FINAL_DASHBOARDS', rulesetVersion: session!.rulesetVersion, payload: { version: ws.published!.version, objectId: ws.published!.objectId } };
        set((s) => ({ inputs: { ...inputs!, dashboard: ws }, auditLog: [...s.auditLog, event] }));
        void get().persistence.appendAudit([event]).catch(reportPersistError);
        notify({ tone: 'info', title: `Опубликована версия v${ws.published!.version}`, description: 'Передайте панель ответственному за приёмку' });
        invalidate('dashboard', `опубликована конфигурация панели v${ws.published!.version}`);
      }),

    reviewDashboard: (input) =>
      dashboardAction('Приёмка', (actor) => {
        const { inputs, session } = get();
        const { ws, acceptance } = acceptDashboard(inputs!.dashboard!, session!.objectId, input, actor);
        const event: AuditEvent = { id: actor.newId(), action: 'DASHBOARD_ACCEPTANCE', actor: actor.name, timestamp: actor.now, sessionId: session!.id, objectId: session!.objectId, stageId: 'FINAL_DASHBOARDS', rulesetVersion: session!.rulesetVersion, payload: { result: acceptance.result, configVersion: acceptance.configVersion, objectId: acceptance.objectId, role: acceptance.role, blocks: acceptance.blocks } };
        set((s) => ({ inputs: { ...inputs!, dashboard: ws }, auditLog: [...s.auditLog, event] }));
        void get().persistence.appendAudit([event]).catch(reportPersistError);
        notify({ tone: acceptance.result === 'ACCEPTED' ? 'success' : 'warning', title: acceptance.result === 'ACCEPTED' ? `Панель v${acceptance.configVersion} принята` : `Панель v${acceptance.configVersion} отклонена`, description: acceptance.result === 'ACCEPTED' ? 'Этап 4 можно завершить' : 'Этап остаётся заблокированным до исправления и новой приёмки' });
        revalidateDashboards();
      }),

    currentObjectId: null,
    workspaces: {},
    dataSource: null,
    dataManifest: null,
    dataErrors: [],
    dataPrepared: false,

    bootstrap: async (onProgress) => {
      if (get().dataSource || bootJob) return;
      if (env.dataset === 'synthetic') {
        set({ dataSource: 'SYNTHETIC', dataPrepared: true });
        get().initPortfolio(true);
        return;
      }
      bootJob = startCase4Job(onProgress);
      try {
        await bootJob.ready;
      } catch (e) {
        console.error('[bootstrap] набор кейса 4 не загружен', e);
      }
      set({ dataPrepared: true });
    },

    commitBootstrap: async () => {
      if (get().dataSource) return;
      let loaded: Awaited<ReturnType<Case4Job['take']>> = null;
      try {
        loaded = bootJob ? await bootJob.take() : null;
      } catch (e) {
        console.error('[bootstrap] набор кейса 4 не загружен', e);
      }
      if (loaded?.entries.length) {
        replaceObjectCatalog(loaded.entries);
        set({ dataSource: 'CASE4', dataManifest: loaded.manifest, dataErrors: loaded.errors });
      } else set({ dataSource: 'SYNTHETIC' });
      get().initPortfolio(true);
    },
    scenarioId: null,
    ruleset: getRuleset(env.rulesetVersion),
    inputs: null,
    session: null,
    auditLog: [],
    lastError: null,
    persistence: dexiePersistence,

    setPersistence: (persistence) => set({ persistence }),

    selectObject: (objectId) => {
      const s = get();
      if (s.currentObjectId === objectId) return;
      const entry = findObject(objectId);
      if (!entry) return;
      const workspaces = { ...s.workspaces };
      if (s.currentObjectId && s.session && s.inputs) {
        workspaces[s.currentObjectId] = { scenarioId: s.scenarioId, inputs: s.inputs, session: s.session, auditLog: s.auditLog };
      }
      const saved = workspaces[objectId] ?? seedWorkspace(entry, s.ruleset);
      delete workspaces[objectId];
      set({ workspaces, currentObjectId: objectId, ...saved, lastError: null });
      void s.persistence.saveInputs(saved.inputs).then(() => s.persistence.saveSession(saved.session)).catch(reportPersistError);
    },

    loadScenario: (id = DEFAULT_SCENARIO_ID) => {
      const loaded = loadScenario(id);
      const { ruleset, persistence, currentObjectId } = get();
      const entry = findObject(currentObjectId ?? undefined);
      const scenario = entry ? { ...loaded, inputs: loadObjectInputs({ ...entry, scenarioId: id }) } : loaded;
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

    initPortfolio: (force = false) => {
      const s = get();
      if (!force && s.currentObjectId) return;
      const workspaces: Record<string, ObjectWorkspace> = {};
      for (const entry of OBJECT_CATALOG) workspaces[entry.id] = seedWorkspace(entry, s.ruleset);
      const first = OBJECT_CATALOG[0]!.id;
      const { [first]: current, ...rest } = workspaces;
      set({ workspaces: rest, currentObjectId: first, ...current!, lastError: null });
    },

    startStage: (stageId) => !denied('launch.manage') && withSession((s) => startStage(s, stageId, ctx())),

    validateStage: (stageId) => {
      if (denied('launch.manage')) return false;
      return runValidation(stageId, 'MANUAL');
    },

    importTelemetryReport: (report) => {
      if (denied('launch.manage')) return;
      const { inputs, session } = get();
      if (!inputs || !session) return;
      const c = ctx();
      const prev = inputs.telemetry;
      const version = (prev?.version ?? 0) + 1;
      const dataset = { kind: 'TELEMETRY' as const, id: `telemetry-${session.objectId}-v${version}`, objectId: session.objectId, version, report };
      set((s) => ({
        inputs: { ...inputs, telemetry: dataset, telemetryHistory: [...(inputs.telemetryHistory ?? []), ...(prev ? [prev] : [])] },
        auditLog: [...s.auditLog, { id: c.newId(), action: 'DATASET_IMPORTED' as const, actor: c.actor, timestamp: c.now(), sessionId: session.id, objectId: session.objectId, stageId: 'REALTIME_TELEMETRY' as const, rulesetVersion: session.rulesetVersion, payload: { fileName: report.meta.fileName, version, rows: report.meta.rows } }],
      }));
      if (session.stages.REALTIME_TELEMETRY.status !== 'COMPLETED') get().addEvidence({ stageId: 'REALTIME_TELEMETRY', type: 'FILE', title: `telemetry.csv v${version}`, fileName: report.meta.fileName, sizeBytes: report.meta.sizeBytes, mimeType: 'text/csv' });
      notify({ tone: 'info', title: `Загружена телеметрия v${version}`, description: `${report.meta.rows.toLocaleString('ru-RU')} строк` });
      invalidate('telemetry', `загружена telemetry.csv v${version}`);
    },

    importPassport: (passport) => {
      if (denied('launch.manage')) return;
      const { inputs, session } = get();
      if (!inputs || !session) return;
      const c = ctx();
      const prev = inputs.passport;
      const next = { ...passport, version: (prev?.version ?? 0) + 1 };
      set((s) => ({
        inputs: { ...inputs, passport: next, passportHistory: [...(inputs.passportHistory ?? []), ...(prev ? [prev] : [])] },
        auditLog: [...s.auditLog, { id: c.newId(), action: 'DATASET_IMPORTED' as const, actor: c.actor, timestamp: c.now(), sessionId: session.id, objectId: session.objectId, stageId: 'REALTIME_TELEMETRY' as const, rulesetVersion: session.rulesetVersion, payload: { fileName: passport.fileName, kind: 'object.json', version: next.version, assets: next.assets.map((a) => a.assetId) } }],
      }));
      notify({ tone: 'info', title: `Паспорт объекта v${next.version}`, description: 'Карта сигналов обновлена' });
      invalidate('passport', `изменён паспорт object.json v${next.version} (карта сигналов)`);
    },

    runControlTest: ({ assetId, valueKw, scenario }) => {
      if (denied('launch.manage')) return null;
      const { inputs, session, ruleset } = get();
      const rules = ruleset.controlTesting;
      if (!inputs || !session || !rules) return null;
      const asset = controlAssets(inputs.passport, inputs.telemetry?.report, controlTransport.describe).find((a) => a.assetId === assetId);
      if (!asset || !asset.supported) return null;
      const c = ctx();
      const existing = inputs.controlCommands ?? [];
      const command = executeControlTest(
        { objectId: session.objectId, asset, valueKw, scenario, commandId: nextCommandId(inputs.object.code, existing), createdAt: c.now(), actor: c.actor, rulesetVersion: session.rulesetVersion },
        rules,
        controlTransport,
      );
      const event: AuditEvent = {
        id: c.newId(),
        action: 'CONTROL_COMMAND',
        actor: c.actor,
        timestamp: command.createdAt,
        sessionId: session.id,
        objectId: session.objectId,
        stageId: 'ASSET_CONTROL',
        rulesetVersion: session.rulesetVersion,
        payload: { commandId: command.commandId, assetId, valueKw, scenario, transport: command.transport, state: command.state, reason: command.reason },
      };
      set((s) => ({ inputs: { ...inputs, controlCommands: [...existing, command] }, auditLog: [...s.auditLog, event] }));
      void get().persistence.appendAudit([event]).catch(reportPersistError);
      if (session.stages.ASSET_CONTROL.status !== 'COMPLETED') {
        get().addEvidence({ stageId: 'ASSET_CONTROL', type: 'COMMAND_LOG', title: `${command.commandId} · ${assetId} · ${valueKw} кВт · ${OUTCOME_LABEL[command.state]}`, description: command.reason, mimeType: 'application/json' });
      }
      notify({
        tone: command.state === 'PASSED' ? 'success' : 'warning',
        title: `${command.commandId}: ${OUTCOME_LABEL[command.state]}`,
        description: command.state === 'PASSED' ? 'Запустите проверки этапа, чтобы учесть результат' : command.reason,
      });
      invalidate('control', `выполнен тест ${command.commandId}`);
      return command;
    },

    setSourceStatus: (kind, status) => {
      const { inputs, session } = get();
      if (!inputs || !session) return;
      const prev = inputs.sources?.[kind];
      // Время последней успешной проверки сохраняется при недоступности
      const lastSuccessAt = status.available ? status.checkedAt : (status.lastSuccessAt ?? prev?.lastSuccessAt ?? session.stages[kind === 'invoice' ? 'METER_HISTORY' : 'REALTIME_TELEMETRY'].lastValidatedAt);
      const next: SourceStatus = { ...status, ...(lastSuccessAt ? { lastSuccessAt } : {}) };
      set({ inputs: { ...inputs, sources: { ...inputs.sources, [kind]: next } } });
      if (!status.available) notify({ tone: 'error', title: 'Источник недоступен', description: `${status.error ?? kind}${lastSuccessAt ? ` · последняя успешная проверка ${lastSuccessAt.slice(0, 16).replace('T', ' ')} UTC` : ''}` });
      const stageId = kind === 'invoice' ? 'METER_HISTORY' : 'REALTIME_TELEMETRY';
      const st = get().session!.stages[stageId];
      if ((st.status === 'IN_PROGRESS' || st.status === 'BLOCKED') && st.lastValidatedAt) runValidation(stageId, 'RECHECK', status.available ? `источник ${kind} снова доступен` : `источник ${kind} недоступен`);
    },

    importInvoiceReport: (report) => {
      if (denied('launch.manage')) return;
      const { inputs, session } = get();
      if (!inputs || !session) return;
      const c = ctx();
      const prev = inputs.invoice;
      const version = (prev?.version ?? 0) + 1;
      const dataset = {
        kind: 'INVOICE' as const,
        id: `invoice-${session.objectId}-v${version}`,
        objectId: session.objectId,
        source: report.meta.source === 'DEMO' ? ('DEMO' as const) : ('CSV_IMPORT' as const),
        fileName: report.meta.fileName,
        importedAt: report.meta.uploadedAt,
        periodStart: report.period.first ?? report.meta.uploadedAt,
        periodEnd: report.period.last ?? report.meta.uploadedAt,
        version,
        report,
      };
      const event: AuditEvent = {
        id: c.newId(),
        action: 'DATASET_IMPORTED',
        actor: c.actor,
        timestamp: c.now(),
        sessionId: session.id,
        objectId: session.objectId,
        stageId: 'METER_HISTORY',
        rulesetVersion: session.rulesetVersion,
        payload: { fileName: report.meta.fileName, version, rows: report.meta.rows, sizeBytes: report.meta.sizeBytes },
      };
      set((s) => ({
        inputs: { ...inputs, invoice: dataset, invoiceHistory: [...(inputs.invoiceHistory ?? []), ...(prev ? [prev] : [])] },
        auditLog: [...s.auditLog, event],
      }));
      if (session.stages.METER_HISTORY.status !== 'COMPLETED') {
        get().addEvidence({ stageId: 'METER_HISTORY', type: 'FILE', title: `invoice.csv v${version}`, fileName: report.meta.fileName, sizeBytes: report.meta.sizeBytes, mimeType: 'text/csv' });
      }
      notify({ tone: 'info', title: `Загружена выгрузка v${version}`, description: `${report.meta.rows.toLocaleString('ru-RU')} строк` });
      invalidate('invoice', `загружена invoice.csv v${version}`);
    },

    completeStage: (stageId) => {
      if (denied('launch.manage')) return false;
      const { inputs, session } = get();
      // Изменённые входные данные делают результат проверки неактуальным (ТЗ 2.2.4)
      const lastRun = inputs?.invoiceRuns?.at(-1);
      const tRun = inputs?.telemetryRuns?.at(-1);
      const cRun = inputs?.controlRuns?.at(-1);
      const staleMsg =
        stageId === 'METER_HISTORY' && inputs?.invoice && lastRun && lastRun.datasetVersion !== inputs.invoice.version
          ? `Загружена версия v${inputs.invoice.version}, а проверялась v${lastRun.datasetVersion}: повторите проверку`
          : stageId === 'REALTIME_TELEMETRY' && tRun && ((inputs?.telemetry?.version ?? 0) !== tRun.datasetVersion || (inputs?.passport?.version ?? 0) !== tRun.passportVersion)
            ? `Телеметрия или паспорт изменены после проверки (данные v${inputs?.telemetry?.version ?? 0}, паспорт v${inputs?.passport?.version ?? 0}): повторите проверку`
            : stageId === 'ASSET_CONTROL' && cRun && (inputs?.controlCommands?.length ?? 0) !== cRun.commandsCount
              ? `После проверки выполнены новые тесты управления (${(inputs?.controlCommands?.length ?? 0) - cRun.commandsCount}): повторите проверку`
              : null;
      if (session && staleMsg) {
        const c = ctx();
        const error = { code: 'VALIDATION_NOT_RUN' as const, stageId, message: staleMsg };
        set((s) => ({
          lastError: error,
          auditLog: [...s.auditLog, { id: c.newId(), action: 'TRANSITION_REJECTED' as const, actor: c.actor, timestamp: c.now(), sessionId: session.id, objectId: session.objectId, stageId, rulesetVersion: session.rulesetVersion, payload: { code: error.code, message: error.message } }],
        }));
        notify({ tone: 'warning', title: 'Переход отклонён', description: error.message });
        return false;
      }
      return withSession((s) => completeStage(s, stageId, get().ruleset, ctx()));
    },

    resolveBlocker: (blockerId, resolution, status) =>
      !denied('launch.manage') &&
      withSession((s) => resolveBlocker(s, blockerId, { resolution, ...(status ? { status } : {}) }, ctx())),

    addEvidence: (evidence) => !denied('launch.manage') && withSession((s) => addEvidence(s, evidence, ctx())),

    addConfirmation: (input) => !denied('launch.manage') && withSession((s) => addConfirmation(s, input, get().ruleset, ctx())),

    clearError: () => set({ lastError: null }),
  };
});
