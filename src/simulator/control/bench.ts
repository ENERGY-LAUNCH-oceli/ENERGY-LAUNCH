import type { BenchAssetState, PassportAssetType } from '@/types';
import { hashSeed } from '@/utils/random';

const frac = (seed: number) => (hashSeed(String(seed)) % 10_000) / 10_000;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Номинальная мощность тестового стенда (синтетические параметры имитатора). */
export const BENCH_RATED_KW: Record<PassportAssetType, number> = { BATTERY: 100, PV: 60 };

/**
 * Состояние актива на стенде имитатора: номинал, текущая мощность, SoC.
 * Значения детерминированы идентификатором объекта и актива.
 */
export function benchState(objectId: string, assetId: string, type: PassportAssetType): BenchAssetState {
  const seed = hashSeed(`${objectId}/${assetId}`);
  if (type === 'BATTERY') {
    return { ratedPowerKw: BENCH_RATED_KW.BATTERY, currentPowerKw: r2(-8 + frac(seed) * 16), socPct: Math.round(45 + frac(seed + 1) * 25), controller: 'ONLINE' };
  }
  return { ratedPowerKw: BENCH_RATED_KW.PV, currentPowerKw: r2(38 + frac(seed) * 8), socPct: null, controller: 'ONLINE' };
}
