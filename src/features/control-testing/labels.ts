import type { CommandState, ControlTestKind, SimScenario } from '@/types';

/** Состояния команды – как в ТЗ фазы 08. */
export const STATE_LABEL: Record<CommandState, string> = {
  CREATED: 'Created',
  SENT: 'Sent',
  RECEIVED: 'Received',
  RESPONDED: 'Responded',
  PASSED: 'Passed',
  FAILED: 'Failed',
  TIMEOUT: 'Timeout',
};

export const STATE_HINT: Record<CommandState, string> = {
  CREATED: 'Команда создана',
  SENT: 'Отправлена в имитатор',
  RECEIVED: 'Принята контроллером',
  RESPONDED: 'Актив откликнулся',
  PASSED: 'Тест пройден',
  FAILED: 'Тест не пройден',
  TIMEOUT: 'Время ожидания истекло',
};

export const SCENARIO_LABEL: Record<SimScenario, { title: string; hint: string }> = {
  NOMINAL: { title: 'Успешная отправка и отклик', hint: 'Контроллер принимает команду, актив выходит на уставку' },
  NO_ACK: { title: 'Отправка без подтверждения', hint: 'Контроллер не подтверждает приём' },
  NO_RESPONSE: { title: 'Подтверждение без отклика', hint: 'Команда принята, мощность не меняется' },
  SLOW_RESPONSE: { title: 'Превышение времени ожидания', hint: 'Отклик приходит позже ожидаемого интервала' },
  INVALID_VALUE: { title: 'Некорректное значение', hint: 'Значение вне диапазона: команда не отправляется' },
};

export const KIND_LABEL: Record<ControlTestKind, string> = {
  BATTERY_SETPOINT: 'Батарея · setpoint',
  PV_CURTAILMENT: 'PV · ограничение выработки',
};

export const kw = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '–' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits })} кВт`);

/** Секунды между двумя ISO-метками. */
export const secBetween = (from: string | null, to: string | null) => (from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 100) / 10 : null);

export const utcTime = (iso: string | null) => (iso ? `${iso.slice(0, 10).split('-').reverse().join('.')} ${iso.slice(11, 19)} UTC` : '–');
