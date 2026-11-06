import type { SignalReport, SitePassport, TelemetryDatasetV2, TelemetryIssueType, TelemetryRules, ValidationResult } from '@/types';
import { makeResult, type ValidatorEnv } from '../validators/helpers';
import { requiredSignals } from './passport';

const names = (xs: SignalReport[]) => xs.map((s) => s.signal);
const owners = (xs: SignalReport[]) => [...new Set(xs.map((s) => s.owner))];

/**
 * Этап 2 по ТЗ 2.3: обязательные сигналы по паспорту, привязка, актуальность (≤ 30 мин),
 * полнота 15-минутного потока за 48 ч (≥ 99 %, по каждому сигналу), правдоподобность.
 * Наличие, качество и функция раздельно; отсутствие связи не трактуется как неисправность.
 */
export function validateTelemetryReport(ds: TelemetryDatasetV2 | undefined, passport: SitePassport | undefined, rules: TelemetryRules, env: ValidatorEnv): ValidationResult[] {
  const ids = ['TM-003', 'TM-004', 'TM-005', 'TM-006', 'TM-007', 'TM-008', 'TM-009', 'TM-010'] as const;
  const passportOk = !!passport;
  const tm1 = makeResult(
    'TM-001',
    passportOk,
    {
      message: !passport ? 'Паспорт объекта object.json не загружен' : `Паспорт ${passport.objectId}: активов ${passport.assets.length} (${passport.assets.map((a) => a.assetId).join(', ') || 'нет'})${passport.warnings.length ? `; замечаний: ${passport.warnings.length}` : ''}`,
      details: { warnings: passport?.warnings ?? [], fields: ['assets', 'site_signals'] },
    },
    env,
  );
  if (!passport) return [tm1, makeResult('TM-002', 'SKIPPED', { message: 'Нет паспорта – карту сигналов проверить нельзя' }, env), ...ids.map((id) => makeResult(id, 'SKIPPED', { message: 'Нет паспорта объекта' }, env))];

  const req = requiredSignals(passport, rules);
  const notInMap = req.filter((r) => !r.inPassport);
  const tm2 = makeResult(
    'TM-002',
    notInMap.length === 0,
    {
      message: notInMap.length ? `Карта сигналов неполная: ${notInMap.map((r) => r.signal).join(', ')}` : `Карта сигналов содержит все ${req.length} обязательных сигналов`,
      actual: req.length - notInMap.length,
      expected: req.length,
      details: { signals: notInMap.map((r) => r.signal), owners: [...new Set(notInMap.map((r) => r.owner))] },
    },
    env,
  );

  const r = ds?.report;
  if (!r) return [tm1, tm2, ...ids.map((id) => makeResult(id, 'SKIPPED', { message: 'telemetry.csv не загружен – это не успех' }, env))];
  const sig = r.signals.filter((s) => s.required);
  // Полнота и актуальность – только для непрерывных сигналов; событийные сигналы управления проверяются на наличие
  const stream = sig.filter((s) => !s.event);
  const base = { fileName: r.meta.fileName, rows: r.meta.rows, checkPoint: r.checkPoint };
  const count = (...t: TelemetryIssueType[]) => t.reduce((n, x) => n + (r.issueCounts[x] ?? 0), 0);
  const interval = { from: r.window.from, to: r.window.to };

  const absent = sig.filter((s) => s.diagnosis === 'NOT_IN_DATA' || s.diagnosis === 'NO_COMMUNICATION' || s.diagnosis === 'WRONG_BINDING');
  const noComm = absent.filter((s) => s.diagnosis === 'NO_COMMUNICATION');
  const tm3 = makeResult(
    'TM-003',
    absent.length === 0,
    {
      message: absent.length
        ? `Нет данных по ${absent.length} обязательным сигналам (активы: ${owners(absent).join(', ')})${noComm.length ? `; нет связи: ${owners(noComm).join(', ')} – это не означает неисправность оборудования` : ''}`
        : 'Все обязательные сигналы присутствуют в данных',
      actual: sig.length - absent.length,
      expected: sig.length,
      details: { ...base, signals: names(absent), owners: owners(absent), noCommunication: names(noComm), interval },
    },
    env,
  );

  const wrong = sig.filter((s) => s.diagnosis === 'WRONG_BINDING');
  const foreignObj = r.objectIdsInFile.filter((id) => id !== passport.objectId);
  const tm4 = makeResult(
    'TM-004',
    r.foreignColumns.length === 0 && foreignObj.length === 0 && wrong.length === 0,
    {
      message:
        r.foreignColumns.length || foreignObj.length
          ? `Ошибочная привязка: ${foreignObj.length ? `телеметрия объекта ${foreignObj.join(', ')}; ` : ''}${r.foreignColumns.length ? `сигналы вне паспорта: ${r.foreignColumns.slice(0, 6).join(', ')}${r.foreignColumns.length > 6 ? '…' : ''}` : ''}`
          : 'Все сигналы привязаны к объекту и активам паспорта',
      details: { ...base, signals: names(wrong), foreign: r.foreignColumns, foreignObjects: foreignObj },
    },
    env,
  );

  const withData = stream.filter((s) => s.lastTimestamp);
  const stale = withData.filter((s) => (s.ageMinutes ?? 0) > rules.maxAgeMinutes);
  const maxAge = withData.length ? Math.max(...withData.map((s) => s.ageMinutes ?? 0)) : null;
  const tm5 = makeResult(
    'TM-005',
    stale.length === 0 && withData.length === stream.length,
    {
      message: stale.length
        ? `Устаревшие данные: ${stale.length} сигналов, последнее значение до ${maxAge} мин назад (порог ${rules.maxAgeMinutes} мин)`
        : withData.length < stream.length
          ? 'Актуальность не подтверждена: часть сигналов не имеет значений'
          : `Последние значения не старше ${rules.maxAgeMinutes} мин относительно точки проверки`,
      actual: maxAge,
      expected: rules.maxAgeMinutes,
      details: { ...base, signals: names(stale), interval },
    },
    env,
  );

  const incomplete = stream.filter((s) => s.completenessPct < rules.minCompletenessPct);
  const minPct = stream.length ? Math.min(...stream.map((s) => s.completenessPct)) : 0;
  const tm6 = makeResult(
    'TM-006',
    stream.length > 0 && incomplete.length === 0,
    {
      message: `Минимальная полнота за ${rules.windowHours} ч: ${minPct} % (порог ${rules.minCompletenessPct} %); ниже порога: ${incomplete.length} из ${stream.length}`,
      actual: minPct,
      expected: rules.minCompletenessPct,
      details: { ...base, signals: names(incomplete), interval },
    },
    env,
  );

  const unit = count('UNIT_MISMATCH');
  const tm7 = makeResult('TM-007', unit === 0, { message: unit ? `Неверные единицы: ${unit}` : 'Единицы kW, kWh и % соответствуют правилам', actual: unit, expected: 0, details: { ...base, signals: [...new Set(r.issues.filter((i) => i.type === 'UNIT_MISMATCH').map((i) => i.signal))] } }, env);

  const phys = count('OUT_OF_RANGE', 'NEGATIVE_PV', 'SOC_OUT_OF_RANGE', 'SIGN_ERROR', 'INVALID_NUMBER');
  const physSignals = [...new Set(r.issues.filter((i) => ['OUT_OF_RANGE', 'NEGATIVE_PV', 'SOC_OUT_OF_RANGE', 'SIGN_ERROR', 'INVALID_NUMBER'].includes(i.type)).map((i) => i.signal))];
  const firstPhys = r.issues.find((i) => physSignals.includes(i.signal) && i.timestamp);
  const tm8 = makeResult('TM-008', phys === 0, { message: phys ? `Нарушения знаков и диапазонов: ${phys} (${physSignals.join(', ')})` : 'Знаки и диапазоны соответствуют правилам (Grid ±, Battery ±, PV ≥ 0, SoC 0–100 %)', actual: phys, expected: 0, details: { ...base, signals: physSignals, interval: firstPhys ? { from: firstPhys.timestamp, to: firstPhys.timestamp } : null } }, env);

  const tsIssues = count('INVALID_TIMESTAMP', 'NON_UTC_TIMESTAMP', 'DUPLICATE_TIMESTAMP');
  const tm9 = makeResult('TM-009', tsIssues === 0, { message: tsIssues ? `Некорректные отметки времени: ${tsIssues} (неоднозначная зона, дубли, формат)` : 'Отметки времени – ISO 8601 UTC без дублей', actual: tsIssues, expected: 0, details: { ...base, fields: ['timestamp'] } }, env);

  const susp = count('SOC_JUMP', 'SETPOINT_MISMATCH');
  const tm10 = makeResult('TM-010', susp === 0, { message: susp ? `Подозрительные значения: ${susp} – требуют проверки, не доказывают неисправность` : 'Подозрительных значений нет', actual: susp, expected: 0, details: base }, env);

  // Not Applicable – только при подтверждённом паспортом отсутствии батареи (ТЗ 2.1)
  const batteries = passport.assets.filter((a) => a.type === 'BATTERY');
  const batSignals = sig.filter((s) => s.assetType === 'BATTERY');
  const batBad = batSignals.filter((s) => s.diagnosis !== 'OK' && s.diagnosis !== 'SUSPICIOUS');
  const tm11 = !batteries.length
    ? makeResult('TM-011', 'NOT_APPLICABLE', { message: 'В паспорте object.json нет батарей – проверка сигналов батареи не применима' }, env)
    : makeResult('TM-011', batBad.length === 0, { message: batBad.length ? `Проблемы сигналов батарей: ${owners(batBad).join(', ')}` : `Сигналы ${batteries.length} батарей в норме`, details: { ...base, signals: names(batBad), owners: owners(batBad) } }, env);

  return [tm1, tm2, tm3, tm4, tm5, tm6, tm7, tm8, tm9, tm10, tm11];
}
