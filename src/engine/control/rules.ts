import type { ControlTestCommand, ControlTestingRules, SitePassport, ValidationResult } from '@/types';
import { makeResult, type ValidatorEnv } from '../validators/helpers';
import { controlTargets, type ControlTarget } from './assets';

/** Последний тест по каждому активу – по нему решается, пройден ли обязательный тест. */
export function latestByAsset(commands: readonly ControlTestCommand[]): Map<string, ControlTestCommand> {
  const map = new Map<string, ControlTestCommand>();
  for (const c of commands) map.set(c.assetId, c);
  return map;
}

/** Обязательные тесты по паспорту и правилам. */
export function requiredTargets(passport: SitePassport | undefined, rules: ControlTestingRules): ControlTarget[] {
  return controlTargets(passport).filter((t) => t.supported && (t.kind === 'BATTERY_SETPOINT' ? rules.requireBatterySetpoint : rules.requirePvCurtailment));
}

const ids = (xs: readonly { assetId: string }[]) => xs.map((x) => x.assetId);

/** Момент, когда результат команды установлен (последнее событие: пройдена, отказ или таймаут). */
export const settledAt = (c: ControlTestCommand) => c.history.at(-1)?.at ?? c.createdAt;

/** Не раньше какого момента можно отправлять следующую команду активу (CT-017); null – ограничения нет. */
export function nextCommandAllowedAt(commands: readonly ControlTestCommand[], assetId: string, rules: ControlTestingRules): string | null {
  if (rules.minCommandIntervalSec === undefined) return null;
  const last = commands.filter((c) => c.assetId === assetId && c.sentAt).at(-1);
  return last ? new Date(Date.parse(settledAt(last)) + rules.minCommandIntervalSec * 1000).toISOString() : null;
}

export interface IntervalViolation {
  assetId: string;
  commandId: string;
  previousId: string;
  /** Секунды от результата предыдущей команды до отправки этой; отрицательные – отправлена до результата. */
  gapSec: number;
}

/** CT-017: команды одному активу с паузой меньше допустимой после результата предыдущей. */
export function commandIntervalViolations(commands: readonly ControlTestCommand[], minSec: number): IntervalViolation[] {
  const byAsset = new Map<string, ControlTestCommand[]>();
  for (const c of commands) if (c.sentAt) byAsset.set(c.assetId, [...(byAsset.get(c.assetId) ?? []), c]);
  const out: IntervalViolation[] = [];
  for (const [assetId, list] of byAsset) {
    const sorted = [...list].sort((a, b) => Date.parse(a.sentAt!) - Date.parse(b.sentAt!));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const gapSec = Math.round((Date.parse(cur.sentAt!) - Date.parse(settledAt(prev))) / 100) / 10;
      if (gapSec < minSec) out.push({ assetId, commandId: cur.commandId, previousId: prev.commandId, gapSec });
    }
  }
  return out;
}

function intervalsResult(commands: readonly ControlTestCommand[], rules: ControlTestingRules, env: ValidatorEnv): ValidationResult[] {
  const min = rules.minCommandIntervalSec;
  if (min === undefined) return [];
  const sent = commands.filter((c) => c.sentAt);
  const v = commandIntervalViolations(commands, min);
  const describe = (x: IntervalViolation) => `${x.commandId} (${x.assetId}) – ${x.gapSec < 0 ? `отправлена до результата ${x.previousId}` : `через ${x.gapSec} с после результата ${x.previousId}`}`;
  return [
    makeResult(
      'CT-017',
      v.length === 0,
      {
        message: v.length
          ? `Пауза между командами меньше ${min} с: ${v.map(describe).join(', ')}. Отклик таких команд нельзя однозначно отнести к ним – повторите тест после паузы`
          : sent.length > 1
            ? `Между командами одному активу не меньше ${min} с после результата предыдущей`
            : 'Повторных команд одному активу нет',
        actual: v.length,
        expected: 0,
        details: { assets: [...new Set(v.map((x) => x.assetId))], commands: v.map((x) => x.commandId), violations: v.map((x) => ({ ...x })) },
      },
      env,
    ),
  ];
}
const cmdLabel = (c: ControlTestCommand) => `${c.commandId} (${c.assetId}, ${c.state})`;

/**
 * Этап 3 (фаза 08). Проверка подтверждает три отдельных события по каждому обязательному активу:
 * команда отправлена → принята контроллером → актив откликнулся фактической мощностью в ожидаемом интервале.
 * Отправка сама по себе успехом не считается.
 */
export function validateControlTesting(passport: SitePassport | undefined, commands: readonly ControlTestCommand[], rules: ControlTestingRules, env: ValidatorEnv): ValidationResult[] {
  const unsafe = commands.filter((c) => c.transport !== 'SIMULATOR');
  const ct10 = makeResult(
    'CT-010',
    unsafe.length === 0,
    {
      message: unsafe.length ? `Команды вне тестового контура: ${unsafe.map((c) => c.commandId).join(', ')}` : `Все команды (${commands.length}) отправлены только в локальный имитатор; интеграций с оборудованием нет`,
      actual: unsafe.length,
      expected: 0,
      details: { commands: unsafe.map((c) => c.commandId) },
    },
    env,
  );

  if (!passport) {
    const skip = (['CT-011', 'CT-012', 'CT-013', 'CT-014', 'CT-015'] as const).map((id) => makeResult(id, 'SKIPPED', { message: 'Нет паспорта object.json – управляемые активы не определены' }, env));
    return [ct10, ...skip, makeResult('CT-016', true, { message: 'Нет команд для анализа' }, env), ...intervalsResult(commands, rules, env)];
  }

  // Нет ни PV, ни батарей (ТЗ: «Не применимо» – при подтверждённом отсутствии актива): проверки управления не применимы,
  // отсутствие подтверждено паспортом и подтверждением инженера в требованиях этапа. Активы есть, но не поддерживаются – это не сюда
  if (!passport.assets.some((a) => a.type === 'PV' || a.type === 'BATTERY')) {
    const na = (id: 'CT-011' | 'CT-012' | 'CT-013' | 'CT-014' | 'CT-015') =>
      makeResult(id, 'NOT_APPLICABLE', { message: 'В паспорте object.json нет управляемых активов (PV, батарей) – тест управления не применим; отсутствие подтверждает инженер ПНР в требованиях этапа' }, env);
    return [ct10, na('CT-011'), na('CT-012'), na('CT-013'), na('CT-014'), na('CT-015'), makeResult('CT-016', true, { message: 'Нет команд для анализа' }, env), ...intervalsResult(commands, rules, env)];
  }

  const targets = requiredTargets(passport, rules);
  const latest = latestByAsset(commands);
  const tested = targets.map((t) => ({ target: t, cmd: latest.get(t.assetId) }));

  // CT-011 – отправка
  const notSent = tested.filter((x) => !x.cmd?.sentAt);
  const ct11 = makeResult(
    'CT-011',
    targets.length > 0 && notSent.length === 0,
    {
      message: !targets.length
        ? 'В паспорте нет управляемых активов'
        : notSent.length
          ? `Нет отправленной тестовой команды: ${ids(notSent.map((x) => x.target)).join(', ')}${notSent.some((x) => x.cmd) ? ' (последняя команда отклонена до отправки)' : ''}`
          : `Тестовые команды отправлены по всем ${targets.length} обязательным активам`,
      actual: targets.length - notSent.length,
      expected: targets.length,
      details: { assets: ids(notSent.map((x) => x.target)), commands: notSent.flatMap((x) => (x.cmd ? [cmdLabel(x.cmd)] : [])) },
    },
    env,
  );

  const sent = tested.filter((x) => x.cmd?.sentAt);
  // CT-012 – приём контроллером
  const notReceived = sent.filter((x) => !x.cmd!.receivedAt || x.cmd!.receivedValueKw !== x.cmd!.input.valueKw);
  const ct12 = !sent.length
    ? makeResult('CT-012', 'SKIPPED', { message: 'Нет отправленных команд – приём не проверялся' }, env)
    : makeResult(
        'CT-012',
        notReceived.length === 0,
        {
          message: notReceived.length
            ? `Контроллер не подтвердил приём за ${rules.ackTimeoutSec} с: ${notReceived.map((x) => cmdLabel(x.cmd!)).join(', ')}`
            : `Приём подтверждён контроллером за ≤ ${rules.ackTimeoutSec} с, значения совпадают с отправленными`,
          expected: rules.ackTimeoutSec,
          details: { assets: ids(notReceived.map((x) => x.target)), commands: notReceived.map((x) => cmdLabel(x.cmd!)) },
        },
        env,
      );

  // CT-013 – отклик фактической мощности
  const received = sent.filter((x) => x.cmd!.receivedAt);
  const noResponse = received.filter((x) => x.cmd!.state !== 'PASSED');
  const ct13 = !received.length
    ? makeResult('CT-013', 'SKIPPED', { message: 'Нет принятых команд – отклик не проверялся' }, env)
    : makeResult(
        'CT-013',
        noResponse.length === 0,
        {
          message: noResponse.length
            ? `Нет отклика в ожидаемом интервале ${rules.responseWindowSec} с: ${noResponse.map((x) => cmdLabel(x.cmd!)).join(', ')}. Этап не завершается, пока актив не откликнется`
            : `Фактическая мощность вошла в полосу допуска не позже ${rules.responseWindowSec} с после приёма`,
          expected: rules.responseWindowSec,
          details: { assets: ids(noResponse.map((x) => x.target)), commands: noResponse.map((x) => cmdLabel(x.cmd!)) },
        },
        env,
      );

  const perKind = (ruleId: 'CT-014' | 'CT-015', kind: ControlTarget['kind'], required: boolean, label: string) => {
    const all = controlTargets(passport).filter((t) => t.kind === kind);
    const supported = all.filter((t) => t.supported);
    if (!all.length) return makeResult(ruleId, 'NOT_APPLICABLE', { message: `В паспорте object.json нет ${label} – тест не применим (отсутствие подтверждено паспортом)` }, env);
    if (!required) return makeResult(ruleId, 'NOT_APPLICABLE', { message: `Тест не требуется набором правил ${env.rulesetVersion}` }, env);
    if (!supported.length) return makeResult(ruleId, 'NOT_APPLICABLE', { message: all.map((t) => `${t.assetId}: ${t.notSupportedReason}`).join('; ') }, env);
    const bad = supported.filter((t) => latest.get(t.assetId)?.state !== 'PASSED');
    return makeResult(
      ruleId,
      bad.length === 0,
      {
        message: bad.length
          ? `Не пройден: ${bad.map((t) => (latest.get(t.assetId) ? cmdLabel(latest.get(t.assetId)!) : `${t.assetId} – тест не проводился`)).join(', ')}`
          : `Пройден для ${supported.map((t) => `${t.assetId} (${latest.get(t.assetId)!.commandId})`).join(', ')}`,
        actual: supported.length - bad.length,
        expected: supported.length,
        details: { assets: ids(bad), commands: bad.flatMap((t) => (latest.get(t.assetId) ? [cmdLabel(latest.get(t.assetId)!)] : [])), notSupported: all.filter((t) => !t.supported).map((t) => t.assetId) },
      },
      env,
    );
  };
  const ct14 = perKind('CT-014', 'BATTERY_SETPOINT', rules.requireBatterySetpoint, 'батарей');
  const ct15 = perKind('CT-015', 'PV_CURTAILMENT', rules.requirePvCurtailment, 'PV-установок');

  // CT-016 – некорректные значения (рекомендуемая): отклонены до отправки
  const rejected = commands.filter((c) => !c.sentAt);
  const ct16 = makeResult(
    'CT-016',
    rejected.length === 0,
    {
      message: rejected.length ? `Отклонено до отправки: ${rejected.length} команд с некорректным значением (${rejected.map((c) => c.commandId).join(', ')})` : 'Некорректных значений команд нет',
      actual: rejected.length,
      expected: 0,
      details: { commands: rejected.map((c) => c.commandId) },
    },
    env,
  );

  return [ct10, ct11, ct12, ct13, ct14, ct15, ct16, ...intervalsResult(commands, rules, env)];
}
