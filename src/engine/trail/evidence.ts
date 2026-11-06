import type { InputRef, LaunchInputs, LaunchSession, RulesConfig, StageId, ValidationStatus } from '@/types';
import { getRule, isKnownRule } from '../rules';
import { changedInputs, configValue } from './inputs';

export type EvidenceKind = 'CHECK' | 'ARTIFACT' | 'CONFIRMATION' | 'COMMAND' | 'ACCEPTANCE';
/** Актуально – последний прогон на текущих входах; заменено – есть более поздний прогон; устарело – входы изменились. */
export type EvidenceState = 'CURRENT' | 'SUPERSEDED' | 'STALE';

export interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  objectId: string;
  stageId: StageId;
  /** Проверка (правило) или предмет подтверждения. */
  check: string;
  source: string;
  inputs: InputRef[];
  result: ValidationStatus | 'ACCEPTED' | 'REJECTED' | 'PASSED' | 'FAILED' | 'TIMEOUT' | 'CONFIRMED' | 'ATTACHED';
  message: string;
  at: string;
  rulesetVersion: string;
  params: Record<string, unknown>;
  author: string;
  state: EvidenceState;
  stateReason?: string;
  /** Снимок прогона, к которому относится запись (для проверок). */
  snapshotId?: string;
}

const SOURCE: Record<StageId, string> = {
  METER_HISTORY: 'invoice.csv · анализатор истории',
  REALTIME_TELEMETRY: 'telemetry.csv · анализатор телеметрии',
  ASSET_CONTROL: 'имитатор контроллера · журнал команд',
  FINAL_DASHBOARDS: 'конфигурация панели · приёмка',
};

/**
 * Реестр подтверждений объекта: каждая проверка каждого прогона (с входами и параметрами правила),
 * приложенные материалы, ручные подтверждения, тестовые команды, приёмки. Ничего не удаляется –
 * у устаревших записей есть причина.
 */
export function evidenceRecords(session: LaunchSession, inputs: LaunchInputs, ruleset: RulesConfig): EvidenceRecord[] {
  const out: EvidenceRecord[] = [];
  const history = (inputs.validationHistory ?? []).filter((s) => s.objectId === session.objectId);
  const latestByStage = new Map<StageId, string>();
  for (const s of history) latestByStage.set(s.stageId, s.id);

  for (const snap of history) {
    const latest = latestByStage.get(snap.stageId) === snap.id;
    const changed = latest ? changedInputs(snap, inputs) : [];
    const state: EvidenceState = !latest ? 'SUPERSEDED' : changed.length ? 'STALE' : 'CURRENT';
    const reason = !latest ? 'Заменено более поздним прогоном (сохранено в истории)' : changed.length ? `Входы изменились: ${changed.map((c) => c.label).join(', ')}` : undefined;
    const author = snap.trigger === 'MANUAL' ? snap.actor : snap.trigger === 'RECHECK' ? `Автоматическая повторная проверка${snap.reason ? ` (${snap.reason})` : ''}` : 'Автоматическая проверка при загрузке набора';
    for (const r of snap.results) {
      const rule = isKnownRule(r.ruleId) ? getRule(r.ruleId) : null;
      const v = rule?.configRef ? configValue(ruleset, rule.configRef) : undefined;
      out.push({
        id: r.id,
        kind: 'CHECK',
        objectId: snap.objectId,
        stageId: snap.stageId,
        check: rule ? `${rule.id} · ${rule.title}` : r.ruleId,
        source: SOURCE[snap.stageId],
        inputs: snap.inputs,
        result: r.status,
        message: r.message,
        at: r.evaluatedAt,
        rulesetVersion: r.rulesetVersion,
        params: { ...(rule?.configRef && v !== undefined ? { [rule.configRef]: v } : {}), ...(r.expected !== undefined ? { expected: r.expected } : {}), ...(r.actual !== undefined ? { actual: r.actual } : {}) },
        author,
        state,
        ...(reason ? { stateReason: reason } : {}),
        snapshotId: snap.id,
      });
    }
  }

  for (const e of session.evidence) {
    out.push({ id: e.id, kind: 'ARTIFACT', objectId: session.objectId, stageId: e.stageId, check: `${e.type} · ${e.title}`, source: e.fileName ?? 'материал этапа', inputs: [], result: 'ATTACHED', message: e.description ?? e.title, at: e.createdAt, rulesetVersion: session.rulesetVersion, params: {}, author: e.createdBy, state: 'CURRENT' });
  }
  for (const [stageId, stage] of Object.entries(session.stages) as [StageId, LaunchSession['stages'][StageId]][]) {
    for (const c of stage.confirmations) {
      out.push({
        id: c.id,
        kind: 'CONFIRMATION',
        objectId: session.objectId,
        stageId,
        check: `Подтверждение ${c.requirementId}`,
        source: `роль ${c.role}`,
        inputs: [],
        result: 'CONFIRMED',
        message: c.comment ?? `Доказательства: ${c.evidenceIds.join(', ')}`,
        at: c.confirmedAt,
        rulesetVersion: session.rulesetVersion,
        params: { evidenceIds: c.evidenceIds },
        author: c.confirmedBy,
        state: c.staleSince ? 'STALE' : 'CURRENT',
        ...(c.staleSince ? { stateReason: `Устарело ${c.staleSince.slice(0, 16).replace('T', ' ')}: ${c.staleReason ?? 'входы изменились'}` } : {}),
      });
    }
  }
  for (const c of inputs.controlCommands ?? []) {
    if (c.objectId !== session.objectId) continue;
    out.push({ id: c.commandId, kind: 'COMMAND', objectId: c.objectId, stageId: 'ASSET_CONTROL', check: `${c.ruleId} · тест ${c.assetId}`, source: `${c.transport} · ${c.signals.received}`, inputs: [], result: c.state, message: c.reason, at: c.createdAt, rulesetVersion: c.rulesetVersion, params: { valueKw: c.input.valueKw, ackTimeoutSec: c.expected.ackTimeoutSec, responseWindowSec: c.expected.responseWindowSec, toleranceKw: c.expected.toleranceKw, seed: c.seed }, author: c.actor, state: 'CURRENT' });
  }
  const pubVersion = inputs.dashboard?.published?.version;
  for (const a of inputs.dashboard?.acceptances ?? []) {
    if (a.objectId !== session.objectId) continue;
    out.push({ id: a.id, kind: 'ACCEPTANCE', objectId: a.objectId, stageId: 'FINAL_DASHBOARDS', check: `Приёмка панели v${a.configVersion}`, source: 'рабочая панель объекта', inputs: [{ kind: 'dashboard', label: `конфигурация панели v${a.configVersion}`, version: a.configVersion }], result: a.result, message: a.comment ?? `Блоков отмечено корректными: ${a.blocks.filter((b) => b.correct).length} из ${a.blocks.length}`, at: a.at, rulesetVersion: session.rulesetVersion, params: { configVersion: a.configVersion }, author: a.author, state: pubVersion === a.configVersion ? 'CURRENT' : 'STALE', ...(pubVersion !== a.configVersion ? { stateReason: `Опубликована v${pubVersion ?? '–'}` } : {}) });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
