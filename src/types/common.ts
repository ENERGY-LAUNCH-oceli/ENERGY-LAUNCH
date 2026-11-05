/** Базовые примитивы домена. */

/** Идентификатор сущности (UUID или стабильный код демо-данных). */
export type Id = string;

/** Дата-время в формате ISO 8601 с часовым поясом, например `2026-11-05T10:00:00.000Z`. */
export type IsoDateTime = string;

/** Календарная дата `YYYY-MM-DD`. */
export type IsoDate = string;

/** Пользователь или система, совершившие действие. */
export interface Actor {
  id: Id;
  name: string;
  role: ConfirmationRole;
}

export const CONFIRMATION_ROLES = [
  'OBJECT_OWNER',
  'GRID_OPERATOR',
  'COMMISSIONING_ENGINEER',
  'DISPATCHER',
  'PLATFORM_OPERATOR',
  'SYSTEM',
] as const;
export type ConfirmationRole = (typeof CONFIRMATION_ROLES)[number];

export const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Результат операции без исключений. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
