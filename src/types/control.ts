import type { Id, IsoDateTime } from './common';
import type { MeasurementUnit } from './measurement';

export const CONTROL_COMMAND_TYPES = [
  'ACTIVE_POWER_SETPOINT',
  'REACTIVE_POWER_SETPOINT',
  'POWER_LIMIT',
  'START',
  'STOP',
  'BREAKER_OPEN',
  'BREAKER_CLOSE',
] as const;
export type ControlCommandType = (typeof CONTROL_COMMAND_TYPES)[number];

export const COMMAND_STATUSES = [
  'PENDING',
  'SENT',
  'ACKNOWLEDGED',
  'EXECUTED',
  'FAILED',
  'TIMEOUT',
] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/** Команда управления активом с фиксацией таймингов квитирования и исполнения. */
export interface ControlCommand {
  id: Id;
  assetId: Id;
  /** Сигнал уставки (WRITE). */
  signalId: Id;
  /** Сигнал обратной связи (READ) для проверки исполнения. */
  feedbackSignalId?: Id;
  type: ControlCommandType;
  targetValue?: number;
  unit?: MeasurementUnit;
  issuedAt: IsoDateTime;
  acknowledgedAt?: IsoDateTime;
  executedAt?: IsoDateTime;
  feedbackValue?: number;
  status: CommandStatus;
  issuedBy: string;
}

export const CONTROL_TEST_STATUSES = ['PLANNED', 'RUNNING', 'PASSED', 'FAILED'] as const;
export type ControlTestStatus = (typeof CONTROL_TEST_STATUSES)[number];

/** Программа испытаний управления (этап 3, Asset Control). */
export interface ControlTest {
  id: Id;
  objectId: Id;
  assetId: Id;
  name: string;
  status: ControlTestStatus;
  commands: ControlCommand[];
  startedAt?: IsoDateTime;
  finishedAt?: IsoDateTime;
}
