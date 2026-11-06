import type { Id, IsoDateTime } from './common';
import type { PassportAssetType } from './telemetry';

/**
 * Этап 3 – проверка контура управления (фаза 08).
 * Команды уходят только в локальный имитатор; реальных интеграций с оборудованием нет.
 */

/** Вид теста управления: setpoint батареи или ограничение выработки PV. */
export const CONTROL_TEST_KINDS = ['BATTERY_SETPOINT', 'PV_CURTAILMENT'] as const;
export type ControlTestKind = (typeof CONTROL_TEST_KINDS)[number];

/** Состояния команды. Отправка сама по себе – не успех: нужны приём контроллером и отклик актива. */
export const COMMAND_STATES = ['CREATED', 'SENT', 'RECEIVED', 'RESPONDED', 'PASSED', 'FAILED', 'TIMEOUT'] as const;
export type CommandState = (typeof COMMAND_STATES)[number];

/** Итог теста (финальное состояние). */
export type CommandOutcome = Extract<CommandState, 'PASSED' | 'FAILED' | 'TIMEOUT'>;

/** Сценарии имитатора (ТЗ фазы 08, п. 6). */
export const SIM_SCENARIOS = ['NOMINAL', 'NO_ACK', 'NO_RESPONSE', 'SLOW_RESPONSE', 'INVALID_VALUE'] as const;
export type SimScenario = (typeof SIM_SCENARIOS)[number];

/** Единственный допустимый транспорт команд. */
export type ControlTransportKind = 'SIMULATOR';

/** Сигналы управления актива из паспорта object.json. */
export interface ControlSignals {
  /** Отправленная уставка (у PV отсутствует – уставка передаётся сразу в контроллер). */
  sent: string | null;
  /** Уставка, принятая контроллером. */
  received: string;
  /** Фактическая мощность. */
  actual: string;
}

/** Состояние тестового стенда для актива (из имитатора). */
export interface BenchAssetState {
  ratedPowerKw: number;
  currentPowerKw: number;
  socPct: number | null;
  controller: 'ONLINE' | 'NO_RESPONSE';
}

/** Управляемый актив этапа 3: паспорт + стенд + связь по данным этапа 2. */
export interface ControlAsset {
  assetId: string;
  type: PassportAssetType;
  prefix: string;
  kind: ControlTestKind;
  /** Поддерживает ли актив тест управления (по карте сигналов паспорта). */
  supported: boolean;
  /** Почему тест не применим (подтверждено паспортом). */
  notSupportedReason?: string;
  signals: ControlSignals;
  /** Связь по результатам проверки телеметрии (этап 2). */
  link: 'OK' | 'NO_COMMUNICATION' | 'UNKNOWN';
  bench: BenchAssetState;
}

/** Сырые события контроллера, полученные от транспорта (имитатора). */
export interface ControllerTrace {
  /** Подтверждение приёма: время от отправки, с, и принятое значение. */
  ack: { afterSec: number; valueKw: number } | null;
  /** Ряд: время от отправки, с; уставка в контроллере (null до приёма); фактическая мощность. */
  samples: ControlSample[];
}

export interface ControlSample {
  t: number;
  setpointKw: number | null;
  actualKw: number;
}

/** Запись теста управления – она же подтверждение (исходные данные, команда, приём, отклик, время, результат, версия правила). */
export interface ControlTestCommand {
  commandId: Id;
  objectId: Id;
  assetId: string;
  assetType: PassportAssetType;
  prefix: string;
  kind: ControlTestKind;
  transport: ControlTransportKind;
  scenario: SimScenario;
  /** Seed имитатора: одинаковые входы дают одинаковый результат. */
  seed: number;
  signals: ControlSignals;
  /** Исходные данные теста. */
  input: { valueKw: number; baselineKw: number; ratedPowerKw: number; socPct: number | null };
  createdAt: IsoDateTime;
  sentAt: IsoDateTime | null;
  receivedAt: IsoDateTime | null;
  receivedValueKw: number | null;
  respondedAt: IsoDateTime | null;
  /** Время отклика от приёма, с. */
  responseSec: number | null;
  /** Фактическая мощность в конце окна ожидания. */
  actualKw: number | null;
  /** Ожидание: таймаут приёма, окно отклика, допустимая полоса фактической мощности. */
  expected: { ackTimeoutSec: number; responseWindowSec: number; toleranceKw: number; lowerKw: number; upperKw: number };
  state: CommandOutcome;
  history: { state: CommandState; at: IsoDateTime }[];
  reason: string;
  samples: ControlSample[];
  rulesetVersion: string;
  ruleId: string;
  actor: string;
}

/** Прогон проверок этапа 3 (подтверждение). */
export interface ControlValidationRun {
  id: Id;
  run: number;
  at: IsoDateTime;
  rulesetVersion: string;
  /** Сколько команд было в журнале на момент проверки – новые команды делают результат неактуальным. */
  commandsCount: number;
  commandIds: Id[];
  result: 'PASSED' | 'FAILED';
  failedRules: string[];
  params: Record<string, string | number>;
}
