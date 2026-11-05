import type { AuditAction, CheckDimension, EvidenceType, ValidationStatus } from '@/types';

/** Тексты интерфейса для перечислений домена (презентационный справочник). */

/**
 * Статус отдельной проверки в интерфейсе. Шире доменного ValidationStatus:
 * NOT_APPLICABLE, STALE и UNAVAILABLE — требования ТЗ (п. 2.1, 2.2.2, 2.2.4).
 */
export type CheckStatus = ValidationStatus | 'NOT_APPLICABLE' | 'STALE' | 'UNAVAILABLE' | 'PENDING';

export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  PASSED: 'Пройдена',
  FAILED: 'Не пройдена',
  WARNING: 'Замечание',
  SKIPPED: 'Нет данных',
  NOT_APPLICABLE: 'Не применимо',
  STALE: 'Неактуальна',
  UNAVAILABLE: 'Источник недоступен',
  PENDING: 'Выполняется',
};

export const CHECK_DIMENSION_LABEL: Record<CheckDimension, string> = {
  PRESENCE: 'Наличие',
  QUALITY: 'Качество',
  FUNCTION: 'Функция',
};

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  FILE: 'Файл данных',
  VALIDATION_REPORT: 'Отчёт проверки',
  SIGNED_ACT: 'Подписанный акт',
  COMMAND_LOG: 'Журнал команд',
  SCREENSHOT: 'Снимок экрана',
  NOTE: 'Заметка',
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  SESSION_CREATED: 'Сессия запуска создана',
  SESSION_COMPLETED: 'Запуск завершён',
  STAGE_STARTED: 'Этап начат',
  STAGE_BLOCKED: 'Этап заблокирован',
  STAGE_UNBLOCKED: 'Блокировка снята',
  STAGE_COMPLETED: 'Этап завершён',
  TRANSITION_REJECTED: 'Переход отклонён',
  VALIDATION_RUN: 'Выполнены проверки',
  BLOCKER_OPENED: 'Зафиксировано препятствие',
  BLOCKER_RESOLVED: 'Препятствие устранено',
  EVIDENCE_ADDED: 'Добавлен материал',
  CONFIRMATION_ADDED: 'Получено подтверждение',
  DATASET_IMPORTED: 'Загружены данные',
};
