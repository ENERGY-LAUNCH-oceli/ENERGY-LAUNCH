import { AUDIT_ACTION_LABEL } from '@/config/labels';
import type { AuditEvent, LaunchInputs, LaunchSession, StageId, StageStatus, ValidationSnapshot } from '@/types';

/** Выгрузка журнала объекта (ТЗ 2.2 п. 6, пакет сдачи п. 5): записи аудита и история проверок в полном формате. */
export interface JournalExport {
  objectId: string;
  objectName: string;
  sessionId: string;
  rulesetVersion: string;
  exportedAt: string;
  stages: Record<StageId, StageStatus>;
  events: readonly AuditEvent[];
  validationHistory: readonly ValidationSnapshot[];
}

export function journalExport(session: LaunchSession, inputs: LaunchInputs, events: readonly AuditEvent[], exportedAt: string): JournalExport {
  return {
    objectId: session.objectId,
    objectName: inputs.object.name,
    sessionId: session.id,
    rulesetVersion: session.rulesetVersion,
    exportedAt,
    stages: Object.fromEntries(Object.entries(session.stages).map(([id, st]) => [id, st.status])) as Record<StageId, StageStatus>,
    events,
    validationHistory: inputs.validationHistory ?? [],
  };
}

const actionLabel = (action: string) => (AUDIT_ACTION_LABEL as Record<string, string>)[action] ?? action;

/** Строки CSV журнала: заголовок и по строке на событие (кодирование – `toCsv`). */
export function journalRows(events: readonly AuditEvent[]): string[][] {
  const head = ['Время (UTC)', 'Действие', 'Код действия', 'Автор', 'Этап', 'Версия правил', 'Данные'];
  return [head, ...events.map((e) => [e.timestamp, actionLabel(e.action), e.action, e.actor, e.stageId ?? '', e.rulesetVersion ?? '', e.payload ? JSON.stringify(e.payload) : ''])];
}
