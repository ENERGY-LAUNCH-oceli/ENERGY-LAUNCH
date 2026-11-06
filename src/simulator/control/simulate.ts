import type { ControllerTrace, ControlSample, PassportAssetType, SimScenario } from '@/types';
import { createRng } from '@/utils/random';

/** Команда, как её видит контроллер имитатора. */
export interface SimulatedCommand {
  assetType: PassportAssetType;
  valueKw: number;
  baselineKw: number;
  ratedPowerKw: number;
  scenario: SimScenario;
  seed: number;
}

export interface SimulationParams {
  /** Сколько секунд наблюдать после отправки. */
  observationSec: number;
  /** Сколько секунд показать до отправки (исходная мощность). */
  preSec: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Модель контроллера и актива. Чистая функция: одинаковые входы → одинаковая трасса.
 *
 * - NOMINAL – приём < 1,2 с, отклик первого порядка (запаздывание 1,5–2,5 с, τ 4–6 с);
 * - NO_ACK – контроллер не подтверждает приём, мощность не меняется;
 * - NO_RESPONSE – приём подтверждён, фактическая мощность не меняется;
 * - SLOW_RESPONSE – приём подтверждён, отклик приходит с запаздыванием ~75 с;
 * - INVALID_VALUE – значение вне диапазона: контроллер отклоняет команду (как NO_ACK).
 * Значение за пределами номинала контроллер отклоняет при любом сценарии.
 */
export function simulateControl(cmd: SimulatedCommand, p: SimulationParams): ControllerTrace {
  const rng = createRng(cmd.seed);
  const noiseAmp = cmd.assetType === 'PV' ? 0.3 : 0.15;
  const noise = () => (rng() - 0.5) * 2 * noiseAmp;
  const outOfRange = cmd.assetType === 'PV' ? cmd.valueKw < 0 || cmd.valueKw > cmd.ratedPowerKw : Math.abs(cmd.valueKw) > cmd.ratedPowerKw;
  const rejected = outOfRange || cmd.scenario === 'NO_ACK' || cmd.scenario === 'INVALID_VALUE';

  const ackAfter = r2(0.4 + rng() * 0.8);
  const ack = rejected ? null : { afterSec: ackAfter, valueKw: cmd.valueKw };
  const dead = cmd.scenario === 'SLOW_RESPONSE' ? 75 + rng() * 5 : 1.5 + rng();
  const tau = 4 + rng() * 2;
  // PV может только ограничить выработку: целевая мощность не выше доступной
  const target = cmd.assetType === 'PV' ? Math.min(cmd.valueKw, cmd.baselineKw) : cmd.valueKw;
  const responds = !!ack && cmd.scenario !== 'NO_RESPONSE';

  const samples: ControlSample[] = [];
  for (let t = -p.preSec; t <= p.observationSec; t++) {
    const since = ack ? t - ack.afterSec - dead : -1;
    const ideal = responds && since > 0 ? target + (cmd.baselineKw - target) * Math.exp(-since / tau) : cmd.baselineKw;
    const actual = cmd.assetType === 'PV' ? Math.max(0, ideal + noise()) : ideal + noise();
    samples.push({ t, setpointKw: ack && t >= ack.afterSec ? ack.valueKw : null, actualKw: r2(actual) });
  }
  return { ack, samples };
}
