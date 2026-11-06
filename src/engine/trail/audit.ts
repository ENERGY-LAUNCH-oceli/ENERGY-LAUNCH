import { STAGE_IDS, type AuditAction, type AuditEvent, type StageId, type StageStatus, type ValidationSnapshot } from '@/types';

/** Категории журнала аудита (ТЗ фазы 10, п. 4). */
export const AUDIT_CATEGORIES = ['FILE', 'CHECK', 'RECHECK', 'CONFIG', 'SIGNAL_MAP', 'COMMAND', 'CONTROL_CONFIRM', 'STATUS', 'ACCEPTANCE', 'TRANSITION', 'ACCESS', 'OTHER'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_TITLE: Record<AuditCategory, string> = {
  FILE: 'Загрузка файлов',
  CHECK: 'Запуск проверок',
  RECHECK: 'Повторная проверка',
  CONFIG: 'Изменение конфигурации',
  SIGNAL_MAP: 'Изменение карты сигналов',
  COMMAND: 'Создание команды',
  CONTROL_CONFIRM: 'Подтверждение управления',
  STATUS: 'Изменение статусов',
  ACCEPTANCE: 'Приёмка дашбордов',
  TRANSITION: 'Переход между этапами',
  ACCESS: 'Отказ в доступе',
  OTHER: 'Прочее',
};

/** Запись журнала аудита в полном формате фазы 10. */
export interface AuditRecord {
  eventId: string;
  timestamp: string;
  actor: string;
  objectId: string;
  action: AuditAction;
  category: AuditCategory;
  entity: string;
  previousValue: string | null;
  newValue: string | null;
  result: 'OK' | 'REJECTED' | 'FAILED' | 'PASSED' | 'DENIED' | 'INFO';
  ruleVersion: string;
  stageId?: StageId;
  event: AuditEvent;
}

type Statuses = Record<StageId, StageStatus>;
const initial = (): Statuses => Object.fromEntries(STAGE_IDS.map((id) => [id, 'NOT_STARTED'])) as Statuses;
const s = (v: unknown) => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Журнал в формате event_id / timestamp / actor / object_id / action / entity / previous_value / new_value /
 * result / rule_version. Предыдущие значения восстанавливаются проходом по событиям в хронологическом порядке.
 */
export function auditRecords(events: readonly AuditEvent[], history: readonly ValidationSnapshot[] = []): AuditRecord[] {
  const sorted = [...events].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  const statuses = new Map<string, Statuses>();
  const versions = new Map<string, number>();
  const out: AuditRecord[] = [];
  for (const e of sorted) {
    const oid = e.objectId ?? '–';
    const st = statuses.get(oid) ?? initial();
    statuses.set(oid, st);
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const stage = e.stageId;
    const base = { eventId: e.id, timestamp: e.timestamp, actor: e.actor, objectId: oid, action: e.action, ruleVersion: e.rulesetVersion ?? '–', ...(stage ? { stageId: stage } : {}), event: e };
    const move = (to: StageStatus): Pick<AuditRecord, 'previousValue' | 'newValue'> => {
      const prev = stage ? st[stage] : null;
      if (stage) st[stage] = to;
      return { previousValue: prev, newValue: to };
    };
    let rec: Omit<AuditRecord, keyof typeof base>;
    switch (e.action) {
      case 'STAGE_STARTED':
        rec = { category: 'TRANSITION', entity: `этап ${stage}`, ...move('IN_PROGRESS'), result: 'OK' };
        break;
      case 'STAGE_COMPLETED':
        rec = { category: 'TRANSITION', entity: `этап ${stage}`, ...move('COMPLETED'), result: 'OK' };
        break;
      case 'STAGE_BLOCKED':
        rec = { category: 'STATUS', entity: `этап ${stage}`, ...move('BLOCKED'), result: 'INFO' };
        break;
      case 'STAGE_UNBLOCKED':
        rec = { category: 'STATUS', entity: `этап ${stage}`, ...move('IN_PROGRESS'), result: 'INFO' };
        break;
      case 'SESSION_CREATED':
        rec = { category: 'STATUS', entity: 'сессия запуска', previousValue: null, newValue: 'ACTIVE', result: 'OK' };
        break;
      case 'SESSION_COMPLETED':
        rec = { category: 'STATUS', entity: 'сессия запуска', previousValue: 'ACTIVE', newValue: 'COMPLETED', result: 'OK' };
        break;
      case 'TRANSITION_REJECTED':
        rec = { category: 'TRANSITION', entity: stage ? `этап ${stage}` : 'переход', previousValue: stage ? st[stage] : null, newValue: s(p.code), result: 'REJECTED' };
        break;
      case 'VALIDATION_RUN': {
        const ts = Date.parse(e.timestamp);
        const snap = history.find((h) => h.objectId === oid && h.stageId === stage && Math.abs(Date.parse(h.at) - ts) < 2000);
        const failed = (p.failed as string[] | undefined) ?? [];
        rec = {
          category: snap?.trigger === 'RECHECK' ? 'RECHECK' : 'CHECK',
          entity: `проверки этапа ${stage}${snap ? ` · ${snap.inputs.map((i) => i.label).join(', ')}` : ''}`,
          previousValue: snap ? snap.statusBefore : stage ? st[stage] : null,
          newValue: failed.length ? `не пройдены: ${failed.join(', ')}` : `пройдены (${s(p.total)})`,
          result: failed.length ? 'FAILED' : 'PASSED',
        };
        break;
      }
      case 'DATASET_IMPORTED': {
        const kind = String(p.kind ?? (stage === 'METER_HISTORY' ? 'invoice.csv' : 'telemetry.csv'));
        const key = `${oid}/${kind}`;
        const prev = versions.get(key) ?? (Number(p.version) > 1 ? Number(p.version) - 1 : null);
        versions.set(key, Number(p.version));
        rec = { category: kind === 'object.json' ? 'SIGNAL_MAP' : 'FILE', entity: `${kind}${p.fileName ? ` (${s(p.fileName)})` : ''}`, previousValue: prev ? `v${prev}` : null, newValue: `v${s(p.version)}${p.rows ? ` · ${s(p.rows)} строк` : ''}`, result: 'OK' };
        break;
      }
      case 'CONTROL_COMMAND':
        rec = { category: 'COMMAND', entity: `команда ${s(p.commandId)} · ${s(p.assetId)}`, previousValue: null, newValue: `${s(p.valueKw)} кВт → ${s(p.state)}`, result: p.state === 'PASSED' ? 'PASSED' : 'FAILED' };
        break;
      case 'CONFIRMATION_ADDED':
        rec = { category: stage === 'ASSET_CONTROL' ? 'CONTROL_CONFIRM' : 'STATUS', entity: `подтверждение ${s(p.requirementId)}`, previousValue: null, newValue: `роль ${s(p.role)}`, result: 'OK' };
        break;
      case 'CONFIRMATIONS_STALE':
        rec = { category: 'STATUS', entity: `подтверждения этапа ${stage}: ${list(p.requirementIds)}`, previousValue: 'актуальны', newValue: 'устарели', result: 'INFO' };
        break;
      case 'DASHBOARD_UPDATED':
        rec = { category: 'CONFIG', entity: `черновик панели v${s(p.draftVersion)}`, previousValue: null, newValue: s(p.kind), result: 'OK' };
        break;
      case 'DASHBOARD_PUBLISHED':
        rec = { category: 'CONFIG', entity: 'конфигурация панели', previousValue: Number(p.version) > 1 ? `v${Number(p.version) - 1}` : null, newValue: `v${s(p.version)}`, result: 'OK' };
        break;
      case 'DASHBOARD_ACCEPTANCE':
        rec = { category: 'ACCEPTANCE', entity: `панель v${s(p.configVersion)}`, previousValue: null, newValue: s(p.result), result: p.result === 'ACCEPTED' ? 'PASSED' : 'FAILED' };
        break;
      case 'ACCESS_DENIED':
        rec = { category: 'ACCESS', entity: s(p.action) ?? 'действие', previousValue: null, newValue: s(p.role), result: 'DENIED' };
        break;
      case 'BLOCKER_OPENED':
        rec = { category: 'STATUS', entity: `препятствие ${s(p.ruleId) ?? s(p.blockerId)}`, previousValue: null, newValue: 'OPEN', result: 'INFO' };
        break;
      case 'BLOCKER_RESOLVED':
        rec = { category: 'STATUS', entity: `препятствие ${s(p.ruleId) ?? s(p.blockerId)}`, previousValue: 'OPEN', newValue: s(p.status) ?? 'RESOLVED', result: 'INFO' };
        break;
      case 'EVIDENCE_ADDED':
        rec = { category: 'OTHER', entity: `материал ${s(p.type)}`, previousValue: null, newValue: s(p.evidenceId), result: 'OK' };
        break;
      default:
        rec = { category: 'OTHER', entity: e.action, previousValue: null, newValue: s(e.payload), result: 'INFO' };
    }
    out.push({ ...base, ...rec });
  }
  return out;
}

const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '');

/** Состояние объекта на момент времени: статусы этапов, открытые препятствия и прогоны, на которых они основаны. */
export interface StateAt {
  at: string;
  statuses: Statuses;
  sessionCompleted: boolean;
  openBlockers: { rule: string; stageId?: StageId; since: string }[];
  lastRuns: { stageId: StageId; at: string; failed: string[]; inputs: string[]; rulesetVersion: string; trigger: string }[];
}

/** Воспроизведение: почему объект имел конкретный статус в конкретный момент (только по журналу и снимкам). */
export function stateAt(events: readonly AuditEvent[], history: readonly ValidationSnapshot[], objectId: string, at: string): StateAt {
  const recs = auditRecords(events.filter((e) => e.objectId === objectId && e.timestamp <= at), history);
  const statuses = initial();
  const open = new Map<string, { rule: string; stageId?: StageId; since: string }>();
  let completed = false;
  for (const r of recs) {
    if (r.stageId && r.newValue && ['TRANSITION', 'STATUS'].includes(r.category) && STAGE_IDS.includes(r.stageId) && ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'].includes(r.newValue)) statuses[r.stageId] = r.newValue as StageStatus;
    if (r.action === 'SESSION_COMPLETED') completed = true;
    const p = (r.event.payload ?? {}) as Record<string, unknown>;
    if (r.action === 'BLOCKER_OPENED') open.set(String(p.blockerId), { rule: String(p.ruleId ?? 'ручное'), ...(r.stageId ? { stageId: r.stageId } : {}), since: r.timestamp });
    if (r.action === 'BLOCKER_RESOLVED') open.delete(String(p.blockerId));
  }
  const lastRuns = STAGE_IDS.flatMap((stageId) => {
    const snap = history.filter((h) => h.objectId === objectId && h.stageId === stageId && h.at <= at).at(-1);
    return snap ? [{ stageId, at: snap.at, failed: snap.results.filter((x) => x.blocking && x.status !== 'PASSED' && x.status !== 'NOT_APPLICABLE').map((x) => x.ruleId), inputs: snap.inputs.map((i) => `${i.label}${i.sha256 ? ` · sha256 ${i.sha256.slice(0, 12)}…` : ''}`), rulesetVersion: snap.rulesetVersion, trigger: snap.trigger }] : [];
  });
  return { at, statuses, sessionCompleted: completed, openBlockers: [...open.values()], lastRuns };
}
