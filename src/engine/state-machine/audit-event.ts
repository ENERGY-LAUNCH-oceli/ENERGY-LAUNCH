import type { AuditAction, AuditEvent, IsoDateTime, LaunchSession, StageId } from '@/types';
import type { EngineContext } from '../context';

export interface AuditEventOptions {
  stageId?: StageId;
  payload?: Record<string, unknown>;
  /** Момент события, если он известен точнее «сейчас» (например, создание команды). */
  timestamp?: IsoDateTime;
}

/**
 * Запись журнала аудита: кто, когда, по какой сессии и версии правил. Единственная фабрика событий –
 * автомат и хранилище не собирают записи вручную. Без сессии (отказ в правах до выбора объекта) –
 * только действие, автор и время.
 */
export function auditEvent(ctx: EngineContext, session: Pick<LaunchSession, 'id' | 'objectId' | 'rulesetVersion'> | null, action: AuditAction, opts: AuditEventOptions = {}): AuditEvent {
  return {
    id: ctx.newId(),
    action,
    actor: ctx.actor,
    timestamp: opts.timestamp ?? ctx.now(),
    ...(session ? { sessionId: session.id, objectId: session.objectId, rulesetVersion: session.rulesetVersion } : {}),
    ...(opts.stageId ? { stageId: opts.stageId } : {}),
    ...(opts.payload ? { payload: opts.payload } : {}),
  };
}
