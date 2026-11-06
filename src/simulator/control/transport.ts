import type { BenchAssetState, ControllerTrace, ControlTransportKind, PassportAssetType } from '@/types';
import { benchState } from './bench';
import { simulateControl, type SimulatedCommand, type SimulationParams } from './simulate';

/**
 * Транспорт команд управления. Единственная реализация – локальный имитатор.
 *
 * БЕЗОПАСНОСТЬ: в проекте нет и не должно быть транспорта к реальному оборудованию
 * (Modbus, IEC 104, MQTT, HTTP API контроллеров и т. п.). Модуль не использует сеть,
 * таймеры и глобальное состояние; движок отклоняет любой транспорт, кроме SIMULATOR.
 */
export interface ControlTransport {
  readonly kind: ControlTransportKind;
  readonly label: string;
  /** Состояние актива на стенде. */
  describe(objectId: string, assetId: string, type: PassportAssetType): BenchAssetState;
  /** «Отправка» команды в имитатор: синхронный расчёт трассы контроллера. */
  send(command: SimulatedCommand, params: SimulationParams): ControllerTrace;
}

export function createSimulatorTransport(): ControlTransport {
  return Object.freeze({
    kind: 'SIMULATOR' as const,
    label: 'Локальный имитатор контроллера',
    describe: benchState,
    send: simulateControl,
  });
}
