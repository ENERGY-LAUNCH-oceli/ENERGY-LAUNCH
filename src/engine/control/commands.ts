import type { ControlAsset, ControllerTrace, ControlTestCommand, ControlTestingRules, CommandState, SimScenario } from '@/types';
import type { ControlTransport } from '@/simulator/control';
import { hashSeed } from '@/utils/random';

const r2 = (v: number) => Math.round(v * 100) / 100;
const at = (base: string, sec: number) => new Date(Date.parse(base) + Math.round(sec * 1000)).toISOString();

/** Время на передачу команды в имитатор после создания, с. */
const SEND_DELAY_SEC = 0.1;
/** Сколько секунд мощность должна держаться в полосе допуска, чтобы считать отклик состоявшимся. */
export const RESPONSE_HOLD_SEC = 5;
/** Сколько секунд показывать до отправки. */
export const PRE_SEC = 10;

export class UnsafeTransportError extends Error {
  constructor(kind: string) {
    super(`Транспорт «${kind}» запрещён: команды управления отправляются только в локальный имитатор`);
    this.name = 'UnsafeTransportError';
  }
}

/** Допуск фактической мощности для уставки. */
export const toleranceFor = (valueKw: number, rules: ControlTestingRules) => r2(Math.max(rules.toleranceKw, (Math.abs(valueKw) * rules.tolerancePct) / 100));

/** Допустимая полоса фактической мощности: батарея – уставка ± допуск, PV – не выше ограничения + допуск. */
export function expectedBand(asset: Pick<ControlAsset, 'type'>, valueKw: number, rules: ControlTestingRules) {
  const tol = toleranceFor(valueKw, rules);
  return { toleranceKw: tol, lowerKw: asset.type === 'PV' ? 0 : r2(valueKw - tol), upperKw: r2(valueKw + tol) };
}

/** Проверка значения до отправки. Некорректная команда не уходит даже в имитатор. */
export function checkCommandValue(asset: Pick<ControlAsset, 'type' | 'bench'>, valueKw: number, rules: ControlTestingRules): string | null {
  const { ratedPowerKw: rated, currentPowerKw: current } = asset.bench;
  if (!Number.isFinite(valueKw)) return 'Значение мощности не задано';
  if (asset.type === 'BATTERY') {
    if (Math.abs(valueKw) > rated) return `Уставка ${valueKw} кВт вне диапазона батареи ±${rated} кВт`;
    if (Math.abs(valueKw - current) < rules.minStepKw) return `Уставка отличается от текущей мощности (${current} кВт) меньше чем на ${rules.minStepKw} кВт – отклик не наблюдаем`;
    return null;
  }
  if (valueKw < 0 || valueKw > rated) return `Ограничение ${valueKw} кВт вне диапазона PV 0…${rated} кВт`;
  if (valueKw > current - rules.minStepKw) return `Ограничение должно быть ниже текущей выработки (${current} кВт) минимум на ${rules.minStepKw} кВт – иначе снижение не наблюдаемо`;
  return null;
}

export interface ControlTestRequest {
  objectId: string;
  asset: ControlAsset;
  valueKw: number;
  scenario: SimScenario;
  commandId: string;
  createdAt: string;
  actor: string;
  rulesetVersion: string;
}

/** Первый момент после приёма, с которого мощность держится в полосе RESPONSE_HOLD_SEC секунд. */
function responseTime(trace: ControllerTrace, ackSec: number, band: { lowerKw: number; upperKw: number }): number | null {
  const after = trace.samples.filter((s) => s.t >= ackSec);
  for (let i = 0; i < after.length; i++) {
    const window = after.slice(i, i + RESPONSE_HOLD_SEC + 1);
    if (window.length < RESPONSE_HOLD_SEC + 1) break;
    if (window.every((s) => s.actualKw >= band.lowerKw && s.actualKw <= band.upperKw)) return after[i]!.t;
  }
  return null;
}

/** Состояния команды по трассе контроллера. Отправка без приёма и отклика – не успех. */
export function evaluateTrace(req: ControlTestRequest, trace: ControllerTrace, rules: ControlTestingRules, sentAt: string) {
  const band = expectedBand(req.asset, req.valueKw, rules);
  const history: { state: CommandState; at: string }[] = [
    { state: 'CREATED', at: req.createdAt },
    { state: 'SENT', at: sentAt },
  ];
  const sampleAt = (t: number) => trace.samples.reduce((best, s) => (Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best), trace.samples[0]!);

  if (!trace.ack || trace.ack.afterSec > rules.ackTimeoutSec) {
    history.push({ state: 'TIMEOUT', at: at(sentAt, rules.ackTimeoutSec) });
    return {
      band, history, state: 'TIMEOUT' as const, receivedAt: null, receivedValueKw: null, respondedAt: null, responseSec: null,
      actualKw: sampleAt(rules.ackTimeoutSec).actualKw,
      reason: `Контроллер не подтвердил приём за ${rules.ackTimeoutSec} с – команда отправлена, но не принята; фактическая мощность не изменилась`,
    };
  }

  const ackSec = trace.ack.afterSec;
  const receivedAt = at(sentAt, ackSec);
  history.push({ state: 'RECEIVED', at: receivedAt });
  const windowEnd = ackSec + rules.responseWindowSec;
  const actualKw = sampleAt(windowEnd).actualKw;

  if (Math.abs(trace.ack.valueKw - req.valueKw) > 0.01) {
    history.push({ state: 'FAILED', at: receivedAt });
    return {
      band, history, state: 'FAILED' as const, receivedAt, receivedValueKw: trace.ack.valueKw, respondedAt: null, responseSec: null, actualKw,
      reason: `Контроллер принял ${trace.ack.valueKw} кВт вместо отправленных ${req.valueKw} кВт`,
    };
  }

  const tResp = responseTime(trace, ackSec, band);
  if (tResp !== null && tResp <= windowEnd) {
    const respondedAt = at(sentAt, tResp);
    history.push({ state: 'RESPONDED', at: respondedAt }, { state: 'PASSED', at: at(sentAt, tResp + RESPONSE_HOLD_SEC) });
    return {
      band, history, state: 'PASSED' as const, receivedAt, receivedValueKw: trace.ack.valueKw, respondedAt, responseSec: r2(tResp - ackSec), actualKw,
      reason: `Принята через ${r2(ackSec)} с; фактическая мощность в полосе ${band.lowerKw}…${band.upperKw} кВт через ${r2(tResp - ackSec)} с после приёма (окно ${rules.responseWindowSec} с)`,
    };
  }
  if (tResp !== null) {
    history.push({ state: 'TIMEOUT', at: at(sentAt, windowEnd) });
    return {
      band, history, state: 'TIMEOUT' as const, receivedAt, receivedValueKw: trace.ack.valueKw, respondedAt: at(sentAt, tResp), responseSec: r2(tResp - ackSec), actualKw,
      reason: `Отклик через ${r2(tResp - ackSec)} с после приёма – позже ожидаемого интервала ${rules.responseWindowSec} с`,
    };
  }
  history.push({ state: 'FAILED', at: at(sentAt, windowEnd) });
  return {
    band, history, state: 'FAILED' as const, receivedAt, receivedValueKw: trace.ack.valueKw, respondedAt: null, responseSec: null, actualKw,
    reason: `Команда принята, но фактическая мощность не вошла в полосу ${band.lowerKw}…${band.upperKw} кВт за ${rules.responseWindowSec} с. Проверьте исполнение команды и привязку сигнала ${req.asset.signals.actual}`,
  };
}

/**
 * Тест управления: команда → имитатор → оценка. Чистая функция от входов и транспорта.
 * Запись теста – подтверждение: исходные данные, команда, приём, отклик, время, результат, версия правила.
 */
export function executeControlTest(req: ControlTestRequest, rules: ControlTestingRules, transport: ControlTransport): ControlTestCommand {
  if (transport.kind !== 'SIMULATOR') throw new UnsafeTransportError(String(transport.kind));
  const { asset } = req;
  const seed = hashSeed(`${req.objectId}|${asset.assetId}|${req.valueKw}|${req.scenario}|${req.commandId}`);
  const band = expectedBand(asset, req.valueKw, rules);
  const base = {
    commandId: req.commandId,
    objectId: req.objectId,
    assetId: asset.assetId,
    assetType: asset.type,
    prefix: asset.prefix,
    kind: asset.kind,
    transport: transport.kind,
    scenario: req.scenario,
    seed,
    signals: asset.signals,
    input: { valueKw: req.valueKw, baselineKw: asset.bench.currentPowerKw, ratedPowerKw: asset.bench.ratedPowerKw, socPct: asset.bench.socPct },
    createdAt: req.createdAt,
    expected: { ackTimeoutSec: rules.ackTimeoutSec, responseWindowSec: rules.responseWindowSec, ...band },
    rulesetVersion: req.rulesetVersion,
    ruleId: asset.type === 'BATTERY' ? 'CT-014' : 'CT-015',
    actor: req.actor,
  };

  const invalid = checkCommandValue(asset, req.valueKw, rules);
  if (invalid) {
    return {
      ...base,
      sentAt: null, receivedAt: null, receivedValueKw: null, respondedAt: null, responseSec: null, actualKw: asset.bench.currentPowerKw,
      state: 'FAILED',
      history: [{ state: 'CREATED', at: req.createdAt }, { state: 'FAILED', at: req.createdAt }],
      reason: `Команда не отправлена: ${invalid}`,
      samples: [],
    };
  }

  const sentAt = at(req.createdAt, SEND_DELAY_SEC);
  const trace = transport.send(
    { assetType: asset.type, valueKw: req.valueKw, baselineKw: asset.bench.currentPowerKw, ratedPowerKw: asset.bench.ratedPowerKw, scenario: req.scenario, seed },
    { observationSec: rules.observationSec, preSec: PRE_SEC },
  );
  const { band: _b, ...ev } = evaluateTrace(req, trace, rules, sentAt);
  return { ...base, ...ev, sentAt, samples: trace.samples };
}

/** Следующий воспроизводимый command_id объекта. */
export const nextCommandId = (objectCode: string, existing: readonly { commandId: string }[]) => `CMD-${objectCode}-${String(existing.length + 1).padStart(3, '0')}`;

/** Значение по умолчанию для формы: заметный шаг от текущей мощности, в пределах номинала. */
export function suggestedValue(asset: Pick<ControlAsset, 'type' | 'bench'>, scenario: SimScenario): number {
  const { ratedPowerKw: rated, currentPowerKw: cur } = asset.bench;
  if (scenario === 'INVALID_VALUE') return asset.type === 'BATTERY' ? Math.round(rated * 1.5) : -10;
  // Половина номинала: значение всегда в допустимом диапазоне ±номинал, даже у небольших батарей
  if (asset.type === 'BATTERY') {
    const v = Math.max(1, Math.round(rated * 0.5));
    return cur > rated * 0.2 ? -v : v;
  }
  return Math.max(0, Math.round((cur * 0.5) / 5) * 5);
}
