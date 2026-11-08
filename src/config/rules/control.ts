import type { ControlTestingRules } from '@/types';

/**
 * Этап 3 (фаза 08): тесты управления через локальный имитатор.
 * Три события на каждый обязательный актив: отправка → приём контроллером → отклик фактической мощности.
 * Пороги – настройки демонстрации: ТЗ требует отклика «в ожидаемом интервале», но чисел не задаёт (паспорт OE-04 – предложения для демо).
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

/**
 * v1.6.0: интервалы команд (паспорт OE-04, этап 3: «проверить отклик активов, интервалы команд…»). Следующая команда
 * активу – не раньше чем через 10 с после результата предыдущей: актив успокоился, отклик относится к своей команде.
 * Число – предложение для демо (паспорт, «Следующие шаги» п. 3).
 */
export const CONTROL_TESTING_V1_6: ControlTestingRules = { ...CONTROL_TESTING_TZ, minCommandIntervalSec: 10 };
