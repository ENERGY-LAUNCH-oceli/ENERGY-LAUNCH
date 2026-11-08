import { ANCHORS } from '@/config/blocker-links';
import { gs1CheckDigit } from '@/engine/invoice/format';
import type { TourStep } from '@/features/tour/tours';
import type { SitePassport, ValidationResult } from '@/types';

/**
 * «Помочь исправить»: по проваленной проверке – данные объекта, которые её вызвали, варианты исправления
 * и тур по странице. Автоматически исправляется только паспорт (новая версия object.json, старая – в истории,
 * действие – в журнале). Данные счётчиков и телеметрии приложение не правит: их присылает источник –
 * помощник готовит запрос с точными интервалами и показывает, куда загрузить исправленный файл.
 */

export interface FixFact {
  label: string;
  value: string;
  tone?: 'ok' | 'bad' | 'muted';
}

export interface FixOption {
  id: string;
  title: string;
  text: string;
  /** Исправление паспорта: новая версия object.json. */
  passport?: (p: SitePassport) => SitePassport;
  /** Что изменится – для показа «было → станет». */
  change?: { from: string; to: string };
}

export interface FixPlan {
  title: string;
  /** Что нашла проверка. */
  summary: string;
  facts: FixFact[];
  options: FixOption[];
  /** Текст запроса поставщику данных (копируется). */
  request?: string;
  tour: TourStep[];
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const short = (xs: string[], n = 6) => (xs.length > n ? `${xs.slice(0, n).join(', ')} и ещё ${xs.length - n}` : xs.join(', '));
const utc = (iso: string) => `${iso.slice(0, 10).split('-').reverse().join('.')} ${iso.slice(11, 16)} UTC`;

const page = (section: 'history' | 'telemetry') => (ctx: { objectId: string }) => `/objects/${encodeURIComponent(ctx.objectId)}/${section}`;
const UPLOAD = { history: `#${ANCHORS.mhUpload}`, telemetry: `#${ANCHORS.tmInputs}` } as const;

/** Тур: где на странице видна проблема, где следующее действие и куда загрузить исправление. */
function tourFor(section: 'history' | 'telemetry', where: { target: string; title: string; text: string }, upload: string): TourStep[] {
  return [
    { title: where.title, text: where.text, route: page(section), target: where.target },
    { title: 'Следующее действие', text: 'Карточка всегда показывает самое важное препятствие и что сделать. Исправили – она обновится после повторной проверки.', route: page(section), target: '[data-tour="next-action"]' },
    { title: 'Загрузить исправление', text: upload, route: page(section), target: UPLOAD[section] },
    { title: 'Повторная проверка', text: 'После загрузки проверки этапа запускаются сами. Если препятствие снято, этап разблокируется, а предыдущие результаты останутся в истории.', route: page(section), target: '[data-tour="stage-actions"]' },
  ];
}

/* ---------- Паспорт: EAN ---------- */

function eanState(code: string | null) {
  const v = (code ?? '').trim();
  if (!v) return { ok: false, why: 'не указан', fix: null as string | null };
  if (!/^\d+$/.test(v)) return { ok: false, why: 'есть не только цифры', fix: null };
  if (v.length === 17) return { ok: false, why: '17 цифр – похоже, нет контрольной цифры', fix: v + gs1CheckDigit(v) };
  if (v.length !== 18) return { ok: false, why: `${v.length} цифр вместо 18`, fix: null };
  const want = gs1CheckDigit(v.slice(0, 17));
  if (Number(v[17]) !== want) return { ok: false, why: `контрольная цифра ${v[17]}, должна быть ${want}`, fix: v.slice(0, 17) + want };
  return { ok: true, why: '18 цифр, контрольная цифра верна', fix: null };
}

function eanPlan(result: ValidationResult, passport: SitePassport | undefined): FixPlan {
  const rows = (['offtake', 'injection'] as const).map((k) => ({ k, code: passport?.ean[k] ?? null, ...eanState(passport?.ean[k] ?? null) }));
  const label = { offtake: 'EAN отбора (offtake)', injection: 'EAN отдачи (injection)' };
  const options: FixOption[] = rows
    .filter((r) => !r.ok && r.fix)
    .map((r) => ({
      id: `ean-${r.k}`,
      title: r.code!.length === 17 ? `Дописать контрольную цифру в ${label[r.k]}` : `Исправить контрольную цифру в ${label[r.k]}`,
      text: 'Контрольная цифра GS1 считается по первым 17 цифрам. Если сомневаетесь в самом коде – сверьте его с договором или сетевой организацией.',
      change: { from: r.code!, to: r.fix! },
      passport: (p) => ({ ...p, ean: { ...p.ean, [r.k]: r.fix } }),
    }));
  const manual = rows.filter((r) => !r.ok && !r.fix);
  return {
    title: 'Коды EAN в паспорте',
    summary: result.message,
    facts: rows.map((r) => ({ label: label[r.k], value: `${r.code ?? '–'} · ${r.why}`, tone: r.ok ? 'ok' : 'bad' })),
    options,
    ...(manual.length
      ? { request: `Здравствуйте!\nПо объекту ${passport?.name ?? ''} (${passport?.objectId ?? ''}) в паспорте указан некорректный код точки подключения: ${manual.map((r) => `${label[r.k]} – «${r.code ?? ''}» (${r.why})`).join('; ')}.\nПросим сообщить верный 18-значный код EAN.` }
      : {}),
    tour: tourFor(
      'history',
      { target: `#${ANCHORS.mhEan}`, title: 'Привязка счётчика', text: 'Здесь коды EAN из паспорта и что с ними не так. По этим кодам история счётчиков привязывается к объекту.' },
      'Загрузите исправленный object.json сюда или бросьте файл в любое место окна. Либо примените исправление в помощнике – он сам создаст новую версию паспорта.',
    ),
  };
}

/* ---------- Паспорт: карта сигналов ---------- */

const unitOf = (signal: string, prefix: string) => (/_kWh|kWh\b/.test(signal) ? 'kWh' : /SOC_%/.test(signal) ? '%' : /_kW\b|power_kW/.test(signal) ? 'kW' : `${prefix}.signal`);

function signalMapPlan(result: ValidationResult, passport: SitePassport | undefined): FixPlan {
  const missing = list(result.details?.signals);
  const owner = (s: string) => passport?.assets.find((a) => s.startsWith(`${a.prefix}.`));
  return {
    title: 'Карта сигналов паспорта',
    summary: result.message,
    facts: missing.map((s) => ({ label: s, value: owner(s) ? `актив ${owner(s)!.assetId}` : 'сигнал объекта (site_signals)', tone: 'bad' })),
    options: missing.length
      ? [
          {
            id: 'signals',
            title: `Добавить ${missing.length === 1 ? 'сигнал' : `${missing.length} сигнала(ов)`} в карту паспорта`,
            text: 'Сигналы добавятся в паспорт с единицами из имени. Убедитесь, что они действительно есть в выгрузке телеметрии – иначе следующая проверка покажет «нет данных».',
            change: { from: 'нет в карте', to: short(missing) },
            passport: (p) => {
              const assets = p.assets.map((a) => ({ ...a, signals: [...a.signals, ...missing.filter((s) => s.startsWith(`${a.prefix}.`)).map((s) => `${s} (${unitOf(s, a.prefix)})`)] }));
              const site = missing.filter((s) => !p.assets.some((a) => s.startsWith(`${a.prefix}.`))).map((s) => `${s} (${unitOf(s, s.split('.')[0]!)})`);
              return { ...p, assets, siteSignals: [...p.siteSignals, ...site] };
            },
          },
        ]
      : [],
    tour: tourFor(
      'telemetry',
      { target: `#${ANCHORS.tmSignals}`, title: 'Карта сигналов', text: 'Обязательные сигналы объекта и активов: каких нет в паспорте и каких нет в данных.' },
      'Загрузите исправленный object.json или телеметрию сюда. Либо примените исправление в помощнике – он добавит сигналы в новую версию паспорта.',
    ),
  };
}

/* ---------- Данные счётчиков и телеметрии: только запрос источнику ---------- */

function dataPlan(result: ValidationResult, passport: SitePassport | undefined): FixPlan {
  const d = result.details ?? {};
  const facts: FixFact[] = [];
  const lines: string[] = [];
  const months = list(d.missingMonths);
  if (months.length) {
    facts.push({ label: 'Нет данных за месяцы', value: short(months, 12), tone: 'bad' });
    lines.push(`– нет данных за месяцы: ${months.join(', ')}`);
  }
  const interval = d.interval as { from?: string; to?: string } | undefined;
  if (interval?.from && result.ruleId === 'MH-004') {
    facts.push({ label: 'Пропущенный интервал', value: `${utc(interval.from)} – ${utc(interval.to ?? interval.from)}`, tone: 'bad' });
    lines.push(`– пропуски 15-минутных интервалов, начиная с ${utc(interval.from)}`);
  }
  for (const [key, label] of [['examples', 'Нарушение знака'], ['rangeExamples', 'Выброс']] as const) {
    const ex = (Array.isArray(d[key]) ? d[key] : []) as { timestamp?: string; value?: string; field?: string }[];
    for (const e of ex.slice(0, 6)) if (e.timestamp) facts.push({ label: `${label} · ${utc(e.timestamp)}`, value: `${e.field ? `${e.field}: ` : ''}${e.value ?? ''}`, tone: 'bad' });
    if (ex.length) lines.push(`– ${label.toLowerCase()}: ${ex.slice(0, 6).map((e) => `${e.timestamp ? utc(e.timestamp) : ''} ${e.value ?? ''}`.trim()).join('; ')}${ex.length > 6 ? ' и др.' : ''}`);
  }
  const fields = [...list(d.fields), ...list(d.rangeFields)];
  if (fields.length) facts.push({ label: 'Поля', value: short([...new Set(fields)]), tone: 'muted' });
  const signals = list(d.signals);
  if (signals.length) {
    facts.push({ label: 'Сигналы', value: short(signals), tone: 'bad' });
    lines.push(`– сигналы: ${signals.join(', ')}`);
  }
  if (!facts.length) facts.push({ label: 'Проверка', value: result.message, tone: 'bad' });
  const telemetry = result.ruleId.startsWith('TM');
  const file = telemetry ? (passport?.dataFiles.telemetry ?? 'telemetry.csv') : (passport?.dataFiles.invoice ?? 'invoice.csv');
  return {
    title: telemetry ? 'Данные телеметрии' : 'Выгрузка счётчиков',
    summary: result.message,
    facts,
    options: [],
    request: `Здравствуйте!\nПо объекту ${passport?.name ?? ''} (${passport?.objectId ?? ''}) выгрузка ${file} не прошла проверку ${result.ruleId}: ${result.message}.\n${lines.join('\n')}${lines.length ? '\n' : ''}Просим прислать исправленную выгрузку: 15-минутные интервалы, время в UTC (ISO 8601), разделитель «;», знаки по ТЗ 4.2 («+» – потребление, «−» – выдача).`,
    tour: tourFor(
      telemetry ? 'telemetry' : 'history',
      telemetry
        ? { target: `#${result.ruleId === 'TM-006' ? ANCHORS.tmHeatmap : result.ruleId === 'TM-008' || result.ruleId === 'TM-007' || result.ruleId === 'TM-009' ? ANCHORS.tmIssues : ANCHORS.tmSignals}`, title: 'Где видна проблема', text: 'Здесь сигналы и интервалы, которые не прошли проверку.' }
        : { target: `#${result.ruleId === 'MH-002' ? ANCHORS.mhCoverage : result.ruleId === 'MH-004' || result.ruleId === 'MH-003' ? ANCHORS.mhCompleteness : ANCHORS.mhFields}`, title: 'Где видна проблема', text: 'Здесь месяцы, интервалы и поля выгрузки, которые не прошли проверку.' },
      'Данные счётчиков и телеметрии приложение не правит – их присылает источник. Получите исправленный файл (запрос можно скопировать в помощнике) и загрузите его сюда.',
    ),
  };
}

const PASSPORT_RULES: Record<string, (r: ValidationResult, p: SitePassport | undefined) => FixPlan> = { 'MH-011': eanPlan, 'TM-002': signalMapPlan };
const DATA_RULES = /^(MH-00[1-9]|MH-01[02]|TM-00[3-9]|TM-01[01])$/;

/** План исправления для проверки; null – помощника для неё нет (управление и дашборды исправляются на своих страницах). */
export function buildFixPlan(result: ValidationResult | undefined, passport: SitePassport | undefined): FixPlan | null {
  if (!result || result.status !== 'FAILED') return null;
  const special = PASSPORT_RULES[result.ruleId];
  if (special) return special(result, passport);
  return DATA_RULES.test(result.ruleId) ? dataPlan(result, passport) : null;
}
