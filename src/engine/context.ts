import type { IsoDateTime } from '@/types';

/**
 * Внешние зависимости движка. Передаются явно, чтобы бизнес-логика оставалась
 * чистой и детерминированной (тесты подставляют фиксированные время и ID).
 */
export interface EngineContext {
  actor: string;
  now: () => IsoDateTime;
  newId: () => string;
}

export function createEngineContext(actor: string, overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    actor,
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
    ...overrides,
  };
}

/** Детерминированный контекст для тестов и сценариев. */
export function createFixedContext(actor: string, isoNow: IsoDateTime, idPrefix = 'id'): EngineContext {
  let seq = 0;
  return { actor, now: () => isoNow, newId: () => `${idPrefix}-${++seq}` };
}
