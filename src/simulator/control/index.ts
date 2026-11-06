/**
 * Имитатор контура управления (фаза 08). Отдельный модуль: не зависит от React, хранилища,
 * движка и сети. Реальные команды на оборудование не отправляются никогда.
 */
export { benchState, BENCH_RATED_KW } from './bench';
export { simulateControl, type SimulatedCommand, type SimulationParams } from './simulate';
export { createSimulatorTransport, type ControlTransport } from './transport';
