import type { EnergyObject, InvoiceDataset, InvoiceIssueType, MeterHistoryRules, ValidationResult } from '@/types';
import { makeResult, type ValidatorEnv } from '../validators/helpers';
import { eanProblem, isValidEan, localMidnightUtc } from './format';

const count = (ds: InvoiceDataset, ...types: InvoiceIssueType[]) => types.reduce((n, t) => n + (ds.report.issueCounts[t] ?? 0), 0);
const fieldsWith = (ds: InvoiceDataset, ...types: InvoiceIssueType[]) => [...new Set(ds.report.issues.filter((i) => types.includes(i.type)).map((i) => i.field))];
const firstInterval = (ds: InvoiceDataset, ...types: InvoiceIssueType[]) => {
  const i = ds.report.issues.find((x) => types.includes(x.type) && x.timestamp);
  return i ? { from: i.timestamp!, to: i.timestampTo ?? i.timestamp! } : null;
};

/**
 * Этап 1 по ТЗ 2.3: покрытие 24 последовательных месяцев, полнота 15-минутных интервалов,
 * дубли, timestamps, единицы, знаки, пустые значения, связь с объектом по EAN.
 * Наличие, качество и функция оцениваются раздельно; отсутствие данных – не успех.
 */
export function validateInvoice(ds: InvoiceDataset | undefined, object: EnergyObject, rules: MeterHistoryRules, env: ValidatorEnv): ValidationResult[] {
  const ids = ['MH-002', 'MH-003', 'MH-004', 'MH-005', 'MH-006', 'MH-007', 'MH-008', 'MH-009', 'MH-010', 'MH-012'] as const;
  const r = ds?.report;
  const base = { fileName: r?.meta.fileName, rows: r?.meta.rows };
  const missingFields = r?.fields.filter((f) => !f.present && rules.fields.find((x) => x.field === f.field)?.required).map((f) => f.field) ?? [];
  const hasData = !!r && r.meta.rows > 0 && r.period.first !== null;

  const presence = makeResult(
    'MH-001',
    hasData && missingFields.length === 0,
    {
      message: !r ? 'Официальная выгрузка invoice.csv не загружена' : !hasData ? 'В файле нет строк с корректным временем' : missingFields.length ? `Нет обязательных колонок: ${missingFields.join(', ')}` : `Загружено строк: ${r.meta.rows.toLocaleString('ru-RU')}`,
      details: { ...base, fields: missingFields },
    },
    env,
  );

  const pEan = { offtake: object.gridConnection.eanOfftake ?? null, injection: object.gridConnection.eanInjection ?? null };
  const eanOk = isValidEan(pEan.offtake, rules.eanLength) && isValidEan(pEan.injection, rules.eanLength) && pEan.offtake !== pEan.injection;
  const eanPassport = makeResult(
    'MH-011',
    eanOk,
    {
      message: eanOk
        ? 'Коды EAN потребления и выдачи заданы в паспорте и корректны'
        : [
            eanProblem(pEan.offtake, rules.eanLength) && `EAN offtake ${eanProblem(pEan.offtake, rules.eanLength)}`,
            eanProblem(pEan.injection, rules.eanLength) && `EAN injection ${eanProblem(pEan.injection, rules.eanLength)}`,
            pEan.offtake && pEan.offtake === pEan.injection && 'EAN offtake и injection совпадают',
          ]
            .filter(Boolean)
            .join('; '),
      actual: `${pEan.offtake ?? '–'} / ${pEan.injection ?? '–'}`,
      expected: `${rules.eanLength} цифр, контрольная цифра GS1, разные коды`,
      details: { fields: ['grid_connection.ean_offtake', 'grid_connection.ean_injection'] },
    },
    env,
  );

  if (!r || !hasData) return [presence, eanPassport, ...ids.map((id) => makeResult(id, 'SKIPPED', { message: 'Нет данных для проверки – это не успех' }, env))];

  const w = r.window!;
  const declared = object.passport.declaredHistory;
  // Заявленный период – местные даты (включительно) в часовом поясе окна
  const tz = w.timezone ?? 'UTC';
  const day = (iso: string, plus = 0) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return localMidnightUtc(y, m, d + plus, tz);
  };
  const declaredOk = !declared || (Date.parse(w.from) <= day(declared.from) && Date.parse(w.to) >= day(declared.to, 1));
  const coverage = makeResult(
    'MH-002',
    r.missingMonths.length === 0 && declaredOk,
    {
      message: r.missingMonths.length
        ? `История покрывает ${rules.periodMonths - r.missingMonths.length} из ${rules.periodMonths} месяцев; нет данных: ${r.missingMonths.join(', ')}`
        : !declaredOk
          ? `Окно данных ${w.from.slice(0, 7)} – ${w.to.slice(0, 7)} не соответствует заявленному периоду ${declared!.from} – ${declared!.to}`
          : `Покрыты ${rules.periodMonths} последовательных месяцев`,
      actual: rules.periodMonths - r.missingMonths.length,
      expected: rules.periodMonths,
      details: { ...base, missingMonths: r.missingMonths, interval: { from: w.from, to: w.to }, declared: declared ?? null, declaredOk },
    },
    env,
  );

  const stepOk = r.detectedStepMinutes === rules.intervalMinutes;
  const step = makeResult(
    'MH-003',
    stepOk,
    {
      message: stepOk
        ? `Шаг данных ${rules.intervalMinutes} мин`
        : `Шаг исходных данных ${r.detectedStepMinutes ?? '–'} мин вместо ${rules.intervalMinutes}: данные сохранены в исходной детализации, искусственное увеличение частоты не подтверждает полноту`,
      actual: r.detectedStepMinutes,
      expected: rules.intervalMinutes,
      details: base,
    },
    env,
  );

  const complete = makeResult(
    'MH-004',
    r.completeness.pct >= rules.minCompletenessPct,
    {
      message: `Интервалов ${r.completeness.present.toLocaleString('ru-RU')} из ${r.completeness.expected.toLocaleString('ru-RU')} (${r.completeness.pct}%); пропущено ${r.completeness.missing.toLocaleString('ru-RU')}`,
      actual: r.completeness.pct,
      expected: rules.minCompletenessPct,
      details: { ...base, interval: firstInterval(ds, 'MISSING_INTERVAL'), gaps: r.issueCounts.MISSING_INTERVAL ?? 0 },
    },
    env,
  );

  const dup = makeResult('MH-005', r.duplicates <= rules.maxDuplicates, { message: r.duplicates ? `Дубли временных меток: ${r.duplicates}` : 'Дублей нет', actual: r.duplicates, expected: rules.maxDuplicates, details: { ...base, interval: firstInterval(ds, 'DUPLICATE_TIMESTAMP'), fields: ['timestamp'] } }, env);

  const tsIssues = count(ds, 'INVALID_TIMESTAMP', 'NON_UTC_TIMESTAMP', 'MISALIGNED_TIMESTAMP');
  const timestamps = makeResult('MH-006', tsIssues <= rules.maxInvalidTimestamps, { message: tsIssues ? `Некорректные отметки времени: ${tsIssues}` : 'Все отметки времени – ISO 8601 UTC, выровнены по интервалу', actual: tsIssues, expected: rules.maxInvalidTimestamps, details: { ...base, interval: firstInterval(ds, 'NON_UTC_TIMESTAMP', 'MISALIGNED_TIMESTAMP'), fields: ['timestamp'] } }, env);

  const unitIssues = count(ds, 'UNIT_MISMATCH', 'MIXED_UNITS');
  const units = makeResult('MH-007', unitIssues === 0, { message: unitIssues ? `Ошибки единиц: ${unitIssues} (поля: ${fieldsWith(ds, 'UNIT_MISMATCH', 'MIXED_UNITS').join(', ')})` : 'Единицы соответствуют правилам: kWh для энергии, kW для мощности', actual: unitIssues, expected: 0, details: { ...base, fields: fieldsWith(ds, 'UNIT_MISMATCH', 'MIXED_UNITS'), interval: firstInterval(ds, 'MIXED_UNITS') } }, env);

  const signIssues = count(ds, 'NEGATIVE_VALUE', 'POSITIVE_VALUE', 'SIGN_ERROR');
  const signs = makeResult('MH-008', signIssues === 0, { message: signIssues ? `Нарушения знаков: ${signIssues}` : 'Знаки соответствуют правилам ТЗ 4.2', actual: signIssues, expected: 0, details: { ...base, fields: fieldsWith(ds, 'NEGATIVE_VALUE', 'POSITIVE_VALUE', 'SIGN_ERROR'), interval: firstInterval(ds, 'NEGATIVE_VALUE', 'POSITIVE_VALUE', 'SIGN_ERROR') } }, env);

  const valueIssues = count(ds, 'EMPTY_VALUE', 'INVALID_NUMBER');
  const values = makeResult('MH-009', valueIssues === 0, { message: valueIssues ? `Пустые или некорректные значения: ${valueIssues}` : 'Пустых и некорректных значений нет', actual: valueIssues, expected: 0, details: { ...base, fields: fieldsWith(ds, 'EMPTY_VALUE', 'INVALID_NUMBER'), interval: firstInterval(ds, 'EMPTY_VALUE', 'INVALID_NUMBER') } }, env);

  const dev = count(ds, 'VALIDATED_DEVIATION');
  const validated = makeResult('MH-010', dev === 0, { message: dev ? `Валидированные значения отличаются от исходных в ${dev} интервалах` : 'Валидированные значения совпадают с исходными', actual: dev, expected: 0, details: base }, env);

  const fileEan = r.fileEan;
  const fileHasEan = fileEan.offtake.length + fileEan.injection.length > 0;
  const eanMismatch = fileHasEan && (fileEan.offtake.some((e) => e !== pEan.offtake) || fileEan.injection.some((e) => e !== pEan.injection));
  const registeredFile = object.passport.dataFiles?.invoice ?? null;
  const registered = !!registeredFile && r.meta.fileName.endsWith(registeredFile);
  const binding = makeResult(
    'MH-012',
    fileHasEan ? !eanMismatch : registered,
    {
      message: fileHasEan
        ? eanMismatch
          ? `EAN в файле (${[...fileEan.offtake, ...fileEan.injection].join(', ')}) не совпадают с паспортом объекта`
          : 'EAN в файле совпадают с паспортом объекта'
        : registered
          ? `Файл ${r.meta.fileName} зарегистрирован в паспорте объекта (data_files.invoice)`
          : `Файл ${r.meta.fileName} не связан с объектом: нет EAN в данных и нет записи в data_files паспорта`,
      details: { ...base, fields: fileHasEan ? ['EAN'] : ['data_files.invoice'] },
    },
    env,
  );

  return [presence, coverage, step, complete, dup, timestamps, units, signs, values, validated, eanPassport, binding];
}
