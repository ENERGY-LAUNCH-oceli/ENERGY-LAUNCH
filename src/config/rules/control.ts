import type { ControlTestingRules } from '@/types';

/**
 * Этап 3 (фаза 08): тесты управления через локальный имитатор.
 * Три события на каждый обязательный актив: отправка → приём контроллером → отклик фактической мощности.
 * Пороги – настройки демонстрации; сверка с ТЗ – в docs/requirements-reconciliation.md.
 */
export const CONTROL_TESTING_TZ: ControlTestingRules = {
  ackTimeoutSec: 5,
  responseWindowSec: 60,
  observationSec: 120,
  toleranceKw: 2,
  tolerancePct: 3,
  minStepKw: 5,
  requireBatterySetpoint: true,
  requirePvCurtailment: true,
};
