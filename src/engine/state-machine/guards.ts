import type { ConfirmationRequirement, LaunchSession, RulesConfig, StageId } from '@/types';
import { getPrerequisites, getPreviousStage } from '../dependencies';
import { hasBlockingFailures } from '../validators';
import type { TransitionError } from './errors';

export const openBlockers = (session: LaunchSession, stageId: StageId) =>
  session.blockers.filter((b) => b.stageId === stageId && b.status === 'OPEN');

/** Предыдущий этап должен быть завершён. */
export function guardPreviousCompleted(session: LaunchSession, stageId: StageId): TransitionError | null {
  const prev = getPreviousStage(stageId);
  if (prev && session.stages[prev].status !== 'COMPLETED') {
    const open = getPrerequisites(stageId).filter((id) => session.stages[id].status !== 'COMPLETED');
    return {
      code: 'PREVIOUS_STAGE_NOT_COMPLETED',
      stageId,
      message: `Этап ${stageId} недоступен: не завершены этапы ${open.join(', ')}`,
      details: { previousStageId: prev, previousStatus: session.stages[prev].status, dependencies: open.map((id) => ({ stageId: id, status: session.stages[id].status })) },
    };
  }
  return null;
}

/** Завершённые этапы, чьи подтверждения устарели после изменения входов (ТЗ 2.2 п. 4). */
export const staleConfirmationStages = (session: LaunchSession, stageIds: readonly StageId[]): StageId[] =>
  stageIds.filter((id) => session.stages[id].confirmations.some((c) => c.staleSince));

/** Неудовлетворённые обязательные подтверждения этапа. */
export function getUnmetConfirmations(
  session: LaunchSession,
  stageId: StageId,
  config: RulesConfig,
): ConfirmationRequirement[] {
  const stage = session.stages[stageId];
  const evidenceById = new Map(session.evidence.map((e) => [e.id, e]));
  return config.confirmations[stageId].filter((req) => {
    const confirmation = stage.confirmations.find((c) => c.requirementId === req.id && c.role === req.role);
    // Устаревшее подтверждение (входы изменились после него) не засчитывается до повторного подтверждения
    if (!confirmation || confirmation.staleSince) return true;
    const validEvidence = confirmation.evidenceIds.filter((id) => {
      const ev = evidenceById.get(id);
      return ev && ev.stageId === stageId && req.evidenceTypes.includes(ev.type);
    });
    return validEvidence.length < req.minEvidence;
  });
}

/** Полный набор условий завершения этапа. Возвращает первую найденную причину отказа. */
export function guardCanComplete(session: LaunchSession, stageId: StageId, config: RulesConfig): TransitionError | null {
  const prevError = guardPreviousCompleted(session, stageId);
  if (prevError) return prevError;

  const stage = session.stages[stageId];
  if (stage.status !== 'IN_PROGRESS') {
    return {
      code: stage.status === 'BLOCKED' ? 'OPEN_BLOCKERS' : 'INVALID_TRANSITION',
      stageId,
      from: stage.status,
      to: 'COMPLETED',
      message: `Этап ${stageId} в статусе ${stage.status} не может быть завершён`,
    };
  }

  const blockers = openBlockers(session, stageId);
  if (blockers.length > 0) {
    return {
      code: 'OPEN_BLOCKERS',
      stageId,
      message: `Есть открытые блокеры: ${blockers.length}`,
      details: { blockerIds: blockers.map((b) => b.id) },
    };
  }

  if (!stage.lastValidatedAt || stage.validationResults.length === 0) {
    return { code: 'VALIDATION_NOT_RUN', stageId, message: 'Проверки этапа не запускались' };
  }
  if (hasBlockingFailures(stage.validationResults)) {
    const failed = stage.validationResults.filter((r) => r.blocking && r.status !== 'PASSED').map((r) => r.ruleId);
    return { code: 'VALIDATION_FAILED', stageId, message: `Не пройдены правила: ${failed.join(', ')}`, details: { ruleIds: failed } };
  }

  const unmet = getUnmetConfirmations(session, stageId, config);
  if (unmet.length > 0) {
    return {
      code: 'MISSING_CONFIRMATIONS',
      stageId,
      message: `Нет обязательных подтверждений: ${unmet.map((r) => r.id).join(', ')}`,
      details: { requirementIds: unmet.map((r) => r.id) },
    };
  }

  // Данные предыдущих этапов изменились после их подтверждения – запуск не продолжается на устаревших подтверждениях
  const stale = staleConfirmationStages(session, getPrerequisites(stageId));
  if (stale.length > 0) {
    return {
      code: 'MISSING_CONFIRMATIONS',
      stageId,
      message: `Подтверждения этапов ${stale.join(', ')} устарели после изменения данных – обновите их на странице этапа`,
      details: { staleStages: stale },
    };
  }
  return null;
}
