import type {
  AuditAction,
  AuditEvent,
  Blocker,
  Evidence,
  LaunchSession,
  LaunchStage,
  RulesConfig,
  Severity,
  StageConfirmation,
  StageId,
  ValidationResult,
} from '@/types';
import type { EngineContext } from '../context';
import { getNextStage } from '../dependencies';
import { getRule, isKnownRule } from '../rules';
import type { TransitionError } from './errors';
import { guardCanComplete, guardPreviousCompleted, openBlockers } from './guards';
import { canTransition } from './transitions';

/**
 * Конечный автомат запуска. Все операции – чистые функции:
 * (session, …, ctx) → новая session + события аудита, либо ошибка перехода.
 * Исходная сессия никогда не мутируется.
 */
export type MachineResult =
  | { ok: true; session: LaunchSession; events: AuditEvent[] }
  | { ok: false; error: TransitionError; events: AuditEvent[] };

// ─── внутренние утилиты ─────────────────────────────────────────────────

function audit(
  ctx: EngineContext,
  session: LaunchSession,
  action: AuditAction,
  stageId?: StageId,
  payload?: Record<string, unknown>,
): AuditEvent {
  return {
    id: ctx.newId(),
    action,
    actor: ctx.actor,
    timestamp: ctx.now(),
    sessionId: session.id,
    objectId: session.objectId,
    rulesetVersion: session.rulesetVersion,
    ...(stageId ? { stageId } : {}),
    ...(payload ? { payload } : {}),
  };
}

function reject(ctx: EngineContext, session: LaunchSession, error: TransitionError): MachineResult {
  return {
    ok: false,
    error,
    events: [audit(ctx, session, 'TRANSITION_REJECTED', error.stageId, { code: error.code, message: error.message })],
  };
}

function patchStage(session: LaunchSession, stageId: StageId, patch: Partial<LaunchStage>, now: string): LaunchSession {
  return { ...session, updatedAt: now, stages: { ...session.stages, [stageId]: { ...session.stages[stageId], ...patch } } };
}

function guardActive(ctx: EngineContext, session: LaunchSession, stageId?: StageId): MachineResult | null {
  if (session.status !== 'ACTIVE') {
    return reject(ctx, session, { code: 'SESSION_NOT_ACTIVE', ...(stageId ? { stageId } : {}), message: `Сессия в статусе ${session.status}` });
  }
  return null;
}

function guardRuleset(ctx: EngineContext, session: LaunchSession, config: RulesConfig): MachineResult | null {
  if (config.version !== session.rulesetVersion) {
    return reject(ctx, session, {
      code: 'RULESET_MISMATCH',
      message: `Сессия использует правила ${session.rulesetVersion}, передано ${config.version}`,
    });
  }
  return null;
}

/**
 * Пересчёт статуса BLOCKED ↔ IN_PROGRESS по открытым блокерам.
 * Не трогает NOT_STARTED и COMPLETED.
 */
function syncBlockedStatus(session: LaunchSession, stageId: StageId, ctx: EngineContext): { session: LaunchSession; events: AuditEvent[] } {
  const stage = session.stages[stageId];
  const hasOpen = openBlockers(session, stageId).length > 0;
  const now = ctx.now();
  if (hasOpen && stage.status === 'IN_PROGRESS' && canTransition('IN_PROGRESS', 'BLOCKED')) {
    const next = patchStage(session, stageId, { status: 'BLOCKED', blockedAt: now }, now);
    return { session: next, events: [audit(ctx, next, 'STAGE_BLOCKED', stageId)] };
  }
  if (!hasOpen && stage.status === 'BLOCKED' && canTransition('BLOCKED', 'IN_PROGRESS')) {
    const next = patchStage(session, stageId, { status: 'IN_PROGRESS' }, now);
    return { session: next, events: [audit(ctx, next, 'STAGE_UNBLOCKED', stageId)] };
  }
  return { session, events: [] };
}

// ─── публичные операции ─────────────────────────────────────────────────

/** START: NOT_STARTED → IN_PROGRESS. Требует завершения предыдущего этапа. */
export function startStage(session: LaunchSession, stageId: StageId, ctx: EngineContext): MachineResult {
  const inactive = guardActive(ctx, session, stageId);
  if (inactive) return inactive;

  const stage = session.stages[stageId];
  if (!canTransition(stage.status, 'IN_PROGRESS') || stage.status !== 'NOT_STARTED') {
    return reject(ctx, session, {
      code: 'INVALID_TRANSITION',
      stageId,
      from: stage.status,
      to: 'IN_PROGRESS',
      message: `Нельзя начать этап ${stageId} из статуса ${stage.status}`,
    });
  }
  const prevError = guardPreviousCompleted(session, stageId);
  if (prevError) return reject(ctx, session, prevError);

  const now = ctx.now();
  const next = { ...patchStage(session, stageId, { status: 'IN_PROGRESS', startedAt: now }, now), currentStageId: stageId };
  return { ok: true, session: next, events: [audit(ctx, next, 'STAGE_STARTED', stageId)] };
}

/**
 * Применяет результаты проверок к этапу:
 * – сохраняет результаты;
 * – открывает блокер на каждое проваленное блокирующее правило (без дублей);
 * – автоматически закрывает VALIDATION-блокеры правил, которые теперь пройдены;
 * – пересчитывает BLOCKED ↔ IN_PROGRESS.
 */
export function applyValidationResults(
  session: LaunchSession,
  stageId: StageId,
  results: ValidationResult[],
  config: RulesConfig,
  ctx: EngineContext,
): MachineResult {
  const inactive = guardActive(ctx, session, stageId) ?? guardRuleset(ctx, session, config);
  if (inactive) return inactive;

  const stage = session.stages[stageId];
  if (stage.status !== 'IN_PROGRESS' && stage.status !== 'BLOCKED') {
    return reject(ctx, session, {
      code: 'INVALID_TRANSITION',
      stageId,
      from: stage.status,
      message: `Проверки можно применять только к этапу в работе (сейчас ${stage.status})`,
    });
  }

  const now = ctx.now();
  const events: AuditEvent[] = [];
  const failedBlocking = new Map(results.filter((r) => r.blocking && r.status === 'FAILED').map((r) => [r.ruleId, r]));

  const blockers: Blocker[] = session.blockers.map((b) => {
    if (b.stageId === stageId && b.status === 'OPEN' && b.source === 'VALIDATION' && b.ruleId && !failedBlocking.has(b.ruleId)) {
      events.push(audit(ctx, session, 'BLOCKER_RESOLVED', stageId, { blockerId: b.id, ruleId: b.ruleId, auto: true }));
      return { ...b, status: 'RESOLVED', resolvedAt: now, resolvedBy: ctx.actor, resolution: 'Правило пройдено при повторной проверке' };
    }
    // Препятствие всё ещё открыто – описание по последней проверке (после новой выгрузки число нарушений могло измениться)
    const latest = b.stageId === stageId && b.status === 'OPEN' && b.source === 'VALIDATION' && b.ruleId ? failedBlocking.get(b.ruleId) : undefined;
    if (latest && (latest.message !== b.description || latest.severity !== b.severity)) return { ...b, description: latest.message, severity: latest.severity };
    return b;
  });

  const alreadyOpen = new Set(blockers.filter((b) => b.stageId === stageId && b.status === 'OPEN' && b.ruleId).map((b) => b.ruleId));
  for (const [ruleId, result] of failedBlocking) {
    if (alreadyOpen.has(ruleId)) continue;
    const title = isKnownRule(ruleId) ? getRule(ruleId).title : ruleId;
    const blocker: Blocker = {
      id: ctx.newId(),
      sessionId: session.id,
      stageId,
      title: `${ruleId}: ${title}`,
      description: result.message,
      severity: result.severity,
      status: 'OPEN',
      source: 'VALIDATION',
      ruleId,
      createdAt: now,
      createdBy: ctx.actor,
    };
    blockers.push(blocker);
    events.push(audit(ctx, session, 'BLOCKER_OPENED', stageId, { blockerId: blocker.id, ruleId }));
  }

  let next: LaunchSession = {
    ...patchStage(session, stageId, { validationResults: results, lastValidatedAt: now }, now),
    blockers,
  };
  events.unshift(
    audit(ctx, next, 'VALIDATION_RUN', stageId, {
      total: results.length,
      failed: results.filter((r) => r.status === 'FAILED').map((r) => r.ruleId),
      warnings: results.filter((r) => r.status === 'WARNING').map((r) => r.ruleId),
    }),
  );

  const synced = syncBlockedStatus(next, stageId, ctx);
  next = synced.session;
  return { ok: true, session: next, events: [...events, ...synced.events] };
}

/** Ручной блокер (например, замечание сетевой организации). Переводит этап в BLOCKED. */
export function addManualBlocker(
  session: LaunchSession,
  stageId: StageId,
  input: { title: string; description: string; severity: Severity },
  ctx: EngineContext,
): MachineResult {
  const inactive = guardActive(ctx, session, stageId);
  if (inactive) return inactive;
  const stage = session.stages[stageId];
  if (stage.status === 'COMPLETED' || stage.status === 'NOT_STARTED') {
    return reject(ctx, session, { code: 'INVALID_TRANSITION', stageId, from: stage.status, to: 'BLOCKED', message: `Нельзя заблокировать этап в статусе ${stage.status}` });
  }
  const now = ctx.now();
  const blocker: Blocker = {
    id: ctx.newId(),
    sessionId: session.id,
    stageId,
    ...input,
    status: 'OPEN',
    source: 'MANUAL',
    createdAt: now,
    createdBy: ctx.actor,
  };
  const withBlocker: LaunchSession = { ...session, updatedAt: now, blockers: [...session.blockers, blocker] };
  const synced = syncBlockedStatus(withBlocker, stageId, ctx);
  return { ok: true, session: synced.session, events: [audit(ctx, withBlocker, 'BLOCKER_OPENED', stageId, { blockerId: blocker.id }), ...synced.events] };
}

/**
 * Закрытие блокера. VALIDATION-блокер нельзя закрыть вручную как RESOLVED –
 * только повторной успешной проверкой; допускается WAIVED с обоснованием.
 */
export function resolveBlocker(
  session: LaunchSession,
  blockerId: string,
  input: { resolution: string; status?: 'RESOLVED' | 'WAIVED' },
  ctx: EngineContext,
): MachineResult {
  const inactive = guardActive(ctx, session);
  if (inactive) return inactive;
  const blocker = session.blockers.find((b) => b.id === blockerId);
  if (!blocker || blocker.status !== 'OPEN') {
    return reject(ctx, session, { code: 'NOT_FOUND', message: `Открытый блокер ${blockerId} не найден` });
  }
  const status = input.status ?? 'RESOLVED';
  if (blocker.source === 'VALIDATION' && status === 'RESOLVED') {
    return reject(ctx, session, {
      code: 'VALIDATION_FAILED',
      stageId: blocker.stageId,
      message: 'Блокер проверки закрывается повторным прогоном проверок либо явным отказом (WAIVED)',
    });
  }
  if (!input.resolution.trim()) {
    return reject(ctx, session, { code: 'INVALID_TRANSITION', stageId: blocker.stageId, message: 'Требуется обоснование закрытия блокера' });
  }
  const now = ctx.now();
  const updated: LaunchSession = {
    ...session,
    updatedAt: now,
    blockers: session.blockers.map((b) =>
      b.id === blockerId ? { ...b, status, resolvedAt: now, resolvedBy: ctx.actor, resolution: input.resolution } : b,
    ),
  };
  const synced = syncBlockedStatus(updated, blocker.stageId, ctx);
  return {
    ok: true,
    session: synced.session,
    events: [audit(ctx, updated, 'BLOCKER_RESOLVED', blocker.stageId, { blockerId, status }), ...synced.events],
  };
}

/** Добавление доказательства к этапу (не к завершённому). */
export function addEvidence(
  session: LaunchSession,
  evidence: Omit<Evidence, 'id' | 'sessionId' | 'createdAt' | 'createdBy'>,
  ctx: EngineContext,
): MachineResult {
  const inactive = guardActive(ctx, session, evidence.stageId);
  if (inactive) return inactive;
  const stage = session.stages[evidence.stageId];
  if (stage.status === 'COMPLETED') {
    return reject(ctx, session, { code: 'INVALID_TRANSITION', stageId: evidence.stageId, from: stage.status, message: `Нельзя добавлять доказательства к этапу в статусе ${stage.status}` });
  }
  const now = ctx.now();
  const item: Evidence = { ...evidence, id: ctx.newId(), sessionId: session.id, createdAt: now, createdBy: ctx.actor };
  const next: LaunchSession = { ...session, updatedAt: now, evidence: [...session.evidence, item] };
  return { ok: true, session: next, events: [audit(ctx, next, 'EVIDENCE_ADDED', item.stageId, { evidenceId: item.id, type: item.type })] };
}

/** Подтверждение обязательного требования. Требование и роль должны существовать в наборе правил. */
export function addConfirmation(
  session: LaunchSession,
  input: Omit<StageConfirmation, 'id' | 'confirmedAt'>,
  config: RulesConfig,
  ctx: EngineContext,
): MachineResult {
  const inactive = guardActive(ctx, session, input.stageId) ?? guardRuleset(ctx, session, config);
  if (inactive) return inactive;
  const stage = session.stages[input.stageId];
  if (stage.status === 'NOT_STARTED' || stage.status === 'COMPLETED') {
    return reject(ctx, session, { code: 'INVALID_TRANSITION', stageId: input.stageId, from: stage.status, message: `Нельзя подтверждать этап в статусе ${stage.status}` });
  }
  const requirement = config.confirmations[input.stageId].find((r) => r.id === input.requirementId);
  if (!requirement || requirement.role !== input.role) {
    return reject(ctx, session, { code: 'MISSING_CONFIRMATIONS', stageId: input.stageId, message: `Требование ${input.requirementId} для роли ${input.role} не найдено` });
  }
  const unknownEvidence = input.evidenceIds.filter((id) => !session.evidence.some((e) => e.id === id && e.stageId === input.stageId));
  if (unknownEvidence.length) {
    return reject(ctx, session, { code: 'NOT_FOUND', stageId: input.stageId, message: `Доказательства не найдены: ${unknownEvidence.join(', ')}` });
  }
  const now = ctx.now();
  const confirmation: StageConfirmation = { ...input, id: ctx.newId(), confirmedAt: now };
  const confirmations = [...stage.confirmations.filter((c) => c.requirementId !== input.requirementId), confirmation];
  const next = patchStage(session, input.stageId, { confirmations }, now);
  return { ok: true, session: next, events: [audit(ctx, next, 'CONFIRMATION_ADDED', input.stageId, { requirementId: input.requirementId, role: input.role })] };
}

/**
 * COMPLETE: IN_PROGRESS → COMPLETED.
 * Условия: предыдущий этап завершён, нет открытых блокеров, проверки запускались
 * и все блокирующие правила пройдены, все обязательные подтверждения получены.
 * После завершения последнего этапа сессия переходит в COMPLETED.
 */
export function completeStage(session: LaunchSession, stageId: StageId, config: RulesConfig, ctx: EngineContext): MachineResult {
  const inactive = guardActive(ctx, session, stageId) ?? guardRuleset(ctx, session, config);
  if (inactive) return inactive;
  const error = guardCanComplete(session, stageId, config);
  if (error) return reject(ctx, session, error);

  const now = ctx.now();
  const nextStageId = getNextStage(stageId);
  let next: LaunchSession = {
    ...patchStage(session, stageId, { status: 'COMPLETED', completedAt: now }, now),
    currentStageId: nextStageId ?? stageId,
  };
  const events = [audit(ctx, next, 'STAGE_COMPLETED', stageId)];
  if (!nextStageId) {
    next = { ...next, status: 'COMPLETED', completedAt: now };
    events.push(audit(ctx, next, 'SESSION_COMPLETED'));
  }
  return { ok: true, session: next, events };
}

/**
 * Обновление устаревшего подтверждения завершённого этапа (ТЗ 2.2 п. 4). Этап не переоткрывается, но подтверждение
 * снова засчитывается только после проверки этапа на текущих входах без блокирующих ошибок – обойти проверки нельзя.
 * Доступно и после завершения запуска: изменение входов снимает готовность, обновлённое подтверждение её возвращает.
 */
export function renewConfirmation(
  session: LaunchSession,
  input: { stageId: StageId; requirementId: string; role: StageConfirmation['role']; confirmedBy: string },
  results: readonly ValidationResult[],
  config: RulesConfig,
  ctx: EngineContext,
): MachineResult {
  const bad = guardRuleset(ctx, session, config);
  if (bad) return bad;
  const { stageId } = input;
  const stage = session.stages[stageId];
  const old = stage.confirmations.find((c) => c.requirementId === input.requirementId && c.role === input.role);
  if (stage.status !== 'COMPLETED' || !old?.staleSince) {
    return reject(ctx, session, { code: 'INVALID_TRANSITION', stageId, from: stage.status, message: 'Обновить можно только устаревшее подтверждение завершённого этапа' });
  }
  const requirement = config.confirmations[stageId].find((r) => r.id === input.requirementId && r.role === input.role);
  if (!requirement) {
    return reject(ctx, session, { code: 'MISSING_CONFIRMATIONS', stageId, message: `Требование ${input.requirementId} для роли ${input.role} не найдено` });
  }
  const failed = results.filter((r) => r.blocking && (r.status === 'FAILED' || r.status === 'SKIPPED')).map((r) => r.ruleId);
  if (!results.length || failed.length) {
    return reject(ctx, session, {
      code: 'VALIDATION_FAILED',
      stageId,
      message: results.length ? `Проверки этапа на текущих данных не пройдены: ${failed.join(', ')}. Подтверждение не обновлено` : 'Проверки этапа не выполнены',
      details: { ruleIds: failed },
    });
  }
  const now = ctx.now();
  const evidence: Evidence = { id: ctx.newId(), sessionId: session.id, stageId, type: requirement.evidenceTypes[0]!, title: `${requirement.title} – повторная проверка`, createdAt: now, createdBy: ctx.actor };
  const confirmation: StageConfirmation = { stageId, requirementId: input.requirementId, role: input.role, confirmedBy: input.confirmedBy, evidenceIds: [evidence.id], id: ctx.newId(), confirmedAt: now };
  const confirmations = [...stage.confirmations.filter((c) => c.requirementId !== input.requirementId), confirmation];
  const next: LaunchSession = { ...patchStage(session, stageId, { confirmations, validationResults: [...results], lastValidatedAt: now }, now), evidence: [...session.evidence, evidence] };
  return {
    ok: true,
    session: next,
    events: [
      audit(ctx, next, 'VALIDATION_RUN', stageId, { total: results.length, failed: [], warnings: results.filter((r) => r.status === 'WARNING').map((r) => r.ruleId), trigger: 'RENEWAL' }),
      audit(ctx, next, 'EVIDENCE_ADDED', stageId, { evidenceId: evidence.id, type: evidence.type }),
      audit(ctx, next, 'CONFIRMATION_ADDED', stageId, { requirementId: input.requirementId, role: input.role, renewed: true, staleSince: old.staleSince }),
    ],
  };
}

/**
 * Устаревание подтверждений (ТЗ 2.2 п. 4): после изменения уже проверенных входов подтверждения затронутых
 * этапов перестают засчитываться до повторного подтверждения. Ничего не удаляется – подтверждение получает
 * отметку staleSince и остаётся в истории. Завершённые этапы не переоткрываются (терминальный статус),
 * но их устаревшие подтверждения видны в реестре и протоколе.
 */
export function markConfirmationsStale(session: LaunchSession, stageIds: readonly StageId[], reason: string, ctx: EngineContext): MachineResult {
  const now = ctx.now();
  let next = session;
  const events: AuditEvent[] = [];
  for (const stageId of stageIds) {
    const stage = next.stages[stageId];
    const fresh = stage.confirmations.filter((c) => !c.staleSince);
    if (!fresh.length) continue;
    const confirmations = stage.confirmations.map((c) => (c.staleSince ? c : { ...c, staleSince: now, staleReason: reason }));
    next = patchStage(next, stageId, { confirmations }, now);
    events.push(audit(ctx, next, 'CONFIRMATIONS_STALE', stageId, { reason, requirementIds: fresh.map((c) => c.requirementId), stageStatus: stage.status }));
  }
  return { ok: true, session: next, events };
}
