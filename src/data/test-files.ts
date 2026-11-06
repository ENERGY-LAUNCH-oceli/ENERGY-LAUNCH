import { invoiceCsvText, telemetryCsvText, type InvoiceGenOptions, type TelemetryGenOptions } from '@/data/mock';
import { gs1CheckDigit } from '@/engine/invoice/format';
import type { ObjectJson, SitePassport, StageId } from '@/types';

/**
 * Тестовые файлы для проверки правил на любом объекте: строятся под паспорт объекта
 * (EAN, оборудование, сигналы) теми же генераторами, что и демо-портфель. Данные синтетические.
 */
export interface TestFileVariant {
  id: string;
  stageId: Extract<StageId, 'METER_HISTORY' | 'REALTIME_TELEMETRY'>;
  title: string;
  description: string;
  /** Правила, которые должны не пройти: первое – основная проблема, остальные – её следствия (пусто – этап проходит). */
  expectFail: string[];
  /** Вариант применим к объекту (например, нужен актив нужного типа). */
  applicable?: (p: SitePassport) => boolean;
  build: (p: SitePassport) => { fileName: string; text: string; type: string };
}

const hasPv = (p: SitePassport) => p.assets.some((a) => a.type === 'PV');
const hasBattery = (p: SitePassport) => p.assets.some((a) => a.type === 'BATTERY');
const firstOf = (p: SitePassport, type: 'PV' | 'BATTERY') => p.assets.find((a) => a.type === type)?.prefix;

/** Имя оканчивается на имя из паспорта (data_files) – файл привязан к объекту по правилу MH-012. */
const fileName = (p: SitePassport, slug: string, kind: 'invoice' | 'telemetry') => {
  const registered = (kind === 'invoice' ? p.dataFiles.invoice : p.dataFiles.telemetry) ?? `${kind}.csv`;
  return `${p.objectId}_${slug}_${registered}`;
};

const invoice = (slug: string, o: Omit<InvoiceGenOptions, 'objectId'> = {}) => (p: SitePassport) => ({ fileName: fileName(p, slug, 'invoice'), text: invoiceCsvText({ objectId: p.objectId, ...o }), type: 'text/csv' });
const telemetry = (slug: string, o: (p: SitePassport) => TelemetryGenOptions = () => ({})) => (p: SitePassport) => ({ fileName: fileName(p, slug, 'telemetry'), text: telemetryCsvText(p, o(p)), type: 'text/csv' });

/** EAN другого объекта (корректный по формату): тот же префикс, другие цифры. */
const foreignEan = (ean: string | null) => {
  const body = (ean ?? '54144880000000000').slice(0, 17);
  const changed = body.slice(0, 13) + String((Number(body.slice(13)) + 4321) % 10000).padStart(4, '0');
  return changed + gs1CheckDigit(changed);
};

export const TEST_FILE_VARIANTS: TestFileVariant[] = [
  {
    id: 'mh-ok',
    stageId: 'METER_HISTORY',
    title: 'Корректная история',
    description: '24 месяца, шаг 15 минут, все обязательные поля, без ошибок.',
    expectFail: [],
    build: invoice('01-korrektnaya'),
  },
  {
    id: 'mh-short',
    stageId: 'METER_HISTORY',
    title: 'Короткая история',
    description: 'Нет первых 7 месяцев из 24 – падает и полнота интервалов.',
    expectFail: ['MH-002', 'MH-004'],
    build: invoice('02-korotkaya-istoriya', { missingFirstMonths: 7 }),
  },
  {
    id: 'mh-gaps',
    stageId: 'METER_HISTORY',
    title: 'Пропуски и дубли',
    description: 'Двое суток без данных и 40 повторяющихся строк.',
    expectFail: ['MH-004', 'MH-005'],
    build: invoice('03-propuski-dubli', { gaps: [['2026-03-10T00:00:00.000Z', 192]], duplicates: 40 }),
  },
  {
    id: 'mh-units',
    stageId: 'METER_HISTORY',
    title: 'Единицы и знаки',
    description: 'Блок строк в Wh вместо kWh, перевёрнутые знаки мощности, пустые значения.',
    expectFail: ['MH-007', 'MH-008', 'MH-009'],
    build: invoice('04-edinicy-znaki', { mixedUnitRows: 300, signErrors: 25, emptyCells: 30 }),
  },
  {
    id: 'mh-time',
    stageId: 'METER_HISTORY',
    title: 'Время не в UTC',
    description: 'Часть меток времени – местное время «… CET»: такие строки не засчитываются в полноту.',
    expectFail: ['MH-006', 'MH-004'],
    build: invoice('05-vremya-ne-utc', { invalidTimestamps: 20 }),
  },
  {
    id: 'mh-foreign',
    stageId: 'METER_HISTORY',
    title: 'Чужой объект',
    description: 'В файле колонки EAN другой точки подключения.',
    expectFail: ['MH-012'],
    build: (p) => invoice('06-chuzhoy-ean', { ean: { offtake: foreignEan(p.ean.offtake), injection: foreignEan(p.ean.injection) } })(p),
  },
  {
    id: 'tm-ok',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Корректная телеметрия',
    description: '52 часа до точки проверки, все сигналы паспорта, шаг 15 минут.',
    expectFail: [],
    build: telemetry('01-korrektnaya'),
  },
  {
    id: 'tm-stale',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Устаревшие данные',
    description: 'Поток прерывается за 2 часа до точки проверки – страдают полнота и сигналы батарей.',
    expectFail: ['TM-005', 'TM-006', 'TM-011'],
    build: telemetry('02-ustarevshie', () => ({ staleMinutes: 120 })),
  },
  {
    id: 'tm-missing',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Нет сигнала сети',
    description: 'В выгрузке нет колонки Grid.power_kW – сигнал считается отсутствующим и устаревшим.',
    expectFail: ['TM-003', 'TM-005', 'TM-006'],
    build: telemetry('03-net-signala', () => ({ dropSignals: ['Grid.power_kW'] })),
  },
  {
    id: 'tm-silent',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Батарея без связи',
    description: 'Колонки первой батареи есть, но значения пустые (нет связи).',
    expectFail: ['TM-006', 'TM-003', 'TM-005', 'TM-011'],
    applicable: hasBattery,
    build: telemetry('04-batareya-bez-svyazi', (p) => ({ silentAssets: [firstOf(p, 'BATTERY')!] })),
  },
  {
    id: 'tm-binding',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Чужой объект',
    description: 'В колонке object_id указан другой объект.',
    expectFail: ['TM-004'],
    build: telemetry('05-chuzhoy-obekt', () => ({ objectIdInFile: 'OBJ-FOREIGN-07' })),
  },
  {
    id: 'tm-values',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Ошибки значений',
    description: 'Отрицательная выработка PV и заряд батареи выше 100 %.',
    expectFail: ['TM-008', 'TM-011'],
    applicable: (p) => hasPv(p) && hasBattery(p),
    build: telemetry('06-oshibki-znacheniy', () => ({ negativePv: 6, socOutOfRange: 6 })),
  },
  {
    id: 'tm-units',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Неверная единица',
    description: 'Мощность сети в заголовке указана в W вместо kW.',
    expectFail: ['TM-007'],
    build: telemetry('07-nevernaya-edinica', () => ({ wrongUnit: { signal: 'Grid.power_kW', unit: 'W' } })),
  },
  {
    id: 'tm-time',
    stageId: 'REALTIME_TELEMETRY',
    title: 'Время без часового пояса',
    description: 'Часть меток времени без «Z» (неизвестный часовой пояс).',
    expectFail: ['TM-009', 'TM-006', 'TM-011'],
    build: telemetry('08-vremya-bez-zony', () => ({ naiveTimestamps: 8 })),
  },
];

export const variantsFor = (p: SitePassport) => TEST_FILE_VARIANTS.filter((v) => !v.applicable || v.applicable(p));

/** Паспорт объекта обратно в формат object.json (для повторной загрузки на этапе 2). */
export function passportToObjectJson(p: SitePassport): ObjectJson {
  // Строка паспорта – «улица, индекс, город, страна» без пустых частей: разбор с конца
  const parts = (p.address ?? '').split(', ').filter(Boolean);
  const country = parts.length > 1 && /^[A-Z]{2}$/.test(parts.at(-1)!) ? parts.pop()! : null;
  const city = parts.pop() ?? null;
  const postal = parts.length && /^[\w-]{3,10}$/.test(parts.at(-1)!) && /\d/.test(parts.at(-1)!) ? parts.pop()! : null;
  const street = parts.join(', ') || null;
  return {
    object_id: p.objectId,
    name: p.name,
    address: p.address ? { street, postal_code: postal, city, country } : null,
    coordinates: p.coordinates ? { lat: p.coordinates.lat, lon: p.coordinates.lon } : { lat: null, lon: null },
    timezone: p.timezone,
    grid_connection: { ean_offtake: p.ean.offtake, ean_injection: p.ean.injection },
    assets: p.assets.map((a) => ({ asset_id: a.assetId, type: a.type === 'PV' ? 'pv' : 'battery', signals: a.signals })),
    site_signals: p.siteSignals,
    data_files: p.dataFiles,
    csv_format: { delimiter: p.csvFormat.delimiter, decimal: p.csvFormat.decimal, encoding: p.csvFormat.encoding, timestamp_format: 'ISO 8601 UTC', step_minutes: p.csvFormat.stepMinutes },
  };
}
