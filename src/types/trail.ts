import type { Id, IsoDateTime } from './common';
import type { StageId, StageStatus } from './launch';
import type { ValidationResult } from './validation';

/**
 * Сквозной след запуска (фаза 10): снимки прогонов проверок, ссылки на неизменяемые версии входов,
 * устаревание подтверждений. История не удаляется – по ней воспроизводится любой статус.
 */

export type InputKind = 'invoice' | 'telemetry' | 'passport' | 'control' | 'dashboard';

/** Ссылка на неизменяемую версию входных данных проверки. */
export interface InputRef {
  kind: InputKind;
  label: string;
  version: number;
  fileName?: string;
  /** SHA-256 файла набора (из manifest.json), если вход – файл набора кейса. */
  sha256?: string;
  rows?: number;
}

/** Состояние источника данных этапа: недоступный API или файл (ТЗ 2.2 п. 2, сценарий 6). */
export interface SourceStatus {
  available: boolean;
  /** Что именно недоступно и почему. */
  error?: string;
  /** Время последней успешной проверки по этому источнику. */
  lastSuccessAt?: IsoDateTime;
  checkedAt: IsoDateTime;
}

export type RecheckTrigger = 'MANUAL' | 'RECHECK' | 'SEED';

/** Снимок одного прогона проверок этапа: входы, правила, результаты, статус до и после. */
export interface ValidationSnapshot {
  id: Id;
  objectId: Id;
  stageId: StageId;
  at: IsoDateTime;
  actor: string;
  trigger: RecheckTrigger;
  /** Что изменилось и вызвало повторную проверку. */
  reason?: string;
  rulesetVersion: string;
  inputs: InputRef[];
  results: ValidationResult[];
  statusBefore: StageStatus;
  statusAfter: StageStatus;
}

/** Отметка устаревания подтверждений этапа после изменения уже проверенных входов. */
export interface StaleMark {
  stageId: StageId;
  at: IsoDateTime;
  reason: string;
  input: InputRef;
}
